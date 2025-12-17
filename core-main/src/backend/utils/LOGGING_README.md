# Centralized Logging System

## Overview
Sistem centralizat de logging care salvează toate log-urile în MongoDB (colecția `logs`).

## Usage

### Import
```python
from utils.logger import logger

# SAU pentru funcții directe:
from utils.logger import log_error, log_warning, log_info, log_api_call, log_access
```

### Examples

#### 1. Log Error
```python
try:
    # some code
    result = risky_operation()
except Exception as e:
    logger.error(
        subject="Failed to process PDF",
        content=str(e),
        category="pdf_generation",
        exception=e,  # Automatically captures traceback
        metadata={"doc_id": doc_id, "user_id": user_id}
    )
```

#### 2. Log API Call
```python
import time
start_time = time.time()

response = requests.post(url, data=payload, headers=headers)

duration_ms = (time.time() - start_time) * 1000

logger.api_call(
    subject="pdfRest API Call",
    request_method="POST",
    request_path="/pdf-with-imported-form-data",
    response_status=response.status_code,
    duration_ms=duration_ms,
    request_body={"doc_id": doc_id},
    response_body=response.json() if response.ok else {"error": response.text[:500]},
    category="pdfrest",
    metadata={"doc_id": doc_id}
)
```

#### 3. Log Warning
```python
logger.warning(
    subject="PDF template not found",
    content=f"Template path: {template_path}",
    category="procurement"
)
```

#### 4. Log Info
```python
logger.info(
    subject="Document created successfully",
    content=f"Document ID: {doc_id}",
    category="procurement",
    metadata={"doc_id": doc_id, "user_id": user_id}
)
```

#### 5. Log Access
```python
logger.access(
    subject="User logged in",
    user_id=str(user['_id']),
    user_email=user['email'],
    ip_address=request.client.host
)
```

## Log Levels

- **error** - Erori critice
- **warning** - Avertismente
- **info** - Informații generale
- **debug** - Debugging
- **api** - Apeluri API externe
- **access** - Acces utilizatori

## Log Categories

Categorii sugerate:
- `general` - General
- `api_call` - Apeluri API
- `database` - Operații DB
- `auth` - Autentificare
- `procurement` - Modul Procurement
- `pdf_generation` - Generare PDF
- `pdfrest` - pdfRest API
- `file_upload` - Upload fișiere
- `email` - Email

## MongoDB Structure

```javascript
{
  timestamp: ISODate("2025-12-04T17:00:00.000Z"),
  level: "error",
  category: "pdfrest",
  subject: "pdfRest API Call Failed",
  content: "HTTP 400: Invalid XDP format",
  ip_address: "192.168.1.100",
  user_id: "507f1f77bcf86cd799439011",
  user_email: "user@example.com",
  request_method: "POST",
  request_path: "/pdf-with-imported-form-data",
  request_body: {...},
  response_status: 400,
  response_body: {...},
  error_traceback: "Traceback...",
  duration_ms: 1234.56,
  metadata: {...}
}
```

## Querying Logs

### MongoDB Queries

```javascript
// All errors in last hour
db.logs.find({
  level: "error",
  timestamp: {$gte: new Date(Date.now() - 3600000)}
})

// All pdfRest API calls
db.logs.find({
  category: "pdfrest",
  level: "api"
})

// Failed API calls (status >= 400)
db.logs.find({
  level: "api",
  response_status: {$gte: 400}
})

// Slow API calls (> 5 seconds)
db.logs.find({
  level: "api",
  duration_ms: {$gt: 5000}
})

// User activity
db.logs.find({
  user_email: "user@example.com"
}).sort({timestamp: -1})
```

## Best Practices

1. **Always log API calls** - Include request/response for debugging
2. **Log errors with context** - Include metadata (doc_id, user_id, etc.)
3. **Use appropriate categories** - Makes filtering easier
4. **Include duration for performance tracking**
5. **Don't log sensitive data** - Passwords, tokens, etc.
6. **Use metadata field** - For additional context-specific data

## Example: Complete API Call Logging

```python
import time
from utils.logger import logger

async def call_external_api(doc_id: str, data: dict):
    start_time = time.time()
    
    try:
        logger.info(
            subject="Starting API call",
            category="external_api",
            metadata={"doc_id": doc_id}
        )
        
        response = requests.post(
            url="https://api.example.com/process",
            json=data,
            headers={"Authorization": "Bearer ***"},  # Don't log actual token
            timeout=60
        )
        
        duration_ms = (time.time() - start_time) * 1000
        
        logger.api_call(
            subject="External API Call",
            request_method="POST",
            request_path="/process",
            response_status=response.status_code,
            duration_ms=duration_ms,
            request_body={"doc_id": doc_id, "data_size": len(str(data))},
            response_body=response.json() if response.ok else {"error": response.text[:500]},
            category="external_api",
            metadata={"doc_id": doc_id}
        )
        
        if not response.ok:
            logger.error(
                subject="API call failed",
                content=f"Status {response.status_code}: {response.text[:200]}",
                category="external_api",
                metadata={"doc_id": doc_id, "status": response.status_code}
            )
            return None
            
        return response.json()
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        
        logger.error(
            subject="API call exception",
            content=str(e),
            category="external_api",
            exception=e,
            metadata={"doc_id": doc_id, "duration_ms": duration_ms}
        )
        return None
```
