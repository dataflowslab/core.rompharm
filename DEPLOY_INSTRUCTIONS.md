# Deploy Instructions - Requests Module Complete

## Status: ✅ READY FOR DEPLOY

Toate modificările sunt commit-ate și push-ate pe GitHub.

## Pe server, rulează:

```bash
# 1. Pull ultimele modificări
git pull

# 2. Instalează dependențele frontend (dacă nu sunt deja instalate)
cd src/frontend
npm install

# 3. Build frontend
npm run build

# 4. Restart backend (dacă e necesar)
# Depinde de cum rulezi backend-ul (uvicorn, systemd, etc.)
```

## Sau tot într-o singură comandă:
```bash
git pull ; cd src/frontend ; npm install ; npm run build
```

## Ce s-a implementat:

### ✅ Backend:
1. **Endpoint batch codes**: `GET /api/requests/parts/{part_id}/batch-codes`
2. **Model actualizat**: `RequestItemCreate` cu `series` și `batch_code`
3. **Auto-create flows**:
   - Approval flow la crearea request-ului
   - Operations flow când request devine "Approved"
   - Reception flow când operations devine "Finished"

### ✅ Frontend:
1. **OperationsTab**: Logică completă cu readonly după semnare
2. **ReceptionTab**: Tabel cantități primite + readonly după semnare
3. **ModalsProvider**: Adăugat pentru funcționalitate modals
4. **Buton ștergere semnătură**: Vizibil pentru admin

### ✅ Template:
1. **RC45WVTRBDGT.html**: Template HTML cu placeholders corecte
2. Actualizat în MongoDB

### ⏳ Pentru viitor (opțional):
1. Implementare completă Series și Batch în OperationsTab
   - Cod complet în `OPERATIONS_SERIES_BATCH_IMPLEMENTATION.md`
2. Generare document cu QR code
   - Funcții QR există deja în `documents.py`

## Verificare după deploy:

1. ✅ Login funcționează
2. ✅ Creează un request nou
3. ✅ Verifică că Approval flow se creează automat
4. ✅ Semnează approval → Request devine "Approved"
5. ✅ Verifică că Operations flow se creează automat
6. ✅ Tab Operations apare
7. ✅ Selectează status (Approved/Refused)
8. ✅ Butonul "Sign" apare DOAR după selectarea statusului
9. ✅ Semnează → Formularul devine readonly
10. ✅ Butonul Delete (trash) funcționează pentru admin

## Troubleshooting:

### Build error: "Cannot find module '@mantine/modals'"
```bash
cd src/frontend
npm install @mantine/modals
npm run build
```

### ModalsProvider not working:
- Verifică că `src/frontend/src/main.tsx` conține `<ModalsProvider>`
- Verifică că este înfășurat corect în ierarhia de componente

### Backend errors:
- Verifică că MongoDB rulează
- Verifică că config-ul `requests_operations_flow` există în MongoDB
- Verifică logs: `tail -f logs/backend.log`

## Contact:
Pentru probleme sau întrebări, verifică documentația în:
- `OPERATIONS_SERIES_BATCH_IMPLEMENTATION.md`
- `IMPLEMENTARE_REQUESTS_UPDATES.md`
- `TEMPLATE_RC45WVTRBDGT.html`
