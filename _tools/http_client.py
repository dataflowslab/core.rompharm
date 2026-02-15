import json
import os
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode, urljoin


class SimpleHttpClient:
    def __init__(self, base_url: str, token: Optional[str] = None, timeout: int = 20):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def set_token(self, token: str) -> None:
        self.token = token

    def _build_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        result = {
            "Accept": "application/json",
        }
        if self.token:
            result["Authorization"] = f"Token {self.token}"
        if headers:
            result.update(headers)
        return result

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Tuple[int, Dict[str, Any], str]:
        try:
            import requests  # type: ignore

            url = self._build_url(path, params)
            resp = requests.request(
                method=method.upper(),
                url=url,
                headers=self._build_headers(headers),
                json=json_body,
                timeout=self.timeout,
            )
            text = resp.text
            data = self._parse_json(text)
            return resp.status_code, data, text
        except ImportError:
            return self._request_urllib(method, path, params, json_body, headers)

    def _request_urllib(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]],
        json_body: Optional[Dict[str, Any]],
        headers: Optional[Dict[str, str]],
    ) -> Tuple[int, Dict[str, Any], str]:
        import urllib.request

        url = self._build_url(path, params)
        body_bytes = None
        req_headers = self._build_headers(headers)
        if json_body is not None:
            body_bytes = json.dumps(json_body).encode("utf-8")
            req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status = resp.getcode()
                text = resp.read().decode("utf-8")
                data = self._parse_json(text)
                return status, data, text
        except urllib.error.HTTPError as e:
            text = e.read().decode("utf-8") if e.fp else ""
            data = self._parse_json(text)
            return e.code, data, text

    def _build_url(self, path: str, params: Optional[Dict[str, Any]] = None) -> str:
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        if params:
            url = f"{url}?{urlencode(params)}"
        return url

    @staticmethod
    def _parse_json(text: str) -> Dict[str, Any]:
        try:
            return json.loads(text) if text else {}
        except json.JSONDecodeError:
            return {}


def get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    return os.environ.get(name, default)
