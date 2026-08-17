import mongoose, { Schema, Document } from 'mongoose';

// Interfaces for TypeScript
export interface ITenant extends Document {
  // BASIC INFO (existing)
  name: string;
  businessName: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  maxManagers?: number;

  // SUBSCRIPTION & BILLING (NEW)
  subscriptionPlan: 'starter' | 'pro' | 'enterprise' | 'custom';
  billingCycle?: 'monthly' | 'yearly' | 'quarterly';
  billingEmail?: string;
  taxId?: string;
  paymentMethod?: 'credit_card' | 'bank_transfer' | 'upi';
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  invoicePrefix?: string;
  trialEndsAt?: Date;

  // BRANDING & CUSTOMIZATION (NEW)
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    theme?: 'light' | 'dark' | 'auto';
    customDomain?: string;
    faviconUrl?: string;
  };

  // CONFIGURATION (NEW)
  timezone?: string;
  currency?: string;
  language?: string;
  dateFormat?: string;

  // FEATURES & ENTITLEMENTS (NEW)
  features?: {
    apiAccess?: boolean;
    customReports?: boolean;
    advancedAnalytics?: boolean;
    whiteLabel?: boolean;
    multiUserAdmin?: boolean;
    sso?: boolean;
    webhooks?: boolean;
  };

  // API & INTEGRATION (NEW)
  apiKeys?: Array<{
    name: string;
    key: string;
    secret?: string;
    createdAt: Date;
    lastUsed?: Date;
    active: boolean;
  }>;
  webhookUrl?: string;
  webhookEvents?: string[];

  // SECURITY (NEW)
  security?: {
    twoFactorEnabled?: boolean;
    ipWhitelist?: string[];
    encryptionEnabled?: boolean;
    ssoProvider?: 'google' | 'microsoft' | 'okta';
    passwordPolicy?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
    };
  };

  // COMPLIANCE (NEW)
  compliance?: {
    gstRegistered?: boolean;
    gstNumber?: string;
    businessRegistration?: string;
    termsAcceptedAt?: Date;
    dataRetentionDays?: number;
    gdprCompliant?: boolean;
  };

  // USAGE TRACKING (NEW)
  usageStats?: {
    activeUsers?: number;
    apiCallsThisMonth?: number;
    storageUsedMB?: number;
    lastCalculatedAt?: Date;
  };

  // LIMITS (updated)
  limits: {
    vehicles: number;
    drivers: number;
    managers: number;
    users?: number;
    apiCallsPerMonth?: number;
    storageGB?: number;
  };

  // METADATA (NEW)
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;

  // TIMESTAMPS (NEW)
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  lastBilledAt?: Date;
}

export interface IUser extends Document {
  userId: string;
  password: string;
  role: 'admin' | 'client' | 'manager';
  tenantId?: mongoose.Types.ObjectId;
  sessionId?: string;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    loginTime?: Date;
  };
  lastLogin?: Date;
  lastLoginIP?: string;
  lastLoginUserAgent?: string;
  loginAttempts: number;
  failedLoginAttempts: number;
  accountLocked: boolean;
  lockoutTime?: Date;
  isActive: boolean;
  mustResetPassword: boolean;
  hasCompletedOnboarding: boolean; // Track onboarding completion for new users
  createdBy?: string; // userId of who created this user
  permissions: string[]; // Array of permission strings
  businessDetails?: {
    businessName: string;
    ownerName: string;
    businessAddress: string;
    gstNumber?: string;
    businessEmail: string;
    businessPhone: string;
    logoUrl?: string;
    signatureUrl?: string;
  };
  createdAt: Date;
}

export interface IVehicle extends Document {
  tenantId: mongoose.Types.ObjectId;
  make: string; // Only car name is required
  vehicleModel?: string; // Optional
  year?: number; // Optional
  licensePlate?: string; // Optional
  capacity?: number; // Optional
  type: 'economy' | 'standard' | 'premium' | 'luxury' | 'suv' | 'sedan' | 'hatchback' | 'coupe' | 'convertible';
  status: 'available' | 'booked' | 'maintenance';
  features: string[];
  pricePerDay: number;
  pricePerHour: number;
  pricePerKm: number;
  color?: string;
  fuelType?: string;
  transmission?: string;
  createdAt: Date;
}

export interface IDriver extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  licenseNumber: string;
  experience: number;
  rating?: number;
  status: 'available' | 'busy' | 'off_duty';
  languages?: string[];
  // Additional fields
  permanentAddress?: string;
  currentAddress?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  aadharNumber?: string;
  panNumber?: string;
  dateOfJoining?: Date;
  createdAt: Date;
}

export interface IBooking extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  vehicleId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  pickupLocation: string;
  dropoffLocation?: string;
  pickupDate: Date;
  returnDate?: Date;
  pickupTime?: string;
  returnTime?: string;
  bookingType: 'self_drive' | 'with_driver' | 'one_way' | 'round_trip' | 'local' | 'airport';
  pricingType?: 'day' | 'km';
  totalKilometers?: number;
  status: 'confirmed' | 'completed' | 'cancelled';
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  notes?: string;
  tollCharges?: number;
  parkingCharges?: number;
  petrolCharges?: number;
  dieselCharges?: number;
  cngCharges?: number;
  miscellaneousAmount?: number;
  miscellaneousDescription?: string;
  cancellationReason?: string;
  // Third-party driver fields
  useThirdPartyDriver?: boolean;
  thirdPartyDriverName?: string;
  thirdPartyDriverCharges?: number;
  thirdPartyDriverPhone?: string;
  thirdPartyDriverAddress?: string;
  createdBy?: {
    userId: string;
    role: string;
  };
  createdAt: Date;
}

