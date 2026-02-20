"""
PDF signature inspection utilities.
"""
from __future__ import annotations

import os
import re
from typing import Dict, Any, List


_PDF_HEADER = b"%PDF-"
_BYTE_RANGE_RE = re.compile(rb"/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+\s*\]")
_NAME_LITERAL_RE = re.compile(rb"/Name\s*\((?P<name>(?:\\.|[^\)])*)\)")
_NAME_HEX_RE = re.compile(rb"/Name\s*<(?P<hex>[0-9A-Fa-f]+)>")


def _looks_like_pdf(content: bytes) -> bool:
    return content.lstrip().startswith(_PDF_HEADER)


def count_pdf_signatures_from_bytes(content: bytes) -> int:
    """
    Count PDF signatures based on /ByteRange entries.
    """
    if not _looks_like_pdf(content):
        return 0
    return len(_BYTE_RANGE_RE.findall(content))


def _decode_pdf_literal_string(raw: bytes) -> str:
    out = bytearray()
    i = 0
    length = len(raw)
    while i < length:
        ch = raw[i]
        if ch == 0x5C:  # backslash
            i += 1
            if i >= length:
                break
            esc = raw[i]
            if esc in (0x5C, 0x28, 0x29):  # \ ( ) \
                out.append(esc)
            elif esc == 0x6E:  # n
                out.append(0x0A)
            elif esc == 0x72:  # r
                out.append(0x0D)
            elif esc == 0x74:  # t
                out.append(0x09)
            elif esc == 0x62:  # b
                out.append(0x08)
            elif esc == 0x66:  # f
                out.append(0x0C)
            elif 0x30 <= esc <= 0x37:
                octal_digits = bytes([esc])
                for _ in range(2):
                    if i + 1 < length and 0x30 <= raw[i + 1] <= 0x37:
                        i += 1
                        octal_digits += bytes([raw[i]])
                    else:
                        break
                try:
                    out.append(int(octal_digits, 8))
                except ValueError:
                    pass
            else:
                out.append(esc)
        else:
            out.append(ch)
        i += 1
    try:
        return out.decode("utf-8").strip()
    except UnicodeDecodeError:
        return out.decode("latin-1", errors="ignore").strip()


def _decode_pdf_hex_string(hex_bytes: bytes) -> str:
    hex_str = hex_bytes.decode("ascii", errors="ignore").strip()
    if len(hex_str) % 2 == 1:
        hex_str = hex_str + "0"
    try:
        data = bytes.fromhex(hex_str)
    except ValueError:
        data = hex_bytes
    try:
        return data.decode("utf-8").strip()
    except UnicodeDecodeError:
        return data.decode("latin-1", errors="ignore").strip()


def _extract_signer_names_from_window(window: bytes) -> List[str]:
    names: List[str] = []
    for match in _NAME_LITERAL_RE.finditer(window):
        name_raw = match.group("name")
        name = _decode_pdf_literal_string(name_raw)
        if name and name not in names:
            names.append(name)
    for match in _NAME_HEX_RE.finditer(window):
        name_raw = match.group("hex")
        name = _decode_pdf_hex_string(name_raw)
        if name and name not in names:
            names.append(name)
    return names


def get_pdf_signer_names_from_bytes(content: bytes) -> List[str]:
    if not _looks_like_pdf(content):
        return []
    names: List[str] = []
    for match in _BYTE_RANGE_RE.finditer(content):
        start = match.start()
        window = content[start:start + 4096]
        for name in _extract_signer_names_from_window(window):
            if name not in names:
                names.append(name)
    return names


def get_pdf_signature_info_from_bytes(content: bytes) -> Dict[str, Any]:
    """
    Inspect PDF content and return signature info.
    """
    if not _looks_like_pdf(content):
        return {
            "is_pdf": False,
            "is_signed": False,
            "signature_count": 0,
            "signer_names": [],
        }
    signature_count = count_pdf_signatures_from_bytes(content)
    signer_names = get_pdf_signer_names_from_bytes(content)
    return {
        "is_pdf": True,
        "is_signed": signature_count > 0,
        "signature_count": signature_count,
        "signer_names": signer_names,
    }


def get_pdf_signature_info(file_path: str) -> Dict[str, Any]:
    """
    Inspect a file path and return signature info.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    with open(file_path, "rb") as f:
        content = f.read()
    return get_pdf_signature_info_from_bytes(content)
