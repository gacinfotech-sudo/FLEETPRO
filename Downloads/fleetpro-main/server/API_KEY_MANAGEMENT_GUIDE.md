# API Key Management System - Complete Guide

## Overview

The API Key Management System enables FleetPro customers to create and manage API keys for programmatic access to the platform. Each key can be configured with specific permissions, rate limits, IP whitelisting, and expiration dates.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Customer Application                                    │
│ (Script, Server, Mobile App)                            │
└────────────────────────┬────────────────────────────────┘
                         │ API Request with API Key
                         │ (Header, Query Param, Bearer)
                         ▼
┌─────────────────────────────────────────────────────────┐
│ API Key Authentication Middleware                       │
│ - Validate key format                                   │
│ - Check if active/expired                              │
│ - Verify IP whitelist                                  │
│ - Check rate limit                                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Permission Check                                        │
│ - read, write, admin permissions                        │
│ - '*' wildcard for all permissions                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Route Handler (API Endpoint)                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Usage Tracking                                          │
│ - Record endpoint, method, status code                  │
│ - Track response time                                  │
│ - Update last used timestamp                            │
└─────────────────────────────────────────────────────────┘
```

## API Key Formats

### Creating an API Key

API keys are 64-character hex strings (256-bit):
```
example_key_5a3d8f9c2e1b4g7h6j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y
```

**Storage**: Keys are hashed with SHA-256 before storage in database
- Raw key shown only once on creation
- Masked format for display: `example_k...o3p4`

## API Endpoints

### Create API Key

**POST** `/api/api-keys`

Create a new API key for programmatic access.

**Request:**
```bash
curl -X POST http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App Integration",
    "permissions": ["read", "write"],
    "expiresInDays": 90,
    "rateLimit": 100
  }'
```

**Response:**
```json
{
  "message": "API key created successfully",
  "apiKey": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Mobile App Integration",
    "key": "example_5a3d8f9c2e1b4g7h6j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y",
    "maskedKey": "example_k...o3p4",
    "permissions": ["read", "write"],
    "rateLimit": 100,
    "createdAt": "2026-08-17T10:30:00Z",
    "expiresAt": "2026-11-15T10:30:00Z",
    "isActive": true
  }
}
```

### List API Keys

**GET** `/api/api-keys`

Get all API keys for your tenant.

**Request:**
```bash
curl http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <session-token>"
```

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Mobile App",
      "maskedKey": "example_k...o3p4",
      "permissions": ["read", "write"],
      "rateLimit": 100,
      "createdAt": "2026-08-17T10:30:00Z",
      "expiresAt": "2026-11-15T10:30:00Z",
      "lastUsedAt": "2026-08-17T15:45:00Z",
      "isActive": true,
      "usageCount": 1247
    }
  ],
  "count": 1
}
```

### Get API Key Details

**GET** `/api/api-keys/:keyId`

Get detailed information about a specific API key.

**Request:**
```bash
curl http://localhost:5050/api/api-keys/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <session-token>"
```

### Update API Key

**PUT** `/api/api-keys/:keyId`

Update API key settings.

**Request:**
```bash
curl -X PUT http://localhost:5050/api/api-keys/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Mobile App",
    "permissions": ["read"],
    "rateLimit": 50,
    "isActive": true
  }'
```

### Revoke API Key

**POST** `/api/api-keys/:keyId/revoke`

Deactivate an API key (can be reactivated by setting `isActive: true`).

**Request:**
```bash
curl -X POST http://localhost:5050/api/api-keys/507f1f77bcf86cd799439011/revoke \
  -H "Authorization: Bearer <session-token>"
```

### Delete API Key

**DELETE** `/api/api-keys/:keyId`

Permanently delete an API key.

**Request:**
```bash
curl -X DELETE http://localhost:5050/api/api-keys/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <session-token>"
```

### Get API Key Usage

**GET** `/api/api-keys/:keyId/usage?days=7`

Get usage statistics for an API key.

**Request:**
```bash
curl "http://localhost:5050/api/api-keys/507f1f77bcf86cd799439011/usage?days=30" \
  -H "Authorization: Bearer <session-token>"
```

