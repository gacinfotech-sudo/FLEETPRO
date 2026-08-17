import { z } from 'zod';

// MongoDB Tenant Schema (V1 - Backward Compatibility)
export const mongoTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessName: z.string().min(1, 'Business name is required'),
  email: z.preprocess((val) => val === "" ? undefined : val, z.string().email().optional()),
  phone: z.string().optional().transform(val => val === "" ? undefined : val),
  address: z.string().optional().transform(val => val === "" ? undefined : val),
  isActive: z.boolean().default(true),
  subscriptionPlan: z.enum(['starter', 'pro', 'custom']).default('starter'),
  limits: z.object({
    vehicles: z.number().min(1).default(6),
    drivers: z.number().min(1).default(3),
    managers: z.number().min(1).default(1)
  }).default({ vehicles: 6, drivers: 3, managers: 1 })
});

// MongoDB Tenant Schema (V2 - Enterprise Grade)
export const mongoTenantSchemaV2 = z.object({
  // BASIC INFO
  name: z.string().min(1, 'Name is required').max(255),
  businessName: z.string().min(1, 'Business name is required').max(255),
  email: z.preprocess((val) => val === "" ? undefined : val, z.string().email().optional()),
  phone: z.string().optional().transform(val => val === "" ? undefined : val),
  address: z.string().optional().max(500),
  isActive: z.boolean().default(true),
  maxManagers: z.number().min(1).default(5).optional(),

  // SUBSCRIPTION & BILLING
  subscriptionPlan: z.enum(['starter', 'pro', 'enterprise', 'custom']).default('starter'),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']).default('monthly').optional(),
  billingEmail: z.string().email().optional(),
  taxId: z.string().optional(),
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'upi']).optional(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional()
  }).optional(),
  invoicePrefix: z.string().default('INV').optional(),
  trialEndsAt: z.date().optional(),

  // BRANDING & CUSTOMIZATION
  branding: z.object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/, 'Invalid color format').default('#007AFF').optional(),
    secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/, 'Invalid color format').default('#34C759').optional(),
    theme: z.enum(['light', 'dark', 'auto']).default('auto').optional(),
    customDomain: z.string().optional(),
    faviconUrl: z.string().url().optional()
  }).optional(),

  // CONFIGURATION
  timezone: z.string().default('Asia/Kolkata').optional(),
  currency: z.string().length(3).default('INR').optional(),
  language: z.string().default('en').optional(),
  dateFormat: z.string().default('DD/MM/YYYY').optional(),

  // FEATURES & ENTITLEMENTS
  features: z.object({
    apiAccess: z.boolean().default(false).optional(),
    customReports: z.boolean().default(false).optional(),
    advancedAnalytics: z.boolean().default(false).optional(),
    whiteLabel: z.boolean().default(false).optional(),
    multiUserAdmin: z.boolean().default(false).optional(),
    sso: z.boolean().default(false).optional(),
    webhooks: z.boolean().default(false).optional()
  }).optional(),

  // API & INTEGRATION
  apiKeys: z.array(z.object({
    name: z.string().min(1),
    key: z.string().min(32),
    secret: z.string().min(32).optional(),
    createdAt: z.date().default(new Date()),
    lastUsed: z.date().optional(),
    active: z.boolean().default(true)
  })).optional(),
  webhookUrl: z.string().url().optional(),
  webhookEvents: z.array(z.string()).optional(),

  // SECURITY
  security: z.object({
    twoFactorEnabled: z.boolean().default(false).optional(),
    ipWhitelist: z.array(z.string().ip()).optional(),
    encryptionEnabled: z.boolean().default(true).optional(),
    ssoProvider: z.enum(['google', 'microsoft', 'okta']).optional(),
    passwordPolicy: z.object({
      minLength: z.number().min(6).max(32).default(8).optional(),
      requireUppercase: z.boolean().default(true).optional(),
      requireNumbers: z.boolean().default(true).optional(),
      requireSpecialChars: z.boolean().default(false).optional()
    }).optional()
  }).optional(),

  // COMPLIANCE
  compliance: z.object({
    gstRegistered: z.boolean().default(false).optional(),
    gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format').optional(),
    businessRegistration: z.string().optional(),
    termsAcceptedAt: z.date().optional(),
    dataRetentionDays: z.number().min(7).default(365).optional(),
    gdprCompliant: z.boolean().default(false).optional()
  }).optional(),

  // USAGE TRACKING
  usageStats: z.object({
    activeUsers: z.number().min(0).default(0).optional(),
    apiCallsThisMonth: z.number().min(0).default(0).optional(),
    storageUsedMB: z.number().min(0).default(0).optional(),
    lastCalculatedAt: z.date().default(new Date()).optional()
  }).optional(),

  // LIMITS
  limits: z.object({
    vehicles: z.number().min(1).default(6),
    drivers: z.number().min(1).default(3),
    managers: z.number().min(1).default(1),
    users: z.number().min(1).default(5).optional(),
    apiCallsPerMonth: z.number().min(100).default(10000).optional(),
    storageGB: z.number().min(1).default(10).optional()
  }).default({ vehicles: 6, drivers: 3, managers: 1, users: 5, apiCallsPerMonth: 10000, storageGB: 10 }),

  // METADATA
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),

  // TIMESTAMPS
  createdAt: z.date().default(new Date()).optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  lastBilledAt: z.date().optional()
});

