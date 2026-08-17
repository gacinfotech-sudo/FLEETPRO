import { z } from 'zod';

// MongoDB Tenant Schema
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