**Response:**
```json
{
  "totalRequests": 5234,
  "successfulRequests": 5120,
  "errorRequests": 114,
  "averageResponseTime": 234,
  "endpoints": [
    "/api/vehicles",
    "/api/bookings",
    "/api/drivers"
  ],
  "methods": ["GET", "POST", "PUT"],
  "requestsByStatus": {
    "200": 5120,
    "400": 50,
    "401": 30,
    "500": 34
  }
}
```

## Using API Keys in Requests

### Method 1: Authorization Header (Recommended)

```bash
curl http://localhost:5050/api/vehicles \
  -H "Authorization: Bearer <your-api-key>"
```

### Method 2: X-API-Key Header

```bash
curl http://localhost:5050/api/vehicles \
  -H "X-API-Key: <your-api-key>"
```

### Method 3: Query Parameter

```bash
curl "http://localhost:5050/api/vehicles?api_key=<your-api-key>"
```

## Permissions

### Available Permissions

- **`read`** - Read-only access to data (GET endpoints)
- **`write`** - Write access (POST, PUT, DELETE endpoints)
- **`admin`** - Administrative functions
- **`*`** - All permissions (wildcard)

### Permission Examples

```javascript
// Read-only key (customer dashboards)
permissions: ['read']

// Read and write (integrations)
permissions: ['read', 'write']

// Full access (internal tools)
permissions: ['*']

// Multiple specific permissions
permissions: ['read', 'write', 'admin']
```

## Rate Limiting

Each API key has a rate limit specified in requests per minute.

### Default Limits by Use Case

- **Development**: 10 req/min
- **Standard Integration**: 100 req/min
- **High-Volume Integration**: 500 req/min
- **Enterprise**: Custom

### Rate Limit Response

When rate limit exceeded (HTTP 429):

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Max 100 requests per minute"
}
```

### Checking Your Limit

Check usage statistics to see how close you are to your limit:

```bash
curl "http://localhost:5050/api/api-keys/<keyId>/usage" \
  -H "Authorization: Bearer <session-token>"
```

## Expiration & Rotation

### Setting Expiration

Create a key that expires in 90 days:

```bash
curl -X POST http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Temporary Integration",
    "permissions": ["read"],
    "expiresInDays": 90
  }'
```

### Automatic Expiration

- Keys automatically deactivate when expiration date passes
- Requests with expired keys return 401 Unauthorized
- Expired keys still appear in list but show `isActive: false`

### Rotating Keys

Best practice for key rotation:

1. Create new API key
2. Update client app to use new key
3. Test thoroughly
4. Delete old key
5. Monitor for failures

## IP Whitelisting

Restrict API key usage to specific IP addresses.

**Note**: IP restriction is optional. If empty, key works from any IP.

```bash
curl -X POST http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Office Network Only",
    "permissions": ["read", "write"],
    "allowedIPs": ["203.0.113.45", "203.0.113.46"]
  }'
```

## Security Best Practices

### 1. Protect Your Keys
- Never commit API keys to version control
- Use environment variables:
  ```bash
  export FLEETPRO_API_KEY="your-api-key"
  ```
- Use `.env` files (but add `.env` to `.gitignore`):
  ```
  FLEETPRO_API_KEY=your-api-key
  ```

### 2. Use Minimal Permissions
- Always use the minimum permissions needed
- Prefer `read` over `write` when possible
- Use dedicated keys for different purposes

### 3. Set Expiration Dates
- Rotate keys every 90 days
- Set shorter expiration for temporary integrations
- Monitor expiration dates to prevent outages

### 4. Monitor Usage
- Check API key usage regularly
- Watch for unusual activity
- Set up alerts for high error rates

### 5. Revoke Unused Keys
- Delete keys you're no longer using
- Revoke compromised keys immediately
- Keep inventory of active keys

### 6. Use HTTPS
- Always use HTTPS (not HTTP)
- API keys should only travel over encrypted connections
- Never log or display full API keys

## Integration Examples

### Python Example

```python
import requests
from dotenv import load_dotenv
import os