export interface IExpense extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  category: 'maintenance' | 'damage' | 'tires' | 'fuel' | 'other';
  amount: number;
  date: Date;
  description?: string;
  attachmentUrl?: string;
  createdBy?: {
    userId: string;
    role: string;
  };
  createdAt: Date;
}

export interface IDriverSalary extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  baseSalary: number;
  incentives?: number;
  deductions?: number;
  netSalary?: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
  month: number; // 1-12
  year: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISalaryHistory extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  salaryMasterId?: mongoose.Types.ObjectId; // Reference to DriverSalary if applicable
  changeType: 'hike' | 'adjustment' | 'deduction' | 'incentive_change' | 'initial_setup';
  previousValue: {
    baseSalary?: number;
    incentives?: number;
    deductions?: number;
    netSalary?: number;
  };
  newValue: {
    baseSalary?: number;
    incentives?: number;
    deductions?: number;
    netSalary?: number;
  };
  changeAmount?: number; // Percentage or absolute amount of change
  percentageChange?: number; // If applicable
  reason?: string; // Why the change was made
  notes?: string;
  appliedFrom: Date; // When does this change take effect
  createdBy: {
    userId: string;
    userName: string;
    role: string;
  };
  approvedBy?: {
    userId: string;
    userName: string;
    approvalDate: Date;
  };
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'applied';
  attachmentUrl?: string; // For supporting documents (offer letter, etc)
  createdAt: Date; // Immutable timestamp
}

export interface ISalaryAuditTrail extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  salaryHistoryId?: mongoose.Types.ObjectId; // Reference to SalaryHistory
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'applied' | 'viewed' | 'exported';
  actionDetails: {
    fieldChanged?: string;
    oldValue?: any;
    newValue?: any;
    changeDescription?: string;
  };
  actor: {
    userId: string;
    userName: string;
    role: string;
    department?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  severity: 'low' | 'medium' | 'high'; // For critical changes
  tags?: string[]; // For categorizing (e.g., 'approval_flow', 'bulk_update')
  createdAt: Date; // Immutable
}

export interface IAttendance extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  date: Date; // Attendance date (YYYY-MM-DD equivalent)
  status: 'BOOKING_SERVE' | 'IDLE_AVAILABLE' | 'LEAVE' | 'ABSENT' | 'MANUAL_OVERRIDE' | 'present' | 'absent';
  checkInTime?: Date; // When driver checked in
  checkOutTime?: Date; // When driver checked out
  bookingId?: mongoose.Types.ObjectId; // Reference to booking if on BOOKING_SERVE
  leaveType?: 'sick' | 'casual' | 'earned' | 'unpaid' | 'emergency'; // For LEAVE status
  totalHours?: number; // Total hours worked
  workHours?: number; // Daily working hours
  notes?: string; // Additional notes
  salaryCutoffAmount?: number; // Daily salary cutoff for absence
  autoMarked: boolean; // Whether this was auto-marked by automation service
  markedBy?: {
    userId: string;
    userName: string;
    role: string;
  }; // Who manually marked this if autoMarked is false
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveType extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string; // e.g., 'Casual Leave', 'Sick Leave', 'Paid Leave'
  daysPerYear: number; // Total days available per year
  requiresApproval: boolean; // Whether manager approval is required
  isNonDeductible: boolean; // If true, doesn't deduct from salary
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDriverLeave extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  leaveType: mongoose.Types.ObjectId; // Reference to LeaveType
  startDate: Date;
  endDate: Date;
  days: number; // Number of days requested
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
  approvedBy?: {
    userId: string;
    userName: string;
    approvalDate: Date;
  };
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveAccrual extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  leaveType: mongoose.Types.ObjectId; // Reference to LeaveType
  accrued: number; // Total days accrued
  used: number; // Total days used
  balance: number; // Remaining days (accrued - used)
  year: number; // Financial year
  lastUpdated: Date;
  createdAt: Date;
}

export interface IOnboardingStep extends Document {
  name: string; // Step name
  description: string; // Step description
  stepNumber: number; // 1-15
  required: boolean; // Whether mandatory
  documentType?: 'aadhar' | 'pan' | 'license' | 'medical' | 'certificate' | 'none'; // Type of document
  completedAt?: Date; // When completed
  completedBy?: {
    userId: string;
    userName: string;
  };
  notes?: string; // Manager/admin notes
  attachmentUrl?: string; // For document uploads
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
}

export interface IOnboardingChecklist extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  steps: IOnboardingStep[]; // Array of onboarding steps
  status: 'in_progress' | 'completed' | 'paused';
  completedAt?: Date; // When all steps completed
  completedBy?: {
    userId: string;
    userName: string;
    role: string;
  };
  overallProgress: number; // 0-100 percentage
  notes?: string; // Admin notes
  createdAt: Date;
  updatedAt: Date;
}

