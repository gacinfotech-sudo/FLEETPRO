# API Documentation - Swagger/OpenAPI Guide

## Overview

FleetPro provides comprehensive, auto-generated API documentation using Swagger/OpenAPI 3.0. The documentation is interactive, allowing developers to test endpoints directly without writing code.

## Accessing API Documentation

### Web UI

Open your browser and navigate to:
```
http://localhost:5050/api/docs
```

### Raw Swagger JSON

For programmatic access to the OpenAPI spec:
```
http://localhost:5050/api/docs/swagger.json
```

## Documentation Features

### 1. Interactive Swagger UI

- **Browse Endpoints**: Organized by resource (Vehicles, Drivers, Bookings, etc.)
- **View Schemas**: See request/response data structures
- **Try It Out**: Test endpoints directly from the browser
- **Authentication**: Built-in support for API key and session auth
- **Copy Code**: Generate code samples in multiple languages

### 2. Full API Coverage

All 104+ endpoints documented including:
- Authentication (login, logout, session management)
- Vehicles (CRUD operations)
- Drivers (management and assignment)
- Bookings (creation and tracking)
- Users (management and permissions)
- Tenants (admin only)
- API Keys (generation and management)
- Webhooks (registration and management)
- Notifications (email and preferences)
- Admin features (9 dashboards)

### 3. Request/Response Examples

Every endpoint includes:
- Required and optional parameters
- Example request payloads
- Success response formats
- Error response formats
- HTTP status codes

### 4. Authentication Documentation

Clear examples for:
- **Session Authentication** (Web UI)
  ```bash
  curl -H "Authorization: Bearer <session-token>"
  ```

- **API Key Authentication**
  ```bash
  curl -H "Authorization: Bearer <api-key>"
  # or
  curl -H "X-API-Key: <api-key>"
  # or
  curl "?api_key=<api-key>"
  ```

## Using the Swagger UI

### 1. View an Endpoint

1. Click on an endpoint name to expand it
2. See the method (GET, POST, etc.), path, and description
3. Review required and optional parameters
4. See example request/response

### 2. Test an Endpoint

1. Click "Try it out"
2. Fill in required parameters
3. Optionally add headers or request body
4. Click "Execute"
5. View the response

### 3. Copy Code

For any endpoint:
1. Click the language dropdown in the response section
2. Select desired language (Python, JavaScript, cURL, etc.)
3. Copy the generated code sample

## API Organization

### Authentication Endpoints
```
POST   /api/auth/login          - Login with credentials
POST   /api/auth/logout         - End session
GET    /api/auth/me             - Get current user
POST   /api/auth/reset-password - Reset password
```

### Vehicle Management
```
GET    /api/vehicles            - List vehicles
POST   /api/vehicles            - Create vehicle
GET    /api/vehicles/:id        - Get vehicle details
PUT    /api/vehicles/:id        - Update vehicle
DELETE /api/vehicles/:id        - Delete vehicle
GET    /api/vehicles/available  - List available vehicles
```

### Driver Management
```
GET    /api/drivers             - List drivers
POST   /api/drivers             - Create driver
GET    /api/drivers/:id         - Get driver details
PUT    /api/drivers/:id         - Update driver
DELETE /api/drivers/:id         - Delete driver
GET    /api/drivers/available   - List available drivers
```

### Booking Management
```
GET    /api/bookings            - List bookings
POST   /api/bookings            - Create booking
GET    /api/bookings/:id        - Get booking details
PUT    /api/bookings/:id        - Update booking
POST   /api/bookings/:id/cancel - Cancel booking
```

### API Key Management
```
GET    /api/api-keys            - List API keys
POST   /api/api-keys            - Create API key
GET    /api/api-keys/:id        - Get key details
PUT    /api/api-keys/:id        - Update key
POST   /api/api-keys/:id/revoke - Revoke key
DELETE /api/api-keys/:id        - Delete key
GET    /api/api-keys/:id/usage  - Get usage statistics
```

### Webhook Management
```
GET    /api/webhooks            - List webhooks
POST   /api/webhooks            - Register webhook
GET    /api/webhooks/logs       - Get delivery logs
GET    /api/webhooks/stats      - Get statistics
PUT    /api/webhooks/:id        - Update webhook
DELETE /api/webhooks/:id        - Delete webhook
```

### Notifications
```
GET    /api/notifications/preferences      - Get preferences
PUT    /api/notifications/preferences/:id  - Update preference
GET    /api/notifications/history          - View email history
```

### Admin Endpoints
```
GET    /api/admin/tenants                  - List all tenants
POST   /api/admin/tenants                  - Create tenant
GET    /api/admin/users                    - List all users
POST   /api/admin/users                    - Create user
GET    /api/admin/security/stats           - Security metrics
GET    /api/admin/notifications/retry-failed - Retry emails
```

## Security Features

### Authentication Schemes

The API supports multiple authentication methods:

1. **Session Authentication**
   - Used by web UI
   - Automatic after login
   - httpOnly cookies
   - 30-day expiration

2. **API Key Authentication**
   - For programmatic access
   - Generate via POST /api/api-keys
   - Three input methods (Bearer, Header, Query)
   - Granular permissions (read, write, admin)

3. **Rate Limiting**
   - Session: 1,000 req/min per tenant
   - API Key: Configurable (1-10,000 req/min)
   - Returns HTTP 429 when exceeded

### Security Headers

All responses include:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

## Error Handling

### Standard Error Format