load_dotenv()
api_key = os.getenv('FLEETPRO_API_KEY')

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

# Get all vehicles
response = requests.get(
    'http://localhost:5050/api/vehicles',
    headers=headers
)

if response.status_code == 200:
    vehicles = response.json()
    print(f"Found {len(vehicles)} vehicles")
elif response.status_code == 429:
    print("Rate limit exceeded")
elif response.status_code == 401:
    print("Invalid API key")
else:
    print(f"Error: {response.status_code}")
```

### JavaScript/Node.js Example

```javascript
const fetch = require('node-fetch');

const apiKey = process.env.FLEETPRO_API_KEY;

async function getVehicles() {
  const response = await fetch('http://localhost:5050/api/vehicles', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 200) {
    const vehicles = await response.json();
    console.log(`Found ${vehicles.length} vehicles`);
  } else if (response.status === 429) {
    console.error('Rate limit exceeded');
  } else if (response.status === 401) {
    console.error('Invalid API key');
  }
}

getVehicles();
```

### cURL Example

```bash
#!/bin/bash

API_KEY="your-api-key-here"

# Get vehicles
curl -X GET "http://localhost:5050/api/vehicles" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json"

# Create booking
curl -X POST "http://localhost:5050/api/bookings" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "123",
    "customerId": "456",
    "startDate": "2026-08-18"
  }'
```

## Troubleshooting

### 401 Unauthorized

**Causes:**
- Missing API key
- Invalid API key format
- Expired API key
- Revoked key

**Solutions:**
```bash
# Check key is active
curl http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <session-token>"

# Create new key
curl -X POST http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Key", "permissions": ["read"]}'
```

### 403 Forbidden

**Causes:**
- Insufficient permissions
- IP address not whitelisted

**Solutions:**
- Check key permissions: `GET /api/api-keys/:keyId`
- Update permissions if needed: `PUT /api/api-keys/:keyId`
- Whitelist your IP address

### 429 Too Many Requests

**Cause:**
- Rate limit exceeded

**Solution:**
```bash
# Check usage
curl "http://localhost:5050/api/api-keys/:keyId/usage" \
  -H "Authorization: Bearer <session-token>"

# Either wait or upgrade your rate limit
curl -X PUT http://localhost:5050/api/api-keys/:keyId \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"rateLimit": 200}'
```

## Production Checklist

- [ ] API key management endpoints deployed
- [ ] Rate limiting working correctly
- [ ] Usage tracking implemented
- [ ] Expiration cleanup job running
- [ ] IP whitelist tested (if using)
- [ ] Documentation published to customers
- [ ] Error messages clear and helpful
- [ ] Monitoring/alerts set up
- [ ] Rate limit defaults reviewed
- [ ] Customer onboarding includes API keys

## Monitoring

### Key Metrics to Track

1. **Active Keys**: Number of active API keys
2. **Usage Rate**: Requests per minute across all keys
3. **Error Rate**: Percentage of failed requests
4. **Response Time**: Average API response time
5. **Rate Limit Hits**: How often customers hit limits

### Monitoring Queries

```bash
# Get total usage across all keys
curl http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <token>" | jq '.[] | .usageCount' | awk '{sum+=$1} END {print sum}'

# Find most used keys
curl http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <token>" | jq 'sort_by(.usageCount) | reverse | .[0:5]'

# Find expiring keys (next 30 days)
curl http://localhost:5050/api/api-keys \
  -H "Authorization: Bearer <token>" | jq '.[] | select(.expiresAt < now + 30*86400 and .expiresAt > now)'
```

## Limits & Quotas

- **Max API keys per tenant**: 100
- **Max permissions per key**: Unlimited
- **Key expiration**: Max 10 years
- **Rate limit range**: 1-10,000 requests/minute
- **IP whitelist**: Max 100 IPs
- **Key rotation recommended**: Every 90 days

---

**Last Updated**: 2026-08-17  
**Status**: Production Ready  
**Features**: Create, Read, Update, Delete, Usage Tracking, Rate Limiting, IP Whitelist