// Tenant Schema (V2 - Enterprise Grade)
const TenantSchema = new Schema<ITenant>({
  // BASIC INFO
  name: { type: String, required: true },
  businessName: { type: String, required: true },
  email: { type: String, sparse: true },
  phone: { type: String },
  address: { type: String },
  isActive: { type: Boolean, default: true },
  maxManagers: { type: Number, default: 5 },

  // SUBSCRIPTION & BILLING
  subscriptionPlan: {
    type: String,
    enum: ['starter', 'pro', 'enterprise', 'custom'],
    default: 'starter'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'quarterly'],
    default: 'monthly'
  },
  billingEmail: { type: String },
  taxId: { type: String },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'upi']
  },
  billingAddress: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String }
  },
  invoicePrefix: { type: String, default: 'INV' },
  trialEndsAt: { type: Date },

  // BRANDING & CUSTOMIZATION
  branding: {
    logoUrl: { type: String },
    primaryColor: { type: String, default: '#007AFF' },
    secondaryColor: { type: String, default: '#34C759' },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    customDomain: { type: String },
    faviconUrl: { type: String }
  },

  // CONFIGURATION
  timezone: { type: String, default: 'Asia/Kolkata' },
  currency: { type: String, default: 'INR' },
  language: { type: String, default: 'en' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },

  // FEATURES & ENTITLEMENTS
  features: {
    apiAccess: { type: Boolean, default: false },
    customReports: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
    multiUserAdmin: { type: Boolean, default: false },
    sso: { type: Boolean, default: false },
    webhooks: { type: Boolean, default: false }
  },

  // API & INTEGRATION
  apiKeys: [{
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    secret: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastUsed: { type: Date },
    active: { type: Boolean, default: true }
  }],
  webhookUrl: { type: String },
  webhookEvents: [{ type: String }],

  // SECURITY
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    ipWhitelist: [{ type: String }],
    encryptionEnabled: { type: Boolean, default: true },
    ssoProvider: {
      type: String,
      enum: ['google', 'microsoft', 'okta']
    },
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireUppercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: false }
    }
  },

  // COMPLIANCE
  compliance: {
    gstRegistered: { type: Boolean, default: false },
    gstNumber: { type: String },
    businessRegistration: { type: String },
    termsAcceptedAt: { type: Date },
    dataRetentionDays: { type: Number, default: 365 },
    gdprCompliant: { type: Boolean, default: false }
  },

  // USAGE TRACKING
  usageStats: {
    activeUsers: { type: Number, default: 0 },
    apiCallsThisMonth: { type: Number, default: 0 },
    storageUsedMB: { type: Number, default: 0 },
    lastCalculatedAt: { type: Date, default: Date.now }
  },

  // LIMITS
  limits: {
    vehicles: { type: Number, default: 6 },
    drivers: { type: Number, default: 3 },
    managers: { type: Number, default: 1 },
    users: { type: Number, default: 5 },
    apiCallsPerMonth: { type: Number, default: 10000 },
    storageGB: { type: Number, default: 10 }
  },

  // METADATA
  metadata: { type: Schema.Types.Mixed },
  tags: [{ type: String }],
  notes: { type: String },

  // TIMESTAMPS
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date }, // For soft deletes
  lastBilledAt: { type: Date }
});

// Tenant Schema Indexes (V2)
TenantSchema.index({ email: 1 }, { sparse: true });
TenantSchema.index({ 'apiKeys.key': 1 }, { sparse: true });
TenantSchema.index({ createdAt: -1 });
TenantSchema.index({ subscriptionPlan: 1, isActive: 1 });
TenantSchema.index({ deletedAt: 1 }, { sparse: true });
TenantSchema.index({ billingCycle: 1, lastBilledAt: 1 });
TenantSchema.index({ tags: 1 });

// User Schema
const UserSchema = new Schema<IUser>({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'client', 'manager'], default: 'client' },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  sessionId: { type: String },
  deviceInfo: {
    userAgent: { type: String },
    ip: { type: String },
    loginTime: { type: Date }
  },
  lastLogin: { type: Date },
  lastLoginIP: { type: String },
  lastLoginUserAgent: { type: String },
  loginAttempts: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0 },
  accountLocked: { type: Boolean, default: false },
  lockoutTime: { type: Date },
  isActive: { type: Boolean, default: true },
  mustResetPassword: { type: Boolean, default: false },
  hasCompletedOnboarding: { type: Boolean, default: false }, // Track onboarding completion
  createdBy: { type: String }, // userId of who created this user
  permissions: { type: [String], default: [] }, // Array of permission strings
  businessDetails: {
    businessName: { type: String },
    ownerName: { type: String },
    businessAddress: { type: String },
    gstNumber: { type: String },
    businessEmail: { type: String },
    businessPhone: { type: String },
    logoUrl: { type: String },
    signatureUrl: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
});

