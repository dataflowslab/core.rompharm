"""
Raportare - Execuție Bugetară
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, Dict, Any, List, Tuple, Set
from bson import ObjectId, Decimal128
from decimal import Decimal
import re

from ..utils.db import get_db
from ..routes.auth import verify_token

router = APIRouter(prefix="/api/rapoarte", tags=["rapoarte"])


def _to_float(value: Any) -> float:
    if isinstance(value, Decimal128):
        return float(value.to_decimal())
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except Exception:
        return 0.0


def _fetch_code_maps(db, collection: str, codes: Set[str]) -> Tuple[Dict[str, ObjectId], Dict[str, str]]:
    code_to_id: Dict[str, ObjectId] = {}
    id_to_code: Dict[str, str] = {}
    if not codes:
        return code_to_id, id_to_code

    cursor = db[collection].find({'cod': {'$in': list(codes)}})
    for doc in cursor:
        code = doc.get('cod') or doc.get('cod_clasificare') or doc.get('code')
        if not code:
            continue
        code_str = str(code)
        code_to_id[code_str] = doc.get('_id')
        if doc.get('_id'):
            id_to_code[str(doc.get('_id'))] = code_str
    return code_to_id, id_to_code


def _build_key(cod_clasificare: str, cod_subunitate: str, an_bugetar: int) -> str:
    return f"{cod_clasificare}|{cod_subunitate}|{an_bugetar}"


@router.get("/executie-bugetara")
async def executie_bugetara_report(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    an_bugetar: Optional[int] = None,
    capitol: Optional[str] = None,
    subcapitol: Optional[str] = None,
    cod_clasificare: Optional[str] = None,
    cod_subunitate: Optional[str] = None,
    user = Depends(verify_token)
) -> Dict[str, Any]:
    db = get_db()

    query: Dict[str, Any] = {}
    if search:
        search_regex = re.compile(re.escape(search), re.IGNORECASE)
        query['$or'] = [
            {'cod_clasificare': search_regex},
            {'denumire': search_regex}
        ]
    if an_bugetar:
        query['an_bugetar'] = an_bugetar
    if capitol:
        query['cod_clasificare_parsed.capitol'] = capitol
    if subcapitol:
        query['cod_clasificare_parsed.subcapitol'] = subcapitol
    if cod_clasificare:
        query['cod_clasificare'] = {'$regex': f'^{re.escape(cod_clasificare)}', '$options': 'i'}
    if cod_subunitate:
        query['cod_subunitate'] = cod_subunitate

    skip = (page - 1) * limit
    total = db.alop_buget_aprobat.count_documents(query)
    cursor = db.alop_buget_aprobat.find(query).sort('cod_clasificare', 1).skip(skip).limit(limit)
    buget_items = list(cursor)

    coduri_clasificare: Set[str] = set()
    coduri_subunitate: Set[str] = set()
    ani_bugetari: Set[int] = set()
    for item in buget_items:
        if item.get('cod_clasificare'):
            coduri_clasificare.add(str(item.get('cod_clasificare')))
        if item.get('cod_subunitate'):
            coduri_subunitate.add(str(item.get('cod_subunitate')))
        if item.get('an_bugetar'):
            ani_bugetari.add(int(item.get('an_bugetar')))

    clas_code_to_id, clas_id_to_code = _fetch_code_maps(db, 'alop_clasificari', coduri_clasificare)
    sub_code_to_id, sub_id_to_code = _fetch_code_maps(db, 'alop_subunitati', coduri_subunitate)

    # Build angajamente bugetare totals
    ang_buget_map: Dict[str, float] = {}
    ang_buget_query: Dict[str, Any] = {'anulat': {'$ne': True}}
    if ani_bugetari:
        ang_buget_query['an_bugetar'] = {'$in': list(ani_bugetari)}

    and_filters = []
    if clas_code_to_id or coduri_clasificare:
        class_ids = [oid for oid in clas_code_to_id.values() if oid]
        or_class = []
        if class_ids:
            or_class.append({'clasificare_id': {'$in': class_ids}})
        if coduri_clasificare:
            or_class.append({'cod_clasificare': {'$in': list(coduri_clasificare)}})
        if or_class:
            and_filters.append({'$or': or_class})

    if sub_code_to_id or coduri_subunitate:
        sub_ids = [oid for oid in sub_code_to_id.values() if oid]
        or_sub = []
        if sub_ids:
            or_sub.append({'subunitate_id': {'$in': sub_ids}})
        if coduri_subunitate:
            or_sub.append({'cod_subunitate': {'$in': list(coduri_subunitate)}})
        if or_sub:
            and_filters.append({'$or': or_sub})

    if and_filters:
        ang_buget_query['$and'] = and_filters

    for doc in db.alop_angajamente_bugetare.find(ang_buget_query):
        cod = doc.get('cod_clasificare') or clas_id_to_code.get(str(doc.get('clasificare_id'))) or ''
        sub = doc.get('cod_subunitate') or sub_id_to_code.get(str(doc.get('subunitate_id'))) or ''
        year = doc.get('an_bugetar')
        if not cod or not sub or not year:
            continue
        key = _build_key(cod, sub, int(year))
        ang_buget_map[key] = ang_buget_map.get(key, 0.0) + _to_float(doc.get('suma_lei'))

    # Build angajamente legale totals + ordonantari
    ang_legal_map: Dict[str, float] = {}
    ordonantari_map: Dict[str, float] = {}
    ang_legal_query: Dict[str, Any] = {'anulat': {'$ne': True}}
    if ani_bugetari:
        ang_legal_query['an_bugetar'] = {'$in': list(ani_bugetari)}
    if coduri_clasificare:
        ang_legal_query['cod_clasificare'] = {'$in': list(coduri_clasificare)}
    if coduri_subunitate:
        ang_legal_query['cod_subunitate'] = {'$in': list(coduri_subunitate)}

    for doc in db.alop_angajamente_legale.find(ang_legal_query):
        cod = doc.get('cod_clasificare') or ''
        sub = doc.get('cod_subunitate') or ''
        year = doc.get('an_bugetar')
        if not cod or not sub or not year:
            continue
        key = _build_key(cod, sub, int(year))
        ang_legal_map[key] = ang_legal_map.get(key, 0.0) + _to_float(doc.get('suma_lei'))
        ordonantari_map[key] = ordonantari_map.get(key, 0.0) + _to_float(doc.get('suma_ordonantata'))

    items: List[Dict[str, Any]] = []
    for item in buget_items:
        cod = str(item.get('cod_clasificare') or '')
        sub = str(item.get('cod_subunitate') or '')
        year = int(item.get('an_bugetar') or 0)
        key = _build_key(cod, sub, year)
        buget_aprobat = _to_float(item.get('suma_curenta'))
        ang_buget = ang_buget_map.get(key, 0.0)
        ang_legal = ang_legal_map.get(key, 0.0)
        ordonantat = ordonantari_map.get(key, 0.0)

        items.append({
            'cod_clasificare': cod,
            'denumire': item.get('denumire', ''),
            'cod_subunitate': sub,
            'an_bugetar': year,
            'buget_aprobat': buget_aprobat,
            'angajamente_bugetare': ang_buget,
            'angajamente_legale': ang_legal,
            'ordonantari': ordonantat,
            'disponibil_buget': buget_aprobat - ang_buget,
            'disponibil_angajamente': ang_buget - ang_legal,
            'disponibil_plati': ang_legal - ordonantat,
            'tip_operatie': item.get('tip_operatie', ''),
        })

    return {
        'items': items,
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit
    }
