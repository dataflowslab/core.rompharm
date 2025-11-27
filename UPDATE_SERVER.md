# Comenzi pentru actualizare server

## 1. Conectează-te la server (SSH)
```bash
ssh user@server-address
```

## 2. Navighează la directorul proiectului
```bash
cd /path/to/dataflows-core-rompharm
```

## 3. Pull ultimele modificări
```bash
git pull origin master
```

## 4. Actualizează dependențele Python (dacă e cazul)
```bash
source venv/bin/activate
pip install -r src/backend/requirements.txt
```

## 5. Restart serviciul backend
Depinde de cum rulează serverul:

### Dacă folosești systemd:
```bash
sudo systemctl restart dataflows-backend
```

### Dacă folosești PM2:
```bash
pm2 restart dataflows-backend
```

### Dacă folosești uvicorn direct:
```bash
# Oprește procesul curent (Ctrl+C sau kill PID)
# Apoi pornește din nou:
uvicorn src.backend.app:app --host 0.0.0.0 --port 8051
```

## 6. Verifică că serverul rulează
```bash
curl http://localhost:8051/api/system/notifications
```

## 7. Rebuild frontend (dacă ai modificări frontend)
```bash
cd src/frontend
npm install
npm run build
```

## Note importante:
- Asigură-te că fișierul `config/config.yaml` există pe server
- Verifică că toate variabilele de mediu sunt setate corect
- Dacă ai erori, verifică logs-urile serverului
