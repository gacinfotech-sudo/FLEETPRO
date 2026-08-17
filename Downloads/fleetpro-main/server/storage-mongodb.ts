import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import mongoose from 'mongoose';
import { Tenant, User, Vehicle, Driver, Booking, Expense, Attendance, ITenant, IUser, IVehicle, IDriver, IBooking, IExpense, IAttendance } from './models';

export interface IStorage {
  // Auth methods
  getUserByCredentials(userId: string, password: string): Promise<IUser | undefined>;
  updateUserSession(id: string, sessionId: string | null, deviceInfo?: any): Promise<void>;
  getUserBySessionId(sessionId: string): Promise<IUser | undefined>;
  getUserSession(id: string): Promise<{ sessionId: string; deviceInfo?: any } | undefined>;
  resetUserPassword(id: string, newPassword: string): Promise<void>;
  adminResetUserPassword(userId: string, tempPassword: string): Promise<void>;
  updateUserLoginInfo(id: string, ip: string, userAgent: string): Promise<void>;

  // Tenant methods
  createTenant(tenant: Partial<ITenant>): Promise<ITenant>;
  getTenants(): Promise<ITenant[]>;
  getTenant(id: string): Promise<ITenant | undefined>;
  updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  // User methods
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

  // Booking methods
  createBooking(booking: any): Promise<IBooking>;
  getBookingsByTenant(tenantId: string): Promise<IBooking[]>;
  getBooking(id: string): Promise<IBooking | undefined>;
  updateBooking(id: string, data: any): Promise<IBooking | undefined>;
  deleteBooking(id: string): Promise<void>;
  getUpcomingBookings(tenantId: string): Promise<IBooking[]>;
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
}

export class MongoDBStorage implements IStorage {
  constructor() {}

  // Auth methods
  async getUserByCredentials(userId: string, password: string): Promise<IUser | undefined> {
    try {
      // Escape special regex characters and make case-insensitive
      const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      console.log('DEBUG getUserByCredentials - searching for userId:', userId);
      const user = await User.findOne({
        userId: new RegExp('^' + escapedUserId + '$', 'i')
      }).populate('tenantId');

      console.log('DEBUG getUserByCredentials - user found:', user ? user.userId : 'NULL', 'id:', user?._id);
      if (!user) return undefined;

      // Password remains case-sensitive
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) return undefined;
      console.log('DEBUG getUserByCredentials - password valid, returning user');
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

      console.log('DEBUG updateUserSession - id:', id, 'sessionId:', sessionId);

      // First check if user exists
      const existingUser = await User.findById(id);
      console.log('DEBUG User exists?', existingUser ? existingUser.userId : 'NO');

      const result = await User.findByIdAndUpdate(id, updateData, { new: true });
      console.log('DEBUG updateUserSession result:', result?.userId, 'sessionId in DB:', result?.sessionId);
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
      console.log('DEBUG getUserBySessionId - searching for sessionId:', sessionId);
      const user = await User.findOne({ sessionId }).populate('tenantId') || undefined;

      console.log('DEBUG getUserBySessionId - user found:', user ? user.userId : 'NULL');
      if (user) {
        console.log('User loaded by sessionId:', {
          userId: user.userId,
          role: user.role,
          tenantId: user.tenantId,
          tenantIdType: typeof user.tenantId
        });
      }

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
      return await Tenant.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting tenant:', error);
      return undefined;
    }
  }

  async updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant | undefined> {
    try {
      return await Tenant.findByIdAndUpdate(id, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating tenant:', error);
      return undefined;
    }
  }

  async deleteTenant(id: string): Promise<void> {
    try {
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
        console.log('Converting tenantId from string to ObjectId:', userData.tenantId);
        userData.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }

      console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });

      const user = new User(userData);
      const savedUser = await user.save();

      console.log('User created successfully:', { 
        id: savedUser._id, 
        userId: savedUser.userId, 
        tenantId: savedUser.tenantId 
      });

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
      return await User.find({ tenantId }).populate('tenantId');
    } catch (error) {
      console.error('Error getting users by tenant:', error);
      throw error;
    }
  }

  async updateUser(id: string, data: Partial<IUser>): Promise<IUser | undefined> {
    try {
      // Store user ID in lowercase for consistency
      if (data.userId) {
        data.userId = data.userId.toLowerCase();
      }

      if (data.password) {
        data.password = await bcrypt.hash(data.password, 12);
      }

      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
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
      return await Vehicle.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting vehicle:', error);
      return undefined;
    }
  }

  async updateVehicle(id: string, data: any): Promise<IVehicle | undefined> {
    try {
      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
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
      return await Driver.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting driver:', error);
      return undefined;
    }
  }

  async updateDriver(id: string, data: any): Promise<IDriver | undefined> {
    try {
      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
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
      // Convert string IDs to ObjectIds if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }
      if (data.vehicleId && typeof data.vehicleId === 'string') {
        data.vehicleId = new mongoose.Types.ObjectId(data.vehicleId);
      }
      if (data.driverId && typeof data.driverId === 'string') {
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
        console.log('Fleet Utilization Debug:', {
          fleetSize,
          uniqueVehiclesWithBookings: vehiclesWithBookings.length,
          vehicleIds: vehiclesWithBookings
        });
        fleetUtilization = (vehiclesWithBookings.length / fleetSize) * 100;
        // Ensure it doesn't exceed 100%
        fleetUtilization = Math.min(fleetUtilization, 100);
        console.log('Calculated fleet utilization:', fleetUtilization);
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

      console.log('Creating sub-user with data:', { ...userData, password: '[HIDDEN]' });

      const user = new User(userData);
      const savedUser = await user.save();

      console.log('Sub-user created successfully:', { 
        id: savedUser._id, 
        userId: savedUser.userId, 
        role: savedUser.role,
        createdBy: savedUser.createdBy 
      });

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
      console.log(`Sub-user ${userId} deactivated by ${deactivatedBy}`);
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
      console.log(`Sub-user ${userId} reactivated by ${reactivatedBy}`);
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
      console.log(`Fixed ${result.modifiedCount} bookings without audit trail`);
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

      console.log(`Deactivated tenant ${tenantId} and all associated users`);
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

      console.log(`Activated tenant ${tenantId} and all associated users`);
    } catch (error) {
      console.error('Error activating client and managers:', error);
      throw error;
    }
  }

  async markOnboardingComplete(userId: string): Promise<void> {
    console.log('Marking onboarding complete for userId:', userId);

    const user = await User.findOne({ userId });
    if (!user) {
      console.error('User not found for onboarding completion:', userId);
      throw new Error("User not found");
    }

    console.log('Current onboarding status:', user.hasCompletedOnboarding);
    user.hasCompletedOnboarding = true;
    await user.save();
    console.log('Onboarding marked complete for user:', userId);
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