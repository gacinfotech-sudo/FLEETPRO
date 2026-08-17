import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import mongoose from 'mongoose';
import { Tenant, User, Vehicle, Driver, Booking, Expense, Attendance, ITenant, IUser, IVehicle, IDriver, IBooking, IExpense, IAttendance } from './models';

export interface IStorage {
  /**
   * Authenticate user credentials and retrieve user data
   * @param userId - The user ID to authenticate
   * @param password - The plaintext password (will be compared with hashed value)
   * @returns User object if credentials are valid, undefined otherwise
   */
  getUserByCredentials(userId: string, password: string): Promise<IUser | undefined>;
  /**
   * Update user session information (login session, device, etc.)
   * @param id - User ID
   * @param sessionId - Session ID (null to clear session)
   * @param deviceInfo - Optional device information for tracking
   */
  updateUserSession(id: string, sessionId: string | null, deviceInfo?: any): Promise<void>;
  getUserBySessionId(sessionId: string): Promise<IUser | undefined>;
  getUserSession(id: string): Promise<{ sessionId: string; deviceInfo?: any } | undefined>;
  resetUserPassword(id: string, newPassword: string): Promise<void>;
  adminResetUserPassword(userId: string, tempPassword: string): Promise<void>;
  updateUserLoginInfo(id: string, ip: string, userAgent: string): Promise<void>;

  /**
   * Create a new tenant (customer) in the system
   * @param tenant - Partial tenant data (name, configuration, etc.)
   * @returns Created tenant object with assigned ID
   */
  createTenant(tenant: Partial<ITenant>): Promise<ITenant>;
  getTenants(): Promise<ITenant[]>;
  getTenant(id: string): Promise<ITenant | undefined>;
  updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  /**
   * Create a new user account
   * @param user - User data including userId, password, email, tenantId, etc.
   * @returns Created user object
   */
  createUser(user: any): Promise<IUser>;
  getUsers(): Promise<IUser[]>;
  getUser(id: string): Promise<IUser | undefined>;
  getUsersByTenant(tenantId: string): Promise<IUser[]>;
  updateUser(id: string, data: any): Promise<IUser | undefined>;
  deleteUser(id: string): Promise<void>;

  // Role-based methods
  createSubUser(userData: any, createdBy: string): Promise<IUser>;
  getSubUsersByTenant(tenantId: string): Promise<IUser[]>;
  deactivateSubUser(userId: string, deactivatedBy: string): Promise<void>;
  reactivateSubUser(userId: string, reactivatedBy: string): Promise<void>;
  checkUserPermission(userId: string, permission: string): Promise<boolean>;
  fixBookingAuditTrail(): Promise<number>;

  // Vehicle methods
  createVehicle(vehicle: any): Promise<IVehicle>;
  getVehiclesByTenant(tenantId: string): Promise<IVehicle[]>;
  getVehicle(id: string): Promise<IVehicle | undefined>;
  updateVehicle(id: string, data: any): Promise<IVehicle | undefined>;
  deleteVehicle(id: string): Promise<void>;
  getAvailableVehicles(tenantId: string, pickupDate: string, returnDate: string): Promise<IVehicle[]>;

  // Driver methods
  createDriver(driver: any): Promise<IDriver>;
  getDriversByTenant(tenantId: string): Promise<IDriver[]>;
  getDriver(id: string): Promise<IDriver | undefined>;
  updateDriver(id: string, data: any): Promise<IDriver | undefined>;
  deleteDriver(id: string): Promise<void>;
  getAvailableDrivers(tenantId: string, pickupDate: string, returnDate: string): Promise<IDriver[]>;

  /**
   * Create a new vehicle/driver booking
   * @param booking - Booking data (vehicleId, driverId, pickupDate, returnDate, etc.)
   * @returns Created booking object with status tracking
   */
  createBooking(booking: any): Promise<IBooking>;
  getBookingsByTenant(tenantId: string): Promise<IBooking[]>;
  getBooking(id: string): Promise<IBooking | undefined>;
  updateBooking(id: string, data: any): Promise<IBooking | undefined>;
  deleteBooking(id: string): Promise<void>;
  getUpcomingBookings(tenantId: string): Promise<IBooking[]>;
  /**
   * Get aggregated business statistics for a tenant
   * @param tenantId - The tenant ID to get stats for
   * @returns Object containing revenue, booking count, fleet size, and active driver count
   */
  getTenantStats(tenantId: string): Promise<{
    totalRevenue: number;
    totalBookings: number;
    fleetSize: number;
    activeDrivers: number;
  }>;
  getRevenueReport(tenantId: string, startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    averageBookingValue: number;
    revenuePerVehicle: number;
    fleetUtilization: number;
    revenueByVehicleType: Array<{ type: string; revenue: number; count: number }>;
    revenueByBookingType: Array<{ type: string; revenue: number; count: number }>;
    topPerformingVehicles: Array<{ vehicle: any; revenue: number; bookings: number }>;
    completedBookings: number;
    expensesByCategory: Array<{ category: string; amount: number; count: number }>;
  }>;
  markExpiredBookingsAsCompleted(): Promise<number>;

  // Enhanced Admin Methods for Manager Control
  getManagersByTenant(tenantId: string): Promise<IUser[]>;
  deactivateClientAndManagers(tenantId: string): Promise<void>;
  activateClientAndManagers(tenantId: string): Promise<void>;