// Vehicle Schema
const VehicleSchema = new Schema<IVehicle>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  make: { type: String, required: true }, // Only car name is required
  vehicleModel: { type: String }, // Optional
  year: { type: Number }, // Optional
  licensePlate: { type: String }, // Optional
  capacity: { type: Number }, // Optional
  type: { 
    type: String, 
    enum: ['economy', 'standard', 'premium', 'luxury', 'suv', 'sedan', 'hatchback', 'coupe', 'convertible'], 
    default: 'economy' 
  },
  status: { 
    type: String, 
    enum: ['available', 'booked', 'maintenance'], 
    default: 'available' 
  },
  features: [{ type: String }],
  pricePerDay: { type: Number, default: 0 }, // Optional with default
  pricePerHour: { type: Number, default: 0 }, // Optional with default
  pricePerKm: { type: Number, default: 0 }, // Optional with default
  color: { type: String },
  fuelType: { type: String },
  transmission: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Driver Schema
const DriverSchema = new Schema<IDriver>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  licenseNumber: { type: String, required: true },
  experience: { type: Number, required: true },
  rating: { type: Number, min: 1, max: 5 },
  status: { 
    type: String, 
    enum: ['available', 'busy', 'off_duty'], 
    default: 'available' 
  },
  languages: [{ type: String }],
  // Additional fields
  permanentAddress: { type: String },
  currentAddress: { type: String },
  maritalStatus: { 
    type: String, 
    enum: ['single', 'married', 'divorced', 'widowed'] 
  },
  aadharNumber: { type: String },
  panNumber: { type: String },
  dateOfJoining: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Booking Schema
const BookingSchema = new Schema<IBooking>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  bookingId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String },
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date },
  pickupTime: { type: String },
  returnTime: { type: String },
  bookingType: { 
    type: String, 
    enum: ['self_drive', 'with_driver', 'one_way', 'round_trip', 'local', 'airport'], 
    required: true 
  },
  pricingType: {
    type: String,
    enum: ['day', 'km'],
    default: 'day'
  },
  totalKilometers: { type: Number, min: 0 },
  status: { 
    type: String, 
    enum: ['confirmed', 'completed', 'cancelled'], 
    default: 'confirmed' 
  },
  totalAmount: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'refunded'], 
    default: 'pending' 
  },
  notes: { type: String },
  tollCharges: { type: Number, default: 0 },
  parkingCharges: { type: Number, default: 0 },
  petrolCharges: { type: Number, default: 0 },
  dieselCharges: { type: Number, default: 0 },
  cngCharges: { type: Number, default: 0 },
  miscellaneousAmount: { type: Number, default: 0 },
  miscellaneousDescription: { type: String },
  cancellationReason: { type: String },
  // Third-party driver fields
  useThirdPartyDriver: { type: Boolean, default: false },
  thirdPartyDriverName: { type: String },
  thirdPartyDriverCharges: { type: Number, default: 0 },
  thirdPartyDriverPhone: { type: String },
  thirdPartyDriverAddress: { type: String },
  createdBy: {
    userId: { type: String, required: false },
    role: { type: String, required: false }
  },
  createdAt: { type: Date, default: Date.now }
} as const);

// Expense Schema
const ExpenseSchema = new Schema<IExpense>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  category: {
    type: String,
    enum: ['maintenance', 'damage', 'tires', 'fuel', 'other'],
    required: true
  },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  attachmentUrl: { type: String },
  createdBy: {
    userId: { type: String, required: false },
    role: { type: String, required: false }
  },
  createdAt: { type: Date, default: Date.now }
});

// Driver Salary Schema
const DriverSalarySchema = new Schema<IDriverSalary>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  baseSalary: { type: Number, required: true, min: 0 },
  incentives: { type: Number, default: 0, min: 0 },
  deductions: { type: Number, default: 0, min: 0 },
  netSalary: { type: Number },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  lastPaymentDate: { type: Date },
  nextPaymentDate: { type: Date },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 2000 },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Salary History Schema (Immutable)
const SalaryHistorySchema = new Schema<ISalaryHistory>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  salaryMasterId: { type: Schema.Types.ObjectId, ref: 'DriverSalary' },
  changeType: {
    type: String,
    enum: ['hike', 'adjustment', 'deduction', 'incentive_change', 'initial_setup'],
    required: true
  },
  previousValue: {
    baseSalary: { type: Number },
    incentives: { type: Number },
    deductions: { type: Number },
    netSalary: { type: Number }
  },
  newValue: {
    baseSalary: { type: Number },
    incentives: { type: Number },
    deductions: { type: Number },
    netSalary: { type: Number }
  },
  changeAmount: { type: Number },
  percentageChange: { type: Number },
  reason: { type: String },
  notes: { type: String },
  appliedFrom: { type: Date, required: true },
  createdBy: {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    role: { type: String, required: true }
  },
  approvedBy: {
    userId: { type: String },
    userName: { type: String },
    approvalDate: { type: Date }
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'applied'],
    default: 'draft'
  },
  attachmentUrl: { type: String },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { timestamps: false }); // Disable automatic timestamps to enforce immutability

// Salary Audit Trail Schema (Immutable)
const SalaryAuditTrailSchema = new Schema<ISalaryAuditTrail>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  salaryHistoryId: { type: Schema.Types.ObjectId, ref: 'SalaryHistory' },
  action: {
    type: String,
    enum: ['created', 'updated', 'approved', 'rejected', 'applied', 'viewed', 'exported'],
    required: true
  },
  actionDetails: {
    fieldChanged: { type: String },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changeDescription: { type: String }
  },
  actor: {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    role: { type: String, required: true },
    department: { type: String }
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  errorMessage: { type: String },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { timestamps: false }); // Disable automatic timestamps to enforce immutability