```json
{
  "error": "Invalid Request",
  "message": "The vehicleId field is required"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

## Pagination

List endpoints support pagination:

```bash
# Get page 1
curl "http://localhost:5050/api/vehicles?limit=50&skip=0"

# Get page 2
curl "http://localhost:5050/api/vehicles?limit=50&skip=50"
```

Response includes:
```json
{
  "data": [...],
  "count": 1000,
  "limit": 50,
  "skip": 0
}
```

## Data Schemas

### Common Fields

All resources include:
- `_id`: Unique identifier
- `createdAt`: Creation timestamp (ISO 8601)
- `updatedAt`: Last update timestamp (ISO 8601)

### Tenant Schema

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Acme Fleet",
  "businessName": "Acme Rentals Inc",
  "email": "admin@acmerentals.com",
  "phone": "+1-555-0100",
  "subscriptionPlan": "pro",
  "isActive": true,
  "createdAt": "2026-08-01T10:30:00Z"
}
```

### Vehicle Schema

```json
{
  "_id": "507f1f77bcf86cd799439012",
  "tenantId": "507f1f77bcf86cd799439011",
  "make": "Toyota",
  "vehicleModel": "Camry",
  "licensePlate": "ABC-123",
  "type": "sedan",
  "status": "available",
  "pricePerDay": 50,
  "pricePerHour": 5,
  "pricePerKm": 0.50,
  "createdAt": "2026-08-01T10:30:00Z"
}
```

### Driver Schema

```json
{
  "_id": "507f1f77bcf86cd799439013",
  "tenantId": "507f1f77bcf86cd799439011",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+1-555-0101",
  "licenseNumber": "DL123456",
  "experience": 5,
  "status": "available",
  "rating": 4.8,
  "createdAt": "2026-08-01T10:30:00Z"
}
```

### Booking Schema

```json
{
  "_id": "507f1f77bcf86cd799439014",
  "tenantId": "507f1f77bcf86cd799439011",
  "bookingId": "BK001",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "vehicleId": "507f1f77bcf86cd799439012",
  "driverId": "507f1f77bcf86cd799439013",
  "status": "confirmed",
  "totalAmount": 500,
  "paymentStatus": "paid",
  "pickupDate": "2026-08-18T09:00:00Z",
  "returnDate": "2026-08-20T09:00:00Z",
  "createdAt": "2026-08-17T10:30:00Z"
}
```

## Integration Examples

### Using Swagger UI for Testing

1. Open http://localhost:5050/api/docs
2. Click "Authorize" button
3. Enter your API key or session token
4. Click "Try it out" on any endpoint
5. Fill in parameters
6. Click "Execute"
7. View response

### Using Swagger JSON in Client Generation

Generate API clients in 50+ languages:

```bash
# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:5050/api/docs/swagger.json \
  -g python \
  -o ./fleetpro-python-client

# Generate JavaScript client
openapi-generator-cli generate \
  -i http://localhost:5050/api/docs/swagger.json \
  -g javascript \
  -o ./fleetpro-js-client
```

### Using Swagger in Development

```javascript
// In your IDE/editor with OpenAPI support:
import axios from 'axios';

// Use the Swagger spec URL for autocomplete
const api = axios.create({
  baseURL: 'http://localhost:5050/api'
});

// Your IDE will show available endpoints and parameters
```

## Best Practices

### 1. Always Include Authentication

Most endpoints require authentication:
```bash
curl -H "Authorization: Bearer <your-api-key>" \
  http://localhost:5050/api/vehicles
```

### 2. Handle Errors

Always check for error responses:
```json
{
  "error": "Rate Limit Exceeded",
  "message": "Max 100 requests per minute"
}
```

### 3. Use Pagination for Large Lists

Don't fetch all data at once:
```bash
# Bad - might get millions of records
curl http://localhost:5050/api/bookings

# Good - paginate
curl "http://localhost:5050/api/bookings?limit=100&skip=0"
```

### 4. Check Rate Limit Headers

Response headers include rate limit info:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1692316800
```

## Troubleshooting

### "Swagger UI not loading"
- Ensure `swagger-ui-express` package is installed
- Check that server is running on correct port
- Try clearing browser cache

### "Authorize button not working"
- Ensure authentication is configured in swagger-config.ts
- Check that your API key/token is valid
- Try in a private/incognito browser window

### "Endpoint not documented"
- Check if endpoint exists in routes.ts
- Ensure JSDoc comments follow Swagger format
- Restart server after adding new endpoint documentation

## Production Deployment

### Security Considerations

1. **Disable Swagger UI in Production** (optional)
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     // Don't serve Swagger UI
   }
   ```

2. **Use HTTPS**
   - All API calls should use HTTPS
   - Swagger UI should only load over HTTPS

3. **Protect Sensitive Endpoints**
   - Ensure admin endpoints require authentication
   - Test rate limiting in production

4. **Keep Docs Updated**
   - JSDoc comments are source of truth
   - Update docs when API changes
   - Review docs before releases

## API Versioning

Current API version: **1.0.0**

Version updates follow semantic versioning:
- **1.0.0**: Initial release
- **1.1.0**: New features (backward compatible)
- **2.0.0**: Breaking changes

The OpenAPI spec includes the version number automatically.

## Support

For API support:
- Email: api-support@fleetpro.example.com
- Docs: https://docs.fleetpro.example.com
- Community: https://community.fleetpro.example.com

---

**Last Updated**: 2026-08-17  
**API Version**: 1.0.0  
**OpenAPI Version**: 3.0.0  
**Documentation Status**: Complete (104+ endpoints)