  // Subscription Plan Management
  updateTenantPlan(tenantId: string, plan: string, limits: { vehicles: number; drivers: number; managers: number; }): Promise<ITenant | undefined>;
  getTenantLimits(tenantId: string): Promise<{ vehicles: number; drivers: number; managers: number; } | null>;
  checkVehicleLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }>;
  checkDriverLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }>;
  checkManagerLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }>;

  // Onboarding methods
  markOnboardingComplete(userId: string): Promise<void>;

  // Expense methods
  createExpense(expense: any): Promise<IExpense>;
  getExpensesByTenant(tenantId: string): Promise<IExpense[]>;
  getExpense(id: string): Promise<IExpense | undefined>;
  updateExpense(id: string, data: any): Promise<IExpense | undefined>;
  deleteExpense(id: string): Promise<void>;
  getTotalExpenses(tenantId: string, startDate?: string, endDate?: string): Promise<number>;

  // Generic database methods for flexible queries
  findOne(modelName: string, query: any): Promise<any>;
  findById(modelName: string, id: string): Promise<any>;
  find(modelName: string, query: any): Promise<any[]>;
  updateOne(modelName: string, query: any, update: any): Promise<any>;
  insertOne(modelName: string, data: any): Promise<any>;

  // Tenant V2 Enterprise Features
  createApiKey(tenantId: string, keyName: string): Promise<{ key: string; secret: string }>;
  revokeApiKey(tenantId: string, keyId: string): Promise<void>;
  listApiKeys(tenantId: string): Promise<Array<{ name: string; key: string; active: boolean; createdAt: Date; lastUsed?: Date }>>;

  updateTenantBranding(tenantId: string, branding: any): Promise<ITenant | undefined>;
  getBranding(tenantId: string): Promise<any | undefined>;

  updateTenantSettings(tenantId: string, settings: any): Promise<ITenant | undefined>;
  getTenantSettings(tenantId: string): Promise<any | undefined>;

  getTenantUsageStats(tenantId: string): Promise<any>;
  updateUsageStats(tenantId: string, stats: any): Promise<void>;

  softDeleteTenant(tenantId: string): Promise<void>;
  restoreTenant(tenantId: string): Promise<void>;

  updateTenantFeatures(tenantId: string, features: any): Promise<ITenant | undefined>;
  getFeatures(tenantId: string): Promise<any>;

  configureWebhook(tenantId: string, webhookUrl: string, events: string[]): Promise<void>;
  getWebhookConfig(tenantId: string): Promise<{ url?: string; events?: string[] } | undefined>;

  upgradeSubscriptionPlan(tenantId: string, newPlan: string): Promise<ITenant | undefined>;
  getBillingInfo(tenantId: string): Promise<any>;
  recordBillingEvent(tenantId: string, event: string, details: any): Promise<void>;
}

export class MongoDBStorage implements IStorage {
  constructor() {}