// Attendance Schema (Auto-marks based on driver state)
const AttendanceSchema = new Schema<IAttendance>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  date: { type: Date, required: true }, // Attendance date
  status: {
    type: String,
    enum: ['BOOKING_SERVE', 'IDLE_AVAILABLE', 'LEAVE', 'ABSENT', 'MANUAL_OVERRIDE', 'present', 'absent'],
    default: 'IDLE_AVAILABLE'
  },
  checkInTime: { type: Date }, // When driver checked in
  checkOutTime: { type: Date }, // When driver checked out
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' }, // Reference to booking if on BOOKING_SERVE
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'earned', 'unpaid', 'emergency']
  }, // For LEAVE status
  totalHours: { type: Number, min: 0 }, // Total hours worked
  workHours: { type: Number, min: 0 }, // Daily working hours
  notes: { type: String },
  salaryCutoffAmount: { type: Number, min: 0 }, // Daily salary cutoff for absence
  autoMarked: { type: Boolean, default: true }, // Whether this was auto-marked by automation service
  markedBy: {
    userId: { type: String },
    userName: { type: String },
    role: { type: String }
  }, // Who manually marked this if autoMarked is false
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Leave Type Schema
const LeaveTypeSchema = new Schema<ILeaveType>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  daysPerYear: { type: Number, required: true, min: 0 },
  requiresApproval: { type: Boolean, default: true },
  isNonDeductible: { type: Boolean, default: false },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Driver Leave Schema
const DriverLeaveSchema = new Schema<IDriverLeave>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  leaveType: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  reason: { type: String, required: true },
  approvedBy: {
    userId: { type: String },
    userName: { type: String },
    approvalDate: { type: Date }
  },
  rejectionReason: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Leave Accrual Schema
const LeaveAccrualSchema = new Schema<ILeaveAccrual>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  leaveType: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  accrued: { type: Number, required: true, default: 0, min: 0 },
  used: { type: Number, required: true, default: 0, min: 0 },
  balance: { type: Number, required: true, default: 0, min: 0 },
  year: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Onboarding Step Nested Schema
const OnboardingStepSchema = new Schema<IOnboardingStep>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  stepNumber: { type: Number, required: true, min: 1, max: 15 },
  required: { type: Boolean, default: true },
  documentType: {
    type: String,
    enum: ['aadhar', 'pan', 'license', 'medical', 'certificate', 'none'],
    default: 'none'
  },
  completedAt: { type: Date },
  completedBy: {
    userId: { type: String },
    userName: { type: String }
  },
  notes: { type: String },
  attachmentUrl: { type: String },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'rejected'],
    default: 'pending'
  }
}, { _id: false });

// Onboarding Checklist Schema
const OnboardingChecklistSchema = new Schema<IOnboardingChecklist>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  steps: { type: [OnboardingStepSchema], default: [] },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'paused'],
    default: 'in_progress'
  },
  completedAt: { type: Date },
  completedBy: {
    userId: { type: String },
    userName: { type: String },
    role: { type: String }
  },
  overallProgress: { type: Number, default: 0, min: 0, max: 100 },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create indexes for better performance
UserSchema.index({ userId: 1 });
UserSchema.index({ sessionId: 1 });
VehicleSchema.index({ tenantId: 1, status: 1 });
DriverSchema.index({ tenantId: 1, status: 1 });
BookingSchema.index({ tenantId: 1, status: 1 });
BookingSchema.index({ bookingId: 1 });
ExpenseSchema.index({ tenantId: 1, date: 1 });
ExpenseSchema.index({ tenantId: 1, vehicleId: 1 });
DriverSalarySchema.index({ tenantId: 1, driverId: 1 });
DriverSalarySchema.index({ tenantId: 1, month: 1, year: 1 });
DriverSalarySchema.index({ driverId: 1, paymentStatus: 1 });

// Salary History Indexes
SalaryHistorySchema.index({ tenantId: 1, driverId: 1 });
SalaryHistorySchema.index({ tenantId: 1, status: 1 });
SalaryHistorySchema.index({ driverId: 1, appliedFrom: 1 });
SalaryHistorySchema.index({ createdAt: -1 }); // For sorting by most recent
SalaryHistorySchema.index({ 'createdBy.userId': 1 });
SalaryHistorySchema.index({ changeType: 1, tenantId: 1 });

// Salary Audit Trail Indexes
SalaryAuditTrailSchema.index({ tenantId: 1, driverId: 1 });
SalaryAuditTrailSchema.index({ createdAt: -1 }); // For timeline views
SalaryAuditTrailSchema.index({ 'actor.userId': 1 });
SalaryAuditTrailSchema.index({ action: 1, severity: 1 });
SalaryAuditTrailSchema.index({ salaryHistoryId: 1 });
SalaryAuditTrailSchema.index({ tags: 1 }); // For filtered searches

// Attendance Indexes
AttendanceSchema.index({ tenantId: 1, driverId: 1, date: 1 }, { unique: false });
AttendanceSchema.index({ tenantId: 1, date: 1 }); // For daily attendance views
AttendanceSchema.index({ driverId: 1, date: -1 }); // For driver history
AttendanceSchema.index({ status: 1, tenantId: 1 }); // For status-based queries
AttendanceSchema.index({ autoMarked: 1 }); // For manual override tracking
AttendanceSchema.index({ createdAt: -1 }); // For recent entries

