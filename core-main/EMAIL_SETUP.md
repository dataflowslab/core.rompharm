# Email Notification Setup

## Configurare Newsman API

Pentru a activa notificările email la completarea formularelor, trebuie să configurezi credențialele Newsman în `config.yaml`.

### Pași de configurare:

1. **Obține credențialele Newsman**:
   - Accesează contul tău Newsman
   - Găsește API Key și Account ID în setări

2. **Actualizează config.yaml**:
   ```yaml
   email:
     newsman_api_key: "YOUR_ACTUAL_API_KEY"
     newsman_account_id: "YOUR_ACTUAL_ACCOUNT_ID"
     from_email: "noreply@dataflows.ro"  # Email verificat în Newsman
     from_name: "DataFlows Forms"
   ```

3. **Verifică email-ul expeditor**:
   - Email-ul `from_email` trebuie să fie verificat în contul Newsman
   - Altfel, email-urile nu vor fi trimise

4. **Restart serviciu**:
   ```bash
   sudo systemctl restart dataflows-core
   ```

## Testare

### Test Rapid - Configurație Email

Rulează acest task pentru a testa configurația Newsman:

```bash
# Windows (Local):
invoke test-email

# Cu email specific:
invoke test-email --to=your@email.com

# Linux (Server):
cd /opt/dataflows-forms
invoke test-email --to=your@email.com
```

### Test Complet - Formular

1. Editează un formular și adaugă email-ul tău în câmpul "Notification Emails"
2. Selectează template-ul "Default" (sau alt template disponibil)
3. Salvează formularul
4. Completează formularul
5. Verifică inbox-ul pentru notificare

## Troubleshooting

### Nu primesc email-uri:

1. **Verifică configurația**:
   - API Key și Account ID sunt corecte
   - Email-ul expeditor este verificat în Newsman

2. **Verifică logurile serverului**:
   ```bash
   sudo journalctl -u dataflows-core -f
   ```
   Caută mesaje de eroare legate de email

3. **Verifică formularul**:
   - Are email-uri în câmpul "Notification Emails"
   - Template-ul selectat există în `media/mail_templates/`

4. **Testează manual API Newsman**:
   ```bash
   curl -X POST https://cluster.newsmanapp.com/api/1.0/message.send \
     -H "Content-Type: application/json" \
     -d '{
       "key": "YOUR_API_KEY",
       "account_id": "YOUR_ACCOUNT_ID",
       "message": {
         "from_email": "noreply@dataflows.ro",
         "from_name": "Test",
         "subject": "Test",
         "html": "<p>Test</p>"
       },
       "recipients": [{"email": "your@email.com"}]
     }'
   ```

## Template-uri Email

Template-urile sunt stocate în `media/mail_templates/`.

### Placeholders disponibile:
- `{{ config.web.base_url }}` - URL-ul aplicației
- `{{ form_submisions }}` - Link către submissions

### Creare template nou:

1. Creează fișier HTML în `media/mail_templates/` (ex: `custom.html`)
2. Folosește placeholders pentru date dinamice
3. Template-ul va apărea automat în dropdown la editare formular