export type MongoTenantV2 = z.infer<typeof mongoTenantSchemaV2>;

// MongoDB User Schema
export const mongoUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'client']).default('client'),
  tenantId: z.string().optional(),
  isActive: z.boolean().default(true),
  mustResetPassword: z.boolean().default(false),
  // Security fields
  lastLogin: z.date().optional(),
  lastLoginIP: z.string().optional(),
  lastLoginUserAgent: z.string().optional(),
  is2FAEnabled: z.boolean().default(false),
  passwordLastChanged: z.date().optional(),
  loginAttempts: z.number().default(0),
  lockedUntil: z.date().optional()
});

// MongoDB Vehicle Schema
export const mongoVehicleSchema = z.object({
  tenantId: z.string(),
  make: z.string().min(1, 'Car name is required'),
  vehicleModel: z.string().optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  licensePlate: z.string().optional(),
  registrationNumber: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  type: z.enum(['economy', 'standard', 'premium', 'luxury', 'suv', 'sedan', 'hatchback', 'coupe', 'convertible']).default('economy'),
  vehicleType: z.string().optional(),
  status: z.enum(['available', 'booked', 'maintenance']).default('available'),
  features: z.array(z.string()).default([]),
  pricePerDay: z.number().min(0).default(0),
  pricePerHour: z.number().min(0).default(0),
  pricePerKm: z.number().min(0).default(0),
  ratePerDay: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  model: z.string().optional()
});

// MongoDB Driver Schema
export const mongoDriverSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional(),
  licenseNumber: z.string().min(1, 'License number is required'),
  experience: z.number().int().min(0),
  rating: z.number().min(1).max(5).optional(),
  status: z.enum(['available', 'busy', 'off_duty']).default('available'),
  languages: z.array(z.string()).default([]),
  // Additional fields
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  aadharNumber: z.string().optional(),
  panNumber: z.string().optional(),
  dateOfJoining: z.string().optional()
});

// MongoDB Booking Schema
export const mongoBookingSchema = z.object({
  tenantId: z.string(),
  bookingId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Customer phone is required'),
  customerEmail: z.string().email().optional(),
  vehicleId: z.string(),
  driverId: z.string().optional(),
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  dropoffLocation: z.string().optional(),
  pickupDate: z.string(),
  returnDate: z.string().optional(),
  pickupTime: z.string().optional(),
  returnTime: z.string().optional(),
  bookingType: z.enum(['self_drive', 'with_driver', 'one_way', 'round_trip', 'local', 'airport']),
  pricingType: z.enum(['day', 'km']).optional(),
  totalKilometers: z.number().min(0).optional(),
  status: z.enum(['confirmed', 'completed', 'cancelled']).default('confirmed'),
  totalAmount: z.number().positive(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded']).default('pending'),
  notes: z.string().optional(),
  tollCharges: z.number().min(0).default(0),
  parkingCharges: z.number().min(0).default(0),
  petrolCharges: z.number().min(0).default(0),
  dieselCharges: z.number().min(0).default(0),
  cngCharges: z.number().min(0).default(0),
  miscellaneousAmount: z.number().min(0).default(0),
  miscellaneousDescription: z.string().optional(),
  cancellationReason: z.string().optional(),
  // Third-party driver fields
  useThirdPartyDriver: z.boolean().default(false),
  thirdPartyDriverName: z.string().optional(),
  thirdPartyDriverCharges: z.number().min(0).default(0),
  thirdPartyDriverPhone: z.string().optional(),
  thirdPartyDriverAddress: z.string().optional()
});

export type MongoTenant = z.infer<typeof mongoTenantSchema>;
export type MongoUser = z.infer<typeof mongoUserSchema>;
export type MongoVehicle = z.infer<typeof mongoVehicleSchema>;
export type MongoDriver = z.infer<typeof mongoDriverSchema>;
export type MongoBooking = z.infer<typeof mongoBookingSchema>;