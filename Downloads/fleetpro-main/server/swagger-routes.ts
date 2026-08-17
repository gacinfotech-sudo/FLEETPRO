/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and create session
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "admin@example.com"
 *               password:
 *                 type: string
 *                 example: "SecurePassword123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Invalid input
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: End user session
 *     tags: [Authentication]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: List all vehicles for tenant
 *     tags: [Vehicles]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 50 }
 *       - name: skip
 *         in: query
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vehicle'
 *       401:
 *         description: Not authenticated
 *   post:
 *     summary: Create new vehicle
 *     tags: [Vehicles]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [make, type, pricePerDay]
 *             properties:
 *               make:
 *                 type: string
 *                 example: "Toyota"
 *               vehicleModel:
 *                 type: string
 *                 example: "Camry"
 *               licensePlate:
 *                 type: string
 *                 example: "ABC123"
 *               type:
 *                 type: string
 *                 enum: [economy, standard, premium, luxury, suv]
 *               pricePerDay:
 *                 type: number
 *                 example: 50
 *     responses:
 *       201:
 *         description: Vehicle created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     summary: List all drivers for tenant
 *     tags: [Drivers]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of drivers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Driver'
 *   post:
 *     summary: Create new driver
 *     tags: [Drivers]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, licenseNumber]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               licenseNumber:
 *                 type: string
 *               experience:
 *                 type: number
 *     responses:
 *       201:
 *         description: Driver created
 */

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: List all bookings for tenant
 *     tags: [Bookings]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [confirmed, completed, cancelled]
 *     responses:
 *       200:
 *         description: List of bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *   post:
 *     summary: Create new booking
 *     tags: [Bookings]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId, customerName, pickupDate]
 *             properties:
 *               vehicleId:
 *                 type: string
 *               customerName:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *               pickupDate:
 *                 type: string
 *                 format: date-time
 *               returnDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Booking created
 */

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: List all API keys for tenant
 *     tags: [API Keys]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKeys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/APIKey'
 *                 count:
 *                   type: integer
 *   post:
 *     summary: Create new API key
 *     tags: [API Keys]
 *     security:
 *       - SessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Mobile App Integration"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [read, write, admin, '*']
 *               rateLimit:
 *                 type: number
 *                 default: 100
 *               expiresInDays:
 *                 type: number
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     key: { type: string, description: "Only shown once" }
 *                     maskedKey: { type: string }
 *                     name: { type: string }
 *                     permissions: { type: array }
 */

/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: List all webhooks for tenant
 *     tags: [Webhooks]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webhooks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WebhookEndpoint'
 *   post:
 *     summary: Register new webhook
 *     tags: [Webhooks]
 *     security:
 *       - SessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, events]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum:
 *                     - user.created
 *                     - payment.received
 *                     - subscription.changed
 *                     - booking.created
 *                     - invoice.created
 *                     - usage.alert
 *                     - ticket.created
 *     responses:
 *       201:
 *         description: Webhook registered
 */

/**
 * @swagger
 * /api/admin/tenants:
 *   get:
 *     summary: List all tenants (Admin only)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: List of tenants
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 *   post:
 *     summary: Create new tenant (Admin only)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, businessName]
 *             properties:
 *               name:
 *                 type: string
 *               businessName:
 *                 type: string
 *               email:
 *                 type: string
 *               subscriptionPlan:
 *                 type: string
 *                 enum: [starter, pro, custom]
 *     responses:
 *       201:
 *         description: Tenant created
 *       403:
 *         description: Admin access required
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *   post:
 *     summary: Create new user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, password, role]
 *             properties:
 *               userId:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, client, manager]
 *               tenantId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalVehicles: { type: number }
 *                 totalDrivers: { type: number }
 *                 totalBookings: { type: number }
 *                 revenue: { type: number }
 */

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: User notification preferences
 *   put:
 *     summary: Update notification preference
 *     tags: [Notifications]
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               frequency:
 *                 type: string
 *                 enum: [immediate, daily, weekly, never]
 *     responses:
 *       200:
 *         description: Preference updated
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 service: { type: string }
 *                 database: { type: string }
 *       503:
 *         description: Service unavailable
 */
