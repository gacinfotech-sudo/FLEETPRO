import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FleetPro SaaS API',
      version: '1.0.0',
      description: `
        Enterprise-grade Fleet Management SaaS Platform API.

        ## Authentication

        The API supports two authentication methods:

        1. **Session Authentication** (Web UI)
           - Uses httpOnly cookies
           - Automatic after login

        2. **API Key Authentication** (Programmatic)
           - Generate keys via POST /api/api-keys
           - Provide via Authorization header: "Bearer <key>"
           - Or X-API-Key header
           - Or query parameter: ?api_key=<key>

        ## Rate Limiting

        - Session auth: 1,000 requests/minute per tenant
        - API key auth: Per-key limit (default 100 req/min)
        - Returns HTTP 429 when exceeded

        ## Webhooks

        Real-time event notifications available for:
        - user.created
        - payment.received
        - subscription.changed
        - booking.created
        - invoice.created
        - usage.alert
        - ticket.created
        - tenant.subscription_renewed

        Register webhooks via POST /api/webhooks

        ## Error Handling

        All errors return JSON with this format:
        \`\`\`json
        {
          "error": "Error type",
          "message": "Detailed error message"
        }
        \`\`\`

        ## Pagination

        List endpoints support:
        - \`limit\`: Results per page (default 50)
        - \`skip\`: Number to skip (default 0)

        ## Base URL

        All endpoints are relative to: \`https://api.fleetpro.example.com\`
      `,
      contact: {
        name: 'FleetPro Support',
        email: 'support@fleetpro.example.com',
        url: 'https://fleetpro.example.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://fleetpro.example.com/license',
      },
    },
    servers: [
      {
        url: 'http://localhost:5050',
        description: 'Development server',
      },
      {
        url: 'https://api.fleetpro.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'API Key authentication',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key in header',
        },
        SessionAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Session token from login',
        },
      },
      schemas: {
        Tenant: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            businessName: { type: 'string' },
            email: { type: 'string' },
            subscriptionPlan: { type: 'string', enum: ['starter', 'pro', 'custom'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'client', 'manager'] },
            tenantId: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Vehicle: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            make: { type: 'string' },
            vehicleModel: { type: 'string' },
            licensePlate: { type: 'string' },
            type: { type: 'string', enum: ['economy', 'standard', 'premium', 'luxury', 'suv'] },
            status: { type: 'string', enum: ['available', 'booked', 'maintenance'] },
            pricePerDay: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Driver: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            licenseNumber: { type: 'string' },
            status: { type: 'string', enum: ['available', 'busy', 'off_duty'] },
            rating: { type: 'number', minimum: 0, maximum: 5 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            bookingId: { type: 'string' },
            customerName: { type: 'string' },
            vehicleId: { type: 'string' },
            driverId: { type: 'string' },
            status: { type: 'string', enum: ['confirmed', 'completed', 'cancelled'] },
            totalAmount: { type: 'number' },
            pickupDate: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        APIKey: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            maskedKey: { type: 'string', description: 'Masked key for display' },
            permissions: { type: 'array', items: { type: 'string' } },
            rateLimit: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean' },
          },
        },
        WebhookEndpoint: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            successfulDeliveries: { type: 'number' },
            failedDeliveries: { type: 'number' },
            lastSuccessfulDelivery: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            count: { type: 'number' },
            limit: { type: 'number' },
            skip: { type: 'number' },
          },
        },
      },
    },
  },
  apis: [
    './server/swagger-routes.ts',
    './server/routes.ts',
    './server/routes/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