  // Auth methods
  async getUserByCredentials(userId: string, password: string): Promise<IUser | undefined> {
    try {
      // Escape special regex characters and make case-insensitive
      const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const user = await User.findOne({
        userId: new RegExp('^' + escapedUserId + '$', 'i')
      }).populate('tenantId');

      if (!user) return undefined;

      // Password remains case-sensitive
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) return undefined;
      return user;
    } catch (error) {
      console.error('Error getting user by credentials:', error);
      return undefined;
    }
  }

  async updateUserSession(id: string, sessionId: string | null, deviceInfo?: any): Promise<void> {
    try {
      const updateData: any = {
        sessionId,
        lastLogin: sessionId ? new Date() : undefined
      };

      if (deviceInfo) {
        updateData.deviceInfo = deviceInfo;
      }

      const result = await User.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      console.error('Error updating user session:', error);
      throw error;
    }
  }

  async getUserSession(id: string): Promise<{ sessionId: string; deviceInfo?: any } | undefined> {
    try {
      const user = await User.findById(id).select('sessionId deviceInfo');
      if (user && user.sessionId) {
        return {
          sessionId: user.sessionId,
          deviceInfo: user.deviceInfo
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user session:', error);
      return undefined;
    }
  }

  async getUserBySessionId(sessionId: string): Promise<IUser | undefined> {
    try {
      const user = await User.findOne({ sessionId }).populate('tenantId') || undefined;
      return user;
    } catch (error) {
      console.error('Error getting user by session ID:', error);
      return undefined;
    }
  }

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await User.findByIdAndUpdate(id, { 
        password: hashedPassword,
        mustResetPassword: false,
        sessionId: null // Clear session to force re-login
      });
    } catch (error) {
      console.error('Error resetting user password:', error);
      throw error;
    }
  }

  async adminResetUserPassword(userId: string, tempPassword: string): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      await User.findByIdAndUpdate(userId, { 
        password: hashedPassword,
        mustResetPassword: true,
        sessionId: null // Clear session to force re-login
      });
    } catch (error) {
      console.error('Error admin resetting password:', error);
      throw error;
    }
  }

  async updateUserLoginInfo(id: string, ip: string, userAgent: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(id, {
        lastLogin: new Date(),
        lastLoginIP: ip,
        lastLoginUserAgent: userAgent
      });
    } catch (error) {
      console.error('Error updating user login info:', error);
      throw error;
    }
  }

  // Tenant methods
  async createTenant(tenantData: Partial<ITenant>): Promise<ITenant> {
    try {
      const tenant = new Tenant(tenantData);
      return await tenant.save();
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async getTenants(): Promise<ITenant[]> {
    try {
      return await Tenant.find({}).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting tenants:', error);
      throw error;
    }
  }

  async getTenant(id: string): Promise<ITenant | undefined> {
    try {
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      return await Tenant.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting tenant:', error);
      return undefined;
    }
  }

  async updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant | undefined> {
    try {
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      return await Tenant.findByIdAndUpdate(id, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating tenant:', error);
      return undefined;
    }
  }

  async deleteTenant(id: string): Promise<void> {
    try {
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid tenant ID format');
      }
      await Tenant.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // User methods
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      // Store user ID in lowercase for consistency
      if (userData.userId) {
        userData.userId = userData.userId.toLowerCase();
      }

      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }
      userData.mustResetPassword = true; // New users must reset password

      // Convert tenantId string to ObjectId if provided
      if (userData.tenantId && typeof userData.tenantId === 'string') {
        userData.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }


      const user = new User(userData);
      const savedUser = await user.save();

      return savedUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUsers(): Promise<IUser[]> {
    try {
      return await User.find({}).populate('tenantId').sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<IUser | undefined> {
    try {
      // Check if id is a valid ObjectId, if not search by userId
      if (mongoose.Types.ObjectId.isValid(id)) {
        return await User.findById(id).populate('tenantId') || undefined;
      } else {
        // Search by userId field for non-ObjectId strings like "admin"
        return await User.findOne({ userId: id }).populate('tenantId') || undefined;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUsersByTenant(tenantId: string): Promise<IUser[]> {
    try {
      // Validate tenant ID format
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        return [];
      }
      return await User.find({ tenantId }).populate('tenantId');
    } catch (error) {
      console.error('Error getting users by tenant:', error);
      throw error;
    }
  }

  async updateUser(id: string, data: Partial<IUser>): Promise<IUser | undefined> {
    try {
      // Validate user ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }

      // Store user ID in lowercase for consistency
      if (data.userId) {
        data.userId = data.userId.toLowerCase();
      }

      if (data.password) {
        data.password = await bcrypt.hash(data.password, 12);
      }

      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(data.tenantId)) {
          return undefined;
        }
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }

      return await User.findByIdAndUpdate(id, data, { new: true }).populate('tenantId') || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      // Validate user ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid user ID format');
      }
      await User.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Vehicle methods
  async createVehicle(vehicleData: any): Promise<IVehicle> {
    try {
      // Convert tenantId string to ObjectId if provided
      if (vehicleData.tenantId && typeof vehicleData.tenantId === 'string') {
        vehicleData.tenantId = new mongoose.Types.ObjectId(vehicleData.tenantId);
      }

      const vehicle = new Vehicle(vehicleData);
      return await vehicle.save();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  async getVehiclesByTenant(tenantId: string): Promise<IVehicle[]> {
    try {
      return await Vehicle.find({ tenantId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting vehicles by tenant:', error);
      throw error;
    }
  }

  async getVehicle(id: string): Promise<IVehicle | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      return await Vehicle.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting vehicle:', error);
      return undefined;
    }
  }

  async updateVehicle(id: string, data: any): Promise<IVehicle | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(data.tenantId)) {
          return undefined;
        }
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }

      return await Vehicle.findByIdAndUpdate(id, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating vehicle:', error);
      return undefined;
    }
  }

  async deleteVehicle(id: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid vehicle ID format');
      }
      await Vehicle.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }

  async getAvailableVehicles(tenantId: string, pickupDate: string, returnDate: string): Promise<IVehicle[]> {
    try {
      const pickup = new Date(pickupDate);
      const returnD = new Date(returnDate);

      // Find vehicles that are not booked during the requested period
      const bookedVehicleIds = await Booking.distinct('vehicleId', {
        tenantId,
        status: { $in: ['confirmed'] },
        $or: [
          {
            pickupDate: { $lte: returnD },
            returnDate: { $gte: pickup }
          }
        ]
      });

      return await Vehicle.find({
        tenantId,
        status: 'available',
        _id: { $nin: bookedVehicleIds }
      }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting available vehicles:', error);
      throw error;
    }
  }

  // Driver methods
  async createDriver(driverData: any): Promise<IDriver> {
    try {
      // Convert tenantId string to ObjectId if provided
      if (driverData.tenantId && typeof driverData.tenantId === 'string') {
        driverData.tenantId = new mongoose.Types.ObjectId(driverData.tenantId);
      }

      const driver = new Driver(driverData);
      return await driver.save();
    } catch (error) {
      console.error('Error creating driver:', error);
      throw error;
    }
  }

  async getDriversByTenant(tenantId: string): Promise<IDriver[]> {
    try {
      return await Driver.find({ tenantId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting drivers by tenant:', error);
      throw error;
    }
  }

  async getDriver(id: string): Promise<IDriver | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      return await Driver.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting driver:', error);
      return undefined;
    }
  }

  async updateDriver(id: string, data: any): Promise<IDriver | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(data.tenantId)) {
          return undefined;
        }
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }

      return await Driver.findByIdAndUpdate(id, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating driver:', error);
      return undefined;
    }
  }

  async deleteDriver(id: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid driver ID format');
      }
      await Driver.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting driver:', error);
      throw error;
    }
  }

  async getAvailableDrivers(tenantId: string, pickupDate: string, returnDate: string): Promise<IDriver[]> {
    try {
      const pickup = new Date(pickupDate);
      const returnD = new Date(returnDate);

      // Find drivers that are not booked during the requested period
      const bookedDriverIds = await Booking.distinct('driverId', {
        tenantId,
        driverId: { $ne: null },
        status: { $in: ['confirmed'] },
        $or: [
          {
            pickupDate: { $lte: returnD },
            returnDate: { $gte: pickup }
          }
        ]
      });

      return await Driver.find({
        tenantId,
        status: 'available',
        _id: { $nin: bookedDriverIds }
      }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting available drivers:', error);
      throw error;
    }
  }

  // Booking methods
  async createBooking(bookingData: any): Promise<IBooking> {
    try {
      if (!bookingData.bookingId) {
        bookingData.bookingId = `BK${Date.now()}`;
      }

      // Convert string IDs to ObjectIds if provided
      if (bookingData.tenantId && typeof bookingData.tenantId === 'string') {
        bookingData.tenantId = new mongoose.Types.ObjectId(bookingData.tenantId);
      }
      if (bookingData.vehicleId && typeof bookingData.vehicleId === 'string') {
        bookingData.vehicleId = new mongoose.Types.ObjectId(bookingData.vehicleId);
      }
      // Only process driverId if it's a valid non-empty string
      if (bookingData.driverId && typeof bookingData.driverId === 'string' && bookingData.driverId.trim() !== '') {
        bookingData.driverId = new mongoose.Types.ObjectId(bookingData.driverId);
      } else {
        // Remove driverId completely if it's empty or invalid
        delete bookingData.driverId;
      }

      const booking = new Booking(bookingData);
      const savedBooking = await booking.save();

      // Limit to 200,000 bookings per tenant
      const bookingCount = await Booking.countDocuments({ tenantId: bookingData.tenantId });
      if (bookingCount > 200000) {
        const oldestBooking = await Booking.findOne({ tenantId: bookingData.tenantId })
          .sort({ createdAt: 1 });
        if (oldestBooking) {
          await Booking.findByIdAndDelete(oldestBooking._id);
        }
      }

      return savedBooking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async getBookingsByTenant(tenantId: string): Promise<IBooking[]> {
    try {
      return await Booking.find({ tenantId })
        .populate('vehicleId')
        .populate('driverId')
        .sort({ createdAt: -1 })
        .lean(); // Return plain JavaScript objects instead of Mongoose documents
    } catch (error) {
      console.error('Error getting bookings by tenant:', error);
      throw error;
    }
  }

  async getBooking(id: string): Promise<IBooking | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      return await Booking.findById(id)
        .populate('vehicleId')
        .populate('driverId')
        .lean() || undefined;
    } catch (error) {
      console.error('Error getting booking:', error);
      return undefined;
    }
  }

  async updateBooking(id: string, data: any): Promise<IBooking | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
      // Convert string IDs to ObjectIds if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(data.tenantId)) {
          return undefined;
        }
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }
      if (data.vehicleId && typeof data.vehicleId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(data.vehicleId)) {
          return undefined;
        }
        data.vehicleId = new mongoose.Types.ObjectId(data.vehicleId);
      }
      if (data.driverId && typeof data.driverId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(data.driverId)) {
          return undefined;
        }
        data.driverId = new mongoose.Types.ObjectId(data.driverId);
      }

      return await Booking.findByIdAndUpdate(id, data, { new: true })
        .populate('vehicleId')
        .populate('driverId') || undefined;
    } catch (error) {
      console.error('Error updating booking:', error);
      return undefined;
    }
  }

  async deleteBooking(id: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid booking ID format');
      }
      await Booking.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  }

  async getUpcomingBookings(tenantId: string): Promise<IBooking[]> {
    try {
      // Booking dates are stored separately from booking times. Query from the
      // start of the current Asia/Kolkata calendar day so today's later trips
      // do not disappear simply because midnight has already passed.
      const now = new Date();
      const indiaDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      const startOfIndiaDay = new Date(`${indiaDate}T00:00:00+05:30`);

      return await Booking.find({
        tenantId,
        status: 'confirmed',
        pickupDate: { $gte: startOfIndiaDay }
      })
        .populate('vehicleId')
        .populate('driverId')
        .sort({ pickupDate: 1, pickupTime: 1 })
        .lean();
    } catch (error) {
      console.error('Error getting upcoming bookings:', error);
      throw error;
    }
  }

  async markExpiredBookingsAsCompleted(): Promise<number> {
    try {
      const now = new Date();
      const candidates = await Booking.find({
        status: 'confirmed',
        returnDate: { $lte: now }
      }).select('_id returnDate returnTime');

      const expiredIds = candidates
        .filter((booking) => {
          if (!booking.returnDate) return false;
          const datePart = booking.returnDate.toISOString().slice(0, 10);
          // If a legacy booking has no return time, keep it active through the
          // end of that India calendar day instead of completing at midnight.
          const timePart = booking.returnTime || '23:59';
          const actualReturnAt = new Date(`${datePart}T${timePart}:00+05:30`);
          return actualReturnAt.getTime() <= now.getTime();
        })
        .map((booking) => booking._id);

      if (expiredIds.length === 0) return 0;

      const result = await Booking.updateMany(
        { _id: { $in: expiredIds }, status: 'confirmed' },
        { status: 'completed' }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking expired bookings:', error);
      return 0;
    }
  }

  async getTenantStats(tenantId: string): Promise<{
    totalRevenue: number;
    totalBookings: number;
    fleetSize: number;
    activeDrivers: number;
  }> {
    try {
      const [revenueResult, totalBookings, fleetSize, activeDrivers] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              status: { $in: ['confirmed', 'completed'] }
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              }
            }
          }
        ]),
        Booking.countDocuments({ tenantId }),
        Vehicle.countDocuments({ tenantId, status: 'available' }),
        Driver.countDocuments({ tenantId, status: 'available' })
      ]);

      return {
        totalRevenue: revenueResult[0]?.totalRevenue || 0,
        totalBookings,
        fleetSize,
        activeDrivers
      };
    } catch (error) {
      console.error('Error getting tenant stats:', error);
      throw error;
    }
  }

  async getRevenueReport(tenantId: string, startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    averageBookingValue: number;
    revenuePerVehicle: number;
    fleetUtilization: number;
    revenueByVehicleType: Array<{ type: string; revenue: number; count: number }>;
    revenueByBookingType: Array<{ type: string; revenue: number; count: number }>;
    topPerformingVehicles: Array<{ vehicle: any; revenue: number; bookings: number }>;
    completedBookings: number;
    expensesByCategory: Array<{ category: string; amount: number; count: number }>;
  }> {
    try {
      // Base condition: Only completed bookings for revenue calculation
      const matchConditions: any = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'completed'
      };

      // Date filtering based on returnDate (end date) for completed bookings
      if (startDate && endDate) {
        matchConditions.returnDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z') // Include entire end date
        };
      }

      // Expense date filter (matching booking date range)
      let expenseQuery: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
      if (startDate && endDate) {
        expenseQuery.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        };
      }

      const [
        revenueResult,
        revenueByVehicleType,
        revenueByBookingType,
        topPerformingVehicles,
        fleetSize,
        completedBookings,
        totalExpenses,
        expensesByCategory
      ] = await Promise.all([
        Booking.aggregate([
          { $match: matchConditions },
          {
            $group: {
              _id: null,
              totalRevenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              totalBookings: { $sum: 1 }
            }
          }
        ]),
        Booking.aggregate([
          { $match: matchConditions },
          {
            $lookup: {
              from: 'vehicles',
              localField: 'vehicleId',
              foreignField: '_id',
              as: 'vehicle'
            }
          },
          { $unwind: '$vehicle' },
          {
            $group: {
              _id: '$vehicle.type',
              revenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              type: '$_id',
              revenue: 1,
              count: 1,
              _id: 0
            }
          }
        ]),
        Booking.aggregate([
          { $match: matchConditions },
          {
            $group: {
              _id: '$bookingType',
              revenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              type: '$_id',
              revenue: 1,
              count: 1,
              _id: 0
            }
          }
        ]),
        Booking.aggregate([
          { $match: matchConditions },
          {
            $lookup: {
              from: 'vehicles',
              localField: 'vehicleId',
              foreignField: '_id',
              as: 'vehicle'
            }
          },
          { $unwind: '$vehicle' },
          {
            $group: {
              _id: '$vehicleId',
              vehicle: { $first: '$vehicle' },
              revenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              bookings: { $sum: 1 }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          {
            $project: {
              vehicle: 1,
              revenue: 1,
              bookings: 1,
              _id: 0
            }
          }
        ]),
        Vehicle.countDocuments({ tenantId }),
        Booking.countDocuments(matchConditions), // Already filtered by completed status
        // Total expenses calculation
        Expense.aggregate([
          { $match: expenseQuery },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        // Expenses by category
        Expense.aggregate([
          { $match: expenseQuery },
          {
            $group: {
              _id: '$category',
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              category: '$_id',
              amount: 1,
              count: 1,
              _id: 0
            }
          }
        ])
      ]);

      const stats = revenueResult[0] || { totalRevenue: 0, totalBookings: 0 };
      const totalRevenue = stats.totalRevenue;
      const totalBookings = stats.totalBookings;
      const totalExpensesValue = totalExpenses[0]?.total || 0;
      const netRevenue = totalRevenue - totalExpensesValue;

      // Calculate proper fleet utilization (percentage of vehicles with bookings)
      let fleetUtilization = 0;
      if (fleetSize > 0) {
        // Get unique vehicles that have bookings
        const vehiclesWithBookings = await Booking.distinct('vehicleId', matchConditions);
        fleetUtilization = (vehiclesWithBookings.length / fleetSize) * 100;
        // Ensure it doesn't exceed 100%
        fleetUtilization = Math.min(fleetUtilization, 100);
      }

      return {
        totalRevenue,
        totalExpenses: totalExpensesValue,
        netRevenue,
        averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
        revenuePerVehicle: fleetSize > 0 ? totalRevenue / fleetSize : 0,
        fleetUtilization,
        revenueByVehicleType,
        revenueByBookingType,
        topPerformingVehicles,
        completedBookings,
        expensesByCategory
      };
    } catch (error) {
      console.error('Error getting revenue report:', error);
      throw error;
    }
  }

  // Role-based methods
  async createSubUser(userData: any, createdBy: string): Promise<IUser> {
    try {
      // Store user ID in lowercase for consistency
      if (userData.userId) {
        userData.userId = userData.userId.toLowerCase();
      }

      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }

      // Set default permissions for manager role
      if (userData.role === 'manager' && !userData.permissions) {
        userData.permissions = [
          'create_booking',
          'delete_booking',
          'generate_invoice',
          'view_bookings',
          'edit_booking'
        ];
      }

      // Set createdBy field
      userData.createdBy = createdBy;
      userData.mustResetPassword = true; // New sub-users must reset password

      // Convert tenantId string to ObjectId if provided
      if (userData.tenantId && typeof userData.tenantId === 'string') {
        userData.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }


      const user = new User(userData);
      const savedUser = await user.save();

      return savedUser;
    } catch (error) {
      console.error('Error creating sub-user:', error);
      throw error;
    }
  }

  async getSubUsersByTenant(tenantId: string): Promise<IUser[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      return await User.find({ 
        tenantId: tenantObjectId, 
        role: { $in: ['manager'] } // Only get sub-users, not admins or clients
      }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting sub-users by tenant:', error);
      throw error;
    }
  }

  async deactivateSubUser(userId: string, deactivatedBy: string): Promise<void> {
    try {
      await User.findOneAndUpdate(
        { userId: userId.toLowerCase() },
        { 
          isActive: false,
          sessionId: null // Clear session to force logout
        }
      );
    } catch (error) {
      console.error('Error deactivating sub-user:', error);
      throw error;
    }
  }

  async reactivateSubUser(userId: string, reactivatedBy: string): Promise<void> {
    try {
      await User.findOneAndUpdate(
        { userId: userId.toLowerCase() },
        { 
          isActive: true
        }
      );
    } catch (error) {
      console.error('Error reactivating sub-user:', error);
      throw error;
    }
  }

  async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await User.findOne({ userId: userId.toLowerCase() });
      if (!user || !user.isActive) {
        return false;
      }

      // Admin and client roles have full permissions
      if (user.role === 'admin' || user.role === 'client') {
        return true;
      }

      // Check if user has wildcard permission or specific permission
      return user.permissions.includes('*') || user.permissions.includes(permission);
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  async fixBookingAuditTrail(): Promise<number> {
    try {
      const result = await Booking.updateMany(
        { createdBy: { $exists: false } },
        { 
          $set: { 
            createdBy: {
              userId: 'System',
              role: 'admin'
            }
          }
        }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error fixing booking audit trail:', error);
      return 0;
    }
  }

  // Enhanced Admin Methods for Manager Control
  async getManagersByTenant(tenantId: string): Promise<IUser[]> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const managers = await User.find({ 
        tenantId: objectId,
        role: 'manager'
      }).sort({ createdAt: -1 });
      return managers;
    } catch (error) {
      console.error('Error getting managers by tenant:', error);
      throw error;
    }
  }

  async deactivateClientAndManagers(tenantId: string): Promise<void> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);

      // Deactivate tenant
      await Tenant.findByIdAndUpdate(objectId, { isActive: false });

      // Deactivate client user and all managers for this tenant
      await User.updateMany(
        { tenantId: objectId },
        { isActive: false }
      );

    } catch (error) {
      console.error('Error deactivating client and managers:', error);
      throw error;
    }
  }

  async activateClientAndManagers(tenantId: string): Promise<void> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);

      // Activate tenant
      await Tenant.findByIdAndUpdate(objectId, { isActive: true });

      // Activate client user and all managers for this tenant
      await User.updateMany(
        { tenantId: objectId },
        { isActive: true }
      );

    } catch (error) {
      console.error('Error activating client and managers:', error);
      throw error;
    }
  }

  async markOnboardingComplete(userId: string): Promise<void> {

    const user = await User.findOne({ userId });
    if (!user) {
      console.error('User not found for onboarding completion:', userId);
      throw new Error("User not found");
    }

    user.hasCompletedOnboarding = true;
    await user.save();
  }

  // Subscription Plan Management Methods
  async updateTenantPlan(tenantId: string, plan: string, limits: { vehicles: number; drivers: number; managers: number; }): Promise<ITenant | undefined> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const updatedTenant = await Tenant.findByIdAndUpdate(
        objectId,
        { 
          subscriptionPlan: plan,
          limits: limits,
          maxManagers: limits.managers // Keep backward compatibility
        },
        { new: true }
      );
      return updatedTenant || undefined;
    } catch (error) {
      console.error('Error updating tenant plan:', error);
      throw error;
    }
  }

  async getTenantLimits(tenantId: string): Promise<{ vehicles: number; drivers: number; managers: number; } | null> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const tenant = await Tenant.findById(objectId);
      if (!tenant) return null;
      
      return {
        vehicles: tenant.limits?.vehicles || 6, // Default starter limits
        drivers: tenant.limits?.drivers || 3,
        managers: tenant.limits?.managers || 1
      };
    } catch (error) {
      console.error('Error getting tenant limits:', error);
      return null;
    }
  }

  async checkVehicleLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const vehicleCount = await Vehicle.countDocuments({ tenantId: objectId });
      const limits = await this.getTenantLimits(tenantId);
      const limit = limits?.vehicles || 6;
      
      return {
        current: vehicleCount,
        limit: limit,
        canAdd: vehicleCount < limit
      };
    } catch (error) {
      console.error('Error checking vehicle limit:', error);
      return { current: 0, limit: 6, canAdd: true };
    }
  }

  async checkDriverLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const driverCount = await Driver.countDocuments({ tenantId: objectId });
      const limits = await this.getTenantLimits(tenantId);
      const limit = limits?.drivers || 3;
      
      return {
        current: driverCount,
        limit: limit,
        canAdd: driverCount < limit
      };
    } catch (error) {
      console.error('Error checking driver limit:', error);
      return { current: 0, limit: 3, canAdd: true };
    }
  }

  async checkManagerLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const managerCount = await User.countDocuments({ 
        tenantId: objectId,
        role: 'manager'
      });
      const limits = await this.getTenantLimits(tenantId);
      const limit = limits?.managers || 1;
      
      return {
        current: managerCount,
        limit: limit,
        canAdd: managerCount < limit
      };
    } catch (error) {
      console.error('Error checking manager limit:', error);
      return { current: 0, limit: 1, canAdd: true };
    }
  }

  // Expense methods
  async createExpense(expenseData: any): Promise<IExpense> {
    try {
      const expense = new Expense({
        ...expenseData,
        tenantId: new mongoose.Types.ObjectId(expenseData.tenantId),
        vehicleId: new mongoose.Types.ObjectId(expenseData.vehicleId),
        createdAt: new Date()
      });
      await expense.save();
      return expense;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  async getExpensesByTenant(tenantId: string): Promise<IExpense[]> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const expenses = await Expense.find({ tenantId: objectId })
        .populate('vehicleId', 'make vehicleModel licensePlate')
        .sort({ date: -1, createdAt: -1 });
      return expenses;
    } catch (error) {
      console.error('Error getting expenses by tenant:', error);
      throw error;
    }
  }

  async getExpense(id: string): Promise<IExpense | undefined> {
    try {
      const expense = await Expense.findById(id)
        .populate('vehicleId', 'make vehicleModel licensePlate');
      return expense || undefined;
    } catch (error) {
      console.error('Error getting expense:', error);
      throw error;
    }
  }

  async updateExpense(id: string, data: any): Promise<IExpense | undefined> {
    try {
      if (data.vehicleId) {
        data.vehicleId = new mongoose.Types.ObjectId(data.vehicleId);
      }
      const expense = await Expense.findByIdAndUpdate(id, data, { new: true })
        .populate('vehicleId', 'make vehicleModel licensePlate');
      return expense || undefined;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      await Expense.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async getTotalExpenses(tenantId: string, startDate?: string, endDate?: string): Promise<number> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      
      let query: any = { tenantId: objectId };
      
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        };
      }
      
      const result = await Expense.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      return result.length > 0 ? result[0].total : 0;
    } catch (error) {
      console.error('Error getting total expenses:', error);
      return 0;
    }
  }

  // Generic database methods
  async findOne(modelName: string, query: any): Promise<any> {
    try {
      const model = this.getModel(modelName);
      return await model.findOne(query);
    } catch (error) {
      console.error(`Error finding ${modelName}:`, error);
      return null;
    }
  }

  async findById(modelName: string, id: string): Promise<any> {
    try {
      const model = this.getModel(modelName);
      return await model.findById(id);
    } catch (error) {
      console.error(`Error finding ${modelName} by ID:`, error);
      return null;
    }
  }

  async find(modelName: string, query: any): Promise<any[]> {
    try {
      const model = this.getModel(modelName);
      return await model.find(query);
    } catch (error) {
      console.error(`Error finding ${modelName}:`, error);
      return [];
    }
  }

  async updateOne(modelName: string, query: any, update: any): Promise<any> {
    try {
      const model = this.getModel(modelName);
      return await model.findOneAndUpdate(query, update, { new: true });
    } catch (error) {
      console.error(`Error updating ${modelName}:`, error);
      return null;
    }
  }

  async insertOne(modelName: string, data: any): Promise<any> {
    try {
      const model = this.getModel(modelName);
      const doc = new model(data);
      await doc.save();
      return doc;
    } catch (error) {
      console.error(`Error inserting ${modelName}:`, error);
      throw error;
    }
  }

  // ==================== TENANT V2 ENTERPRISE FEATURES ====================

  /**
   * Create a new API key for a tenant
   * @param tenantId - The tenant ID
   * @param keyName - A descriptive name for the API key
   * @returns Object with generated key and secret
   */
  async createApiKey(tenantId: string, keyName: string): Promise<{ key: string; secret: string }> {
    try {
      const key = nanoid(32);
      const secret = nanoid(64);

      await Tenant.findByIdAndUpdate(
        tenantId,
        {
          $push: {
            apiKeys: {
              name: keyName,
              key,
              secret,
              createdAt: new Date(),
              active: true
            }
          }
        },
        { new: true }
      );

      return { key, secret };
    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    }
  }

  /**
   * Revoke an API key
   * @param tenantId - The tenant ID
   * @param keyId - The key name or ID to revoke
   */
  async revokeApiKey(tenantId: string, keyId: string): Promise<void> {
    try {
      await Tenant.findByIdAndUpdate(
        tenantId,
        {
          $set: {
            'apiKeys.$[elem].active': false
          }
        },
        {
          arrayFilters: [{ 'elem.name': keyId }],
          new: true
        }
      );
    } catch (error) {
      console.error('Error revoking API key:', error);
      throw error;
    }
  }

  /**
   * List all API keys for a tenant
   */
  async listApiKeys(tenantId: string): Promise<Array<{ name: string; key: string; active: boolean; createdAt: Date; lastUsed?: Date }>> {
    try {
      const tenant = await Tenant.findById(tenantId).select('apiKeys');
      return tenant?.apiKeys || [];
    } catch (error) {
      console.error('Error listing API keys:', error);
      return [];
    }
  }

  /**
   * Update tenant branding configuration
   */
  async updateTenantBranding(tenantId: string, branding: any): Promise<ITenant | undefined> {
    try {
      return await Tenant.findByIdAndUpdate(
        tenantId,
        { branding, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating tenant branding:', error);
      return undefined;
    }
  }

  /**
   * Get tenant branding configuration
   */
  async getBranding(tenantId: string): Promise<any | undefined> {
    try {
      const tenant = await Tenant.findById(tenantId).select('branding');
      return tenant?.branding;
    } catch (error) {
      console.error('Error getting branding:', error);
      return undefined;
    }
  }

  /**
   * Update tenant settings (timezone, currency, language, date format)
   */
  async updateTenantSettings(tenantId: string, settings: any): Promise<ITenant | undefined> {
    try {
      const updateData: any = { updatedAt: new Date() };
      if (settings.timezone) updateData.timezone = settings.timezone;
      if (settings.currency) updateData.currency = settings.currency;
      if (settings.language) updateData.language = settings.language;
      if (settings.dateFormat) updateData.dateFormat = settings.dateFormat;

      return await Tenant.findByIdAndUpdate(tenantId, updateData, { new: true });
    } catch (error) {
      console.error('Error updating tenant settings:', error);
      return undefined;
    }
  }

  /**
   * Get tenant settings
   */
  async getTenantSettings(tenantId: string): Promise<any | undefined> {
    try {
      const tenant = await Tenant.findById(tenantId).select(
        'timezone currency language dateFormat'
      );
      return tenant ? {
        timezone: tenant.timezone,
        currency: tenant.currency,
        language: tenant.language,
        dateFormat: tenant.dateFormat
      } : undefined;
    } catch (error) {
      console.error('Error getting tenant settings:', error);
      return undefined;
    }
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsageStats(tenantId: string): Promise<any> {
    try {
      const tenant = await Tenant.findById(tenantId).select('usageStats');
      return tenant?.usageStats || {
        activeUsers: 0,
        apiCallsThisMonth: 0,
        storageUsedMB: 0,
        lastCalculatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }

  /**
   * Update usage statistics
   */
  async updateUsageStats(tenantId: string, stats: any): Promise<void> {
    try {
      await Tenant.findByIdAndUpdate(
        tenantId,
        {
          usageStats: {
            ...stats,
            lastCalculatedAt: new Date()
          },
          updatedAt: new Date()
        },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating usage stats:', error);
      throw error;
    }
  }

  /**
   * Soft delete a tenant (mark as deleted but don't remove)
   */
  async softDeleteTenant(tenantId: string): Promise<void> {
    try {
      await Tenant.findByIdAndUpdate(
        tenantId,
        {
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date()
        }
      );
    } catch (error) {
      console.error('Error soft deleting tenant:', error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted tenant
   */
  async restoreTenant(tenantId: string): Promise<void> {
    try {
      await Tenant.findByIdAndUpdate(
        tenantId,
        {
          deletedAt: undefined,
          isActive: true,
          updatedAt: new Date()
        }
      );
    } catch (error) {
      console.error('Error restoring tenant:', error);
      throw error;
    }
  }

  /**
   * Update tenant feature flags
   */
  async updateTenantFeatures(tenantId: string, features: any): Promise<ITenant | undefined> {
    try {
      return await Tenant.findByIdAndUpdate(
        tenantId,
        { features, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating tenant features:', error);
      return undefined;
    }
  }

  /**
   * Get tenant features
   */
  async getFeatures(tenantId: string): Promise<any> {
    try {
      const tenant = await Tenant.findById(tenantId).select('features');
      return tenant?.features || {
        apiAccess: false,
        customReports: false,
        advancedAnalytics: false,
        whiteLabel: false,
        multiUserAdmin: false,
        sso: false,
        webhooks: false
      };
    } catch (error) {
      console.error('Error getting features:', error);
      return null;
    }
  }

  /**
   * Configure webhook for tenant
   */
  async configureWebhook(tenantId: string, webhookUrl: string, events: string[]): Promise<void> {
    try {
      await Tenant.findByIdAndUpdate(
        tenantId,
        {
          webhookUrl,
          webhookEvents: events,
          updatedAt: new Date()
        }
      );
    } catch (error) {
      console.error('Error configuring webhook:', error);
      throw error;
    }
  }

  /**
   * Get webhook configuration
   */
  async getWebhookConfig(tenantId: string): Promise<{ url?: string; events?: string[] } | undefined> {
    try {
      const tenant = await Tenant.findById(tenantId).select('webhookUrl webhookEvents');
      return tenant ? {
        url: tenant.webhookUrl,
        events: tenant.webhookEvents
      } : undefined;
    } catch (error) {
      console.error('Error getting webhook config:', error);
      return undefined;
    }
  }

  /**
   * Upgrade subscription plan
   */
  async upgradeSubscriptionPlan(tenantId: string, newPlan: string): Promise<ITenant | undefined> {
    try {
      return await Tenant.findByIdAndUpdate(
        tenantId,
        {
          subscriptionPlan: newPlan,
          updatedAt: new Date()
        },
        { new: true }
      );
    } catch (error) {
      console.error('Error upgrading subscription plan:', error);
      return undefined;
    }
  }

  /**
   * Get billing information for a tenant
   */
  async getBillingInfo(tenantId: string): Promise<any> {
    try {
      const tenant = await Tenant.findById(tenantId).select(
        'subscriptionPlan billingCycle billingEmail billingAddress invoicePrefix lastBilledAt'
      );
      return tenant ? {
        plan: tenant.subscriptionPlan,
        billingCycle: tenant.billingCycle,
        email: tenant.billingEmail,
        address: tenant.billingAddress,
        invoicePrefix: tenant.invoicePrefix,
        lastBilledAt: tenant.lastBilledAt
      } : undefined;
    } catch (error) {
      console.error('Error getting billing info:', error);
      return undefined;
    }
  }

  /**
   * Record a billing event (e.g., payment, invoice issued)
   */
  async recordBillingEvent(tenantId: string, event: string, details: any): Promise<void> {
    try {
      // You could store this in a separate BillingEvent collection
      // For now, we just update the lastBilledAt timestamp
      if (event === 'billed' || event === 'payment_received') {
        await Tenant.findByIdAndUpdate(
          tenantId,
          {
            lastBilledAt: new Date(),
            updatedAt: new Date()
          }
        );
      }
    } catch (error) {
      console.error('Error recording billing event:', error);
      throw error;
    }
  }

  private getModel(modelName: string): any {
    const models: Record<string, any> = {
      'Attendance': Attendance,
      'Driver': Driver,
      'User': User,
      'Vehicle': Vehicle,
      'Booking': Booking,
      'Tenant': Tenant,
      'Expense': Expense
    };
    return models[modelName] || null;
  }
}

export const storage = new MongoDBStorage();