// Leave Type Indexes
LeaveTypeSchema.index({ tenantId: 1, isActive: 1 });

// Driver Leave Indexes
DriverLeaveSchema.index({ tenantId: 1, driverId: 1 });
DriverLeaveSchema.index({ tenantId: 1, status: 1 });
DriverLeaveSchema.index({ driverId: 1, startDate: 1, endDate: 1 });
DriverLeaveSchema.index({ leaveType: 1, tenantId: 1 });

// Leave Accrual Indexes
LeaveAccrualSchema.index({ tenantId: 1, driverId: 1, year: 1 });
LeaveAccrualSchema.index({ tenantId: 1, leaveType: 1 });
LeaveAccrualSchema.index({ driverId: 1, year: 1 });

// Onboarding Checklist Indexes
OnboardingChecklistSchema.index({ tenantId: 1, driverId: 1 }, { unique: true });
OnboardingChecklistSchema.index({ tenantId: 1, status: 1 });
OnboardingChecklistSchema.index({ driverId: 1, status: 1 });
OnboardingChecklistSchema.index({ 'steps.status': 1, tenantId: 1 });
OnboardingChecklistSchema.index({ createdAt: -1 });

// Service Ticket Interfaces and Schemas (WAVE 9)
export interface IServiceTicket extends Document {
  tenantId: mongoose.Types.ObjectId;
  ticketId: string;
  assetId: mongoose.Types.ObjectId; // Vehicle or Driver asset
  assetType: 'vehicle' | 'driver' | 'equipment';
  clientId: mongoose.Types.ObjectId;
  clientName: string;
  clientPhone: string;
  type: 'COMPLAINT' | 'INSTALLATION' | 'PICKUP' | 'MAINTENANCE' | 'REPLACEMENT' | 'REPAIR';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  description: string;
  assignedEngineer?: mongoose.Types.ObjectId;
  engineerName?: string;
  fieldVisits: mongoose.Types.ObjectId[]; // References to FieldVisit documents
  diagnosis?: string;
  resolution?: string;
  slaResponseTime?: number; // Minutes
  slaResolutionTime?: number; // Minutes
  actualResponseTime?: number; // Minutes
  actualResolutionTime?: number; // Minutes
  slaBreached: boolean;
  createdAt: Date;
  assignedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdBy: {
    userId: string;
    role: string;
  };
}

export interface IFieldVisit extends Document {
  tenantId: mongoose.Types.ObjectId;
  visitId: string;
  ticketId: mongoose.Types.ObjectId;
  engineerId: mongoose.Types.ObjectId;
  engineerName: string;
  assetId: mongoose.Types.ObjectId;
  visitDate: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  diagnosis: string;
  actionTaken: 'REPAIR' | 'REPLACEMENT' | 'NO_ACTION' | 'REFER_TO_VENDOR';
  assetConditionBefore: string;
  assetConditionAfter?: string;
  photos: {
    url: string;
    description: string;
    timestamp: Date;
  }[];
  partsUsed: {
    partName: string;
    quantity: number;
    cost: number;
  }[];
  laborCost?: number;
  totalCost: number;
  notes?: string;
  createdAt: Date;
}

export interface ISLAMetrics extends Document {
  tenantId: mongoose.Types.ObjectId;
  metricsDate: Date;
  totalTickets: number;
  openTickets: number;
  breachedTickets: number;
  averageResponseTime: number; // Minutes
  averageResolutionTime: number; // Minutes
  ticketsBreaching: {
    ticketId: string;
    breachType: 'RESPONSE' | 'RESOLUTION';
    breachTime: number; // Minutes over SLA
  }[];
  createdAt: Date;
}

// Service Ticket Schema
const ServiceTicketSchema = new Schema<IServiceTicket>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ticketId: { type: String, required: true, unique: true },
  assetId: { type: Schema.Types.ObjectId, required: true },
  assetType: {
    type: String,
    enum: ['vehicle', 'driver', 'equipment'],
    required: true
  },
  clientId: { type: Schema.Types.ObjectId, required: true },
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  type: {
    type: String,
    enum: ['COMPLAINT', 'INSTALLATION', 'PICKUP', 'MAINTENANCE', 'REPLACEMENT', 'REPAIR'],
    required: true
  },
  priority: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    required: true
  },
  status: {
    type: String,
    enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN'
  },
  description: { type: String, required: true },
  assignedEngineer: { type: Schema.Types.ObjectId, ref: 'User' },
  engineerName: { type: String },
  fieldVisits: [{ type: Schema.Types.ObjectId, ref: 'FieldVisit' }],
  diagnosis: { type: String },
  resolution: { type: String },
  slaResponseTime: { type: Number }, // Minutes
  slaResolutionTime: { type: Number }, // Minutes
  actualResponseTime: { type: Number },
  actualResolutionTime: { type: Number },
  slaBreached: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  assignedAt: { type: Date },
  resolvedAt: { type: Date },
  closedAt: { type: Date },
  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true }
  }
});

// Field Visit Schema
const FieldVisitSchema = new Schema<IFieldVisit>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  visitId: { type: String, required: true, unique: true },
  ticketId: { type: Schema.Types.ObjectId, ref: 'ServiceTicket', required: true },
  engineerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  engineerName: { type: String, required: true },
  assetId: { type: Schema.Types.ObjectId, required: true },
  visitDate: { type: Date, required: true },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  diagnosis: { type: String, required: true },
  actionTaken: {
    type: String,
    enum: ['REPAIR', 'REPLACEMENT', 'NO_ACTION', 'REFER_TO_VENDOR'],
    required: true
  },
  assetConditionBefore: { type: String, required: true },
  assetConditionAfter: { type: String },
  photos: [{
    url: { type: String },
    description: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  partsUsed: [{
    partName: { type: String },
    quantity: { type: Number },
    cost: { type: Number }
  }],
  laborCost: { type: Number, default: 0 },
  totalCost: { type: Number, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// SLA Metrics Schema
const SLAMetricsSchema = new Schema<ISLAMetrics>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  metricsDate: { type: Date, required: true },
  totalTickets: { type: Number, default: 0 },
  openTickets: { type: Number, default: 0 },
  breachedTickets: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 },
  averageResolutionTime: { type: Number, default: 0 },
  ticketsBreaching: [{
    ticketId: { type: String },
    breachType: {
      type: String,
      enum: ['RESPONSE', 'RESOLUTION']
    },
    breachTime: { type: Number }
  }],
  createdAt: { type: Date, default: Date.now }
});

// ==================== SaaS Billing Models ====================

// Plan Interface
export interface IPlan extends Document {
  name: string;
  code: string;
  description: string;
  pricing: {
    monthlyUsd: number;
    quarterlyUsd?: number;
    halfYearlyUsd?: number;
    annualUsd?: number;
  };
  limits: {
    maxVehicles: number;
    maxDrivers: number;
    maxUsers: number;
  };
  features: string[];
  trial?: {
    daysCount: number;
    enabled: boolean;
  };
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// Plan Schema
const PlanSchema = new Schema<IPlan>({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  pricing: {
    monthlyUsd: { type: Number, required: true },
    quarterlyUsd: { type: Number },
    halfYearlyUsd: { type: Number },
    annualUsd: { type: Number }
  },
  limits: {
    maxVehicles: { type: Number, required: true, default: 0 },
    maxDrivers: { type: Number, required: true, default: 0 },
    maxUsers: { type: Number, required: true, default: 0 }
  },
  features: [{ type: String }],
  trial: {
    daysCount: { type: Number, default: 14 },
    enabled: { type: Boolean, default: false }
  },
  status: { type: String, enum: ['active', 'inactive', 'archived'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Subscription Interface
export interface ISubscription extends Document {
  tenantId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  billingCycle: 'monthly' | 'quarterly' | 'halfYearly' | 'annual';
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'LOCKED';
  startDate: Date;
  renewalDate: Date;
  isTrial: boolean;
  trialEndsAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Schema
const SubscriptionSchema = new Schema<ISubscription>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  billingCycle: { type: String, enum: ['monthly', 'quarterly', 'halfYearly', 'annual'], default: 'monthly' },
  status: { type: String, enum: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'LOCKED'], default: 'ACTIVE' },
  startDate: { type: Date, required: true },
  renewalDate: { type: Date, required: true },
  isTrial: { type: Boolean, default: false },
  trialEndsAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// SaaS Invoice Interface
export interface ISaaSInvoice extends Document {
  invoiceNumber: string;
  tenantId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  billingCycle: string;
  period: {
    start: Date;
    end: Date;
  };
  amount: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: Date;
  status: 'ISSUED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

// SaaS Invoice Schema
const SaaSInvoiceSchema = new Schema<ISaaSInvoice>({
  invoiceNumber: { type: String, required: true, unique: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  billingCycle: { type: String, required: true },
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  amount: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paid: { type: Number, default: 0 },
  outstanding: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'], default: 'ISSUED' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// SaaS Payment Interface
export interface ISaaSPayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMode: 'bank_transfer' | 'card' | 'check' | 'upi' | 'other';
  transactionReference: string;
  status: 'received' | 'failed' | 'pending';
  createdAt: Date;
}

// SaaS Payment Schema
const SaaSPaymentSchema = new Schema<ISaaSPayment>({
  invoiceId: { type: Schema.Types.ObjectId, ref: 'SaaSInvoice', required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: Date, required: true },
  paymentMode: { type: String, enum: ['bank_transfer', 'card', 'check', 'upi', 'other'], required: true },
  transactionReference: { type: String, required: true },
  status: { type: String, enum: ['received', 'failed', 'pending'], default: 'received' },
  createdAt: { type: Date, default: Date.now }
});

// Usage Log Interface
export interface IUsageLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  resourceType: 'vehicles' | 'drivers' | 'users';
  currentUsage: number;
  limit: number;
  timestamp: Date;
}

// Usage Log Schema
const UsageLogSchema = new Schema<IUsageLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  resourceType: { type: String, enum: ['vehicles', 'drivers', 'users'], required: true },
  currentUsage: { type: Number, required: true },
  limit: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Entitlement Log Interface
export interface IEntitlementLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  action: string;
  feature: string;
  oldValue: any;
  newValue: any;
  changedAt: Date;
}

// Entitlement Log Schema
const EntitlementLogSchema = new Schema<IEntitlementLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  action: { type: String, required: true },
  feature: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  changedAt: { type: Date, default: Date.now }
});

// Create indexes for SaaS models
PlanSchema.index({ code: 1 });
PlanSchema.index({ status: 1 });

SubscriptionSchema.index({ tenantId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ renewalDate: 1 });

SaaSInvoiceSchema.index({ tenantId: 1, createdAt: -1 });
SaaSInvoiceSchema.index({ invoiceNumber: 1 });
SaaSInvoiceSchema.index({ status: 1 });
SaaSInvoiceSchema.index({ dueDate: 1 });

SaaSPaymentSchema.index({ tenantId: 1, paymentDate: -1 });
SaaSPaymentSchema.index({ invoiceId: 1 });

UsageLogSchema.index({ tenantId: 1, resourceType: 1, timestamp: -1 });

EntitlementLogSchema.index({ tenantId: 1, changedAt: -1 });

// Create indexes for service operations
ServiceTicketSchema.index({ tenantId: 1, status: 1 });
ServiceTicketSchema.index({ tenantId: 1, priority: 1 });
ServiceTicketSchema.index({ ticketId: 1 });
ServiceTicketSchema.index({ assignedEngineer: 1 });
ServiceTicketSchema.index({ clientId: 1 });
ServiceTicketSchema.index({ createdAt: -1 });
ServiceTicketSchema.index({ tenantId: 1, slaBreached: 1 });

FieldVisitSchema.index({ tenantId: 1, ticketId: 1 });
FieldVisitSchema.index({ visitId: 1 });
FieldVisitSchema.index({ engineerId: 1 });
FieldVisitSchema.index({ createdAt: -1 });

SLAMetricsSchema.index({ tenantId: 1, metricsDate: -1 });
SLAMetricsSchema.index({ tenantId: 1, createdAt: -1 });

// Missing interfaces for onboarding
export interface IUserOnboarding extends Document {
  userId: string;
  tenantId: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOnboardingTask extends Document {
  onboardingId: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  completedAt?: Date;
}

export interface IOnboardingEmail extends Document {
  userId: string;
  type: string;
  sentAt: Date;
}

export interface IDemoTenant extends Document {
  name: string;
  status: string;
  createdAt: Date;
}

// Stub schemas for missing models
const UserOnboardingSchema = new mongoose.Schema<IUserOnboarding>({
  userId: String,
  tenantId: String,
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const OnboardingTaskSchema = new mongoose.Schema<IOnboardingTask>({
  onboardingId: String,
  title: String,
  description: String,
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  completedAt: Date
});

const OnboardingEmailSchema = new mongoose.Schema<IOnboardingEmail>({
  userId: String,
  type: String,
  sentAt: { type: Date, default: Date.now }
});

const DemoTenantSchema = new mongoose.Schema<IDemoTenant>({
  name: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

// Export models
export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
export const UserOnboarding = mongoose.model<IUserOnboarding>('UserOnboarding', UserOnboardingSchema);
export const OnboardingTask = mongoose.model<IOnboardingTask>('OnboardingTask', OnboardingTaskSchema);
export const OnboardingEmail = mongoose.model<IOnboardingEmail>('OnboardingEmail', OnboardingEmailSchema);
export const DemoTenant = mongoose.model<IDemoTenant>('DemoTenant', DemoTenantSchema);
export const User = mongoose.model<IUser>('User', UserSchema);
export const Vehicle = mongoose.model<IVehicle>('Vehicle', VehicleSchema);
export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
export const DriverSalary = mongoose.model<IDriverSalary>('DriverSalary', DriverSalarySchema);
export const SalaryHistory = mongoose.model<ISalaryHistory>('SalaryHistory', SalaryHistorySchema);
export const SalaryAuditTrail = mongoose.model<ISalaryAuditTrail>('SalaryAuditTrail', SalaryAuditTrailSchema);
export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
export const LeaveType = mongoose.model<ILeaveType>('LeaveType', LeaveTypeSchema);
export const DriverLeave = mongoose.model<IDriverLeave>('DriverLeave', DriverLeaveSchema);
export const LeaveAccrual = mongoose.model<ILeaveAccrual>('LeaveAccrual', LeaveAccrualSchema);
export const OnboardingChecklist = mongoose.model<IOnboardingChecklist>('OnboardingChecklist', OnboardingChecklistSchema);
export const ServiceTicket = mongoose.model<IServiceTicket>('ServiceTicket', ServiceTicketSchema);
export const FieldVisit = mongoose.model<IFieldVisit>('FieldVisit', FieldVisitSchema);
export const SLAMetrics = mongoose.model<ISLAMetrics>('SLAMetrics', SLAMetricsSchema);

// SaaS Billing Models
export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
export const SaaSInvoice = mongoose.model<ISaaSInvoice>('SaaSInvoice', SaaSInvoiceSchema);
export const SaaSPayment = mongoose.model<ISaaSPayment>('SaaSPayment', SaaSPaymentSchema);

// Advanced Admin Models
export { AuditLogModel } from './audit-log';
export { SystemSettingsModel } from './system-settings';
export { PerformanceMetricsModel } from './performance-metrics';
export const UsageLog = mongoose.model<IUsageLog>('UsageLog', UsageLogSchema);
export const EntitlementLog = mongoose.model<IEntitlementLog>('EntitlementLog', EntitlementLogSchema);