import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { THIRTY_DAYS_MS } from "./constants/index.js";
import { storage } from "./storage-mongodb";
import { authenticateUser, requireAdmin, requireTenant, type AuthRequest } from "./middleware/auth";
import { 
  validatePasswordStrength, 
  loginRateLimit, 
  loginSpeedLimit, 
  httpsRedirect, 
  securityHeaders,
  trackLoginAttempt,
  getRecentFailedAttempts,
  getLastLoginInfo,
  checkUserLockout,
  loginAttempts,
  sanitizeInput,
  ipBlockingMiddleware,
  sessionSecurityMiddleware,
  databaseSecurityMiddleware,
  type LoginAttempt
} from "./middleware/security";
import { z } from "zod";
import { nanoid } from "nanoid";
import mongoose from "mongoose";
import {
  mongoTenantSchema,
  mongoUserSchema,
  mongoVehicleSchema,
  mongoDriverSchema,
  mongoBookingSchema
} from "./schemas/mongodb-schemas";
import { LeaveManagementService } from "./services/LeaveManagementService";
import driverOnboardingRoutes from "./routes/driverOnboardingRoutes.js";
import userOnboardingRoutes from "./routes/userOnboardingRoutes";
import signupRoutes from "./routes/signupRoutes";
import plansRoutes from "./routes/plansRoutes";
import subscriptionsRoutes from "./routes/subscriptionsRoutes";
import invoicingRoutes from "./routes/invoicingRoutes";
import paymentsRoutes from "./routes/paymentsRoutes";
import authAdvancedRoutes from "./routes/auth-advanced.js";
import { protectLoginEndpoint, recordFailedLogin, clearBruteForceOnSuccess, protectAdminEndpoint } from "./middleware/adminLimiter.js";
import { RenewalScheduler } from "./services/RenewalScheduler";
import { Attendance, DriverSalary, Driver } from "./models";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply enhanced security middleware
  app.use(httpsRedirect);
  app.use(securityHeaders);
  app.use(ipBlockingMiddleware);
  app.use(sanitizeInput);
  app.use(databaseSecurityMiddleware);
  
  // Session configuration with enhanced security and PWA support
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required but not set');
  }

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: THIRTY_DAYS_MS, // 30 days for PWA persistence
      sameSite: 'lax',
      domain: process.env.COOKIE_DOMAIN || (process.env.NODE_ENV === 'production' ? '.fleetpro.com' : undefined)
    }
  }));

  // Apply session security middleware
  app.use(sessionSecurityMiddleware);

  // Multer configuration for logo uploads
  const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/logos';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const userId = user?.userId || 'user';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `logo_${userId}_${timestamp}${ext}`;
      cb(null, filename);
    }
  });

  const logoUpload = multer({
    storage: logoStorage,
    limits: {
      fileSize: 20480 // 20KB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
      }
    }
  });

  // Signature upload configuration
  const signatureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/signatures';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const userId = user?.userId || 'user';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `signature_${userId}_${timestamp}${ext}`;
      cb(null, filename);
    }
  });

  const signatureUpload = multer({
    storage: signatureStorage,
    limits: {
      fileSize: 20480 // 20KB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
      }
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static('uploads'));

  // Auth Routes with security enhancements
  app.post("/api/auth/login", checkUserLockout, protectLoginEndpoint, recordFailedLogin, async (req, res) => {
    try {
      const { userId, password } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!userId || !password) {
        return res.status(400).json({ message: "User ID and password are required" });
      }

      // Check for recent failed attempts
      const recentFailedAttempts = getRecentFailedAttempts(userId);
      if (recentFailedAttempts >= 5) {
        trackLoginAttempt(userId, clientIP, false, userAgent);
        return res.status(429).json({ 
          message: "Account temporarily locked due to too many failed login attempts. Please wait 5 minutes.",
          lockoutTime: 5 * 60
        });
      }

      const user = await storage.getUserByCredentials(userId, password);
      
      if (!user) {
        // Track failed login attempt
        trackLoginAttempt(userId, clientIP, false, userAgent);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is active
      if (!user.isActive) {
        if (user.role === 'client') {
          return res.status(403).json({ 
            message: "Your service has been paused due to pending payment. Please contact your administrator to reactivate your account.",
            code: "ACCOUNT_INACTIVE"
          });
        } else if (user.role === 'manager') {
          return res.status(403).json({ 
            message: "Your organization has deactivated your account. Please contact your administrator for assistance.",
            code: "ACCOUNT_DEACTIVATED"
          });
        }
      }

      // Track successful login
      trackLoginAttempt(userId, clientIP, true, userAgent);
      
      // Update last login information in database
      await storage.updateUserLoginInfo(user.id, clientIP, userAgent);

      // PWA-friendly session management - allow longer sessions but prevent concurrent logins
      const sessionId = nanoid();
      const deviceInfo = {
        userAgent: userAgent,
        ip: clientIP,
        loginTime: new Date()
      };
      
      // Always update session in database
      try {
        await storage.updateUserSession(user.id, sessionId, deviceInfo);
      } catch (error) {
        console.error('Error updating user session:', error);
        console.error("Session creation error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
      
      // Set session cookie with sessionId AND backup user details
      (req.session as any).userId = sessionId;
      (req.session as any).userDetails = {
        id: user.id,
        userId: user.userId,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
        _fromSession: true // Mark that this came from session fallback
      };

      // Save session to ensure it's properly stored before response
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Internal server error" });
        }

        // Clear brute force protection on successful login
        clearBruteForceOnSuccess(userId);

        res.json({
          user: {
            id: user.id,
            userId: user.userId,
            role: user.role,
            tenantId: user.tenantId,
            mustResetPassword: user.mustResetPassword,
            hasCompletedOnboarding: user.hasCompletedOnboarding || false,
            isActive: user.isActive
          }
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      console.error("Login error - complete failure:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Fix tenant association for users without tenantId
  app.post("/api/admin/fix-tenant-links", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenants = await storage.getTenants();
      const users = await storage.getUsers();
      
      let fixedCount = 0;
      
      for (const user of users) {
        if (user.role === 'client' && !user.tenantId) {
          // Find tenant with matching name to userId
          const tenant = tenants.find(t => t.name === user.userId);
          if (tenant) {
            await storage.updateUser(user._id || user.id, { tenantId: tenant._id || tenant.id });
            fixedCount++;
          }
        }
      }
      
      res.json({ message: `Fixed ${fixedCount} users`, fixedCount });
    } catch (error) {
      console.error('Error fixing tenant links:', error);
      console.error("Fix tenant links error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", authenticateUser, async (req: AuthRequest, res) => {
    try {
      await storage.updateUserSession(req.user.id, null);
      req.session.destroy((err) => {
        if (err) {
          return console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Use user already authenticated by middleware (already set in req.user)
      let user = req.user;

      // Optionally try to refresh from database if ID exists
      if (req.user.id && !req.user._fromSession) {
        const dbUser = await storage.getUser(req.user.id);
        if (dbUser) {
          user = dbUser;
        }
      }

      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      res.json({
        user: {
          id: user.id,
          userId: user.userId,
          role: user.role,
          tenantId: user.tenantId,
          mustResetPassword: user.mustResetPassword,
          hasCompletedOnboarding: user.hasCompletedOnboarding || false,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error('Error in /api/auth/me:', error);
      console.error("Fetch user data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/complete-onboarding", authenticateUser, async (req: AuthRequest, res) => {
    try {
      
      // Only allow client users to complete onboarding
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Only client users can complete onboarding" });
      }
      
      await storage.markOnboardingComplete(req.user.userId);
      res.json({ message: "Onboarding completed successfully" });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      console.error("Complete onboarding error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { newPassword, confirmPassword } = req.body;
      
      // Validate passwords
      if (!newPassword || !confirmPassword) {
        return res.status(400).json({ message: "Both password fields are required" });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }
      
      // Enhanced password strength validation
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      
      // Reset password
      await storage.resetUserPassword(req.user.id, newPassword);
      
      // Clear session to force re-login with new password
      req.session.destroy((err) => {
        if (err) {
          return console.error("Password reset error:", error);
      res.status(500).json({ message: "Internal server error" });
        }
        res.json({ message: "Password reset successfully. Please login with your new password." });
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Business profile routes
  app.get("/api/auth/business-profile", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let businessDetails = null;
      let tenantInfo = null;
      
      if (user.role === 'manager') {
        // For managers, don't return business details in profile view
        // They inherit the profile for invoices but can't see the details
        businessDetails = null;
        
        if (user.tenantId) {
          const tenantIdString = typeof user.tenantId === 'object' && user.tenantId._id 
            ? user.tenantId._id.toString() 
            : user.tenantId.toString();
          tenantInfo = await storage.getTenant(tenantIdString);
        }
      } else if (user.role === 'client') {
        // For client users, use their own business profile and get tenant info
        businessDetails = user.businessDetails || null;
        
        if (user.tenantId) {
          const tenantIdString = typeof user.tenantId === 'object' && user.tenantId._id 
            ? user.tenantId._id.toString() 
            : user.tenantId.toString();
          tenantInfo = await storage.getTenant(tenantIdString);
        }
      } else {
        // For admin users, use their own profile (if any)
        businessDetails = user.businessDetails || null;
      }
      
      res.json({ 
        businessDetails,
        maxManagers: tenantInfo?.maxManagers || 5
      });
    } catch (error) {
      console.error('Error fetching business profile:', error);
      console.error("Fetch business profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Separate endpoint for invoice/report business profile data (includes inherited data for managers)
  app.get("/api/auth/business-profile-for-documents", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let businessDetails = null;
      
      if (user.role === 'manager') {
        // For managers, get business profile from their company owner (client) for documents
        if (user.tenantId) {
          const tenantIdString = typeof user.tenantId === 'object' && user.tenantId._id 
            ? user.tenantId._id.toString() 
            : user.tenantId.toString();
          
          // Find the client user for this tenant who has the business profile
          const tenantUsers = await storage.getUsersByTenant(tenantIdString);
          const clientUser = tenantUsers.find(u => u.role === 'client');
          
          if (clientUser && clientUser.businessDetails) {
            businessDetails = clientUser.businessDetails;
          }
        }
      } else if (user.role === 'client') {
        // For client users, use their own business profile
        businessDetails = user.businessDetails || null;
      } else {
        // For admin users, use their own profile (if any)
        businessDetails = user.businessDetails || null;
      }
      
      res.json({ 
        businessDetails
      });
    } catch (error) {
      console.error('Error fetching business profile for documents:', error);
      console.error("Fetch business profile for documents error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/auth/business-profile", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow client users and admins to update business profile
      if (req.user.role === 'manager') {
        return res.status(403).json({
          message: "Access denied. Managers inherit business profile from their company owner. Contact your administrator to update business details."
        });
      }

      const { businessName, ownerName, businessAddress, gstNumber, businessEmail, businessPhone } = req.body;

      // Validate required fields
      if (!businessName || !ownerName || !businessAddress || !businessEmail || !businessPhone) {
        return res.status(400).json({ message: "All fields except GST number are required" });
      }

      // Validate string lengths
      if (businessName.length < 1 || businessName.length > 255) {
        return res.status(400).json({ message: "Business name must be between 1 and 255 characters" });
      }

      if (ownerName.length < 1 || ownerName.length > 255) {
        return res.status(400).json({ message: "Owner name must be between 1 and 255 characters" });
      }

      if (businessPhone.length < 7 || businessPhone.length > 20) {
        return res.status(400).json({ message: "Business phone must be between 7 and 20 characters" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(businessEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Get existing user data to preserve logo and signature URLs
      const existingUser = await storage.getUser(req.user.id);
      const existingBusinessDetails = existingUser?.businessDetails as any || {};

      const businessDetails = {
        businessName,
        ownerName,
        businessAddress,
        gstNumber: gstNumber || "",
        businessEmail,
        businessPhone,
        // Preserve existing logo and signature URLs
        logoUrl: existingBusinessDetails?.logoUrl || "",
        signatureUrl: existingBusinessDetails?.signatureUrl || ""
      };


      await storage.updateUser(req.user.id, { businessDetails });
      res.json({ message: "Business profile updated successfully", businessDetails });
    } catch (error) {
      console.error("Update business profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logo upload endpoint
  app.post("/api/auth/upload-logo", authenticateUser, logoUpload.single('logo'), async (req: AuthRequest, res) => {
    
    try {
      // Only allow client users and admins to upload logos
      if (req.user.role === 'manager') {
        // Remove uploaded file if it exists
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ 
          message: "Access denied. Managers inherit business profile from their company owner. Contact your administrator to update logo." 
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No logo file provided" });
      }

      // Validate file size again on server side
      if (req.file.size > 76800) {
        // Remove the uploaded file if it's too large
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "File size must be 75KB or less" });
      }

      // Check if file actually exists on disk
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({ message: "File upload failed - file not saved" });
      }

      // Convert logo to base64 for permanent storage
      const logoBuffer = fs.readFileSync(req.file.path);
      const logoBase64 = `data:${req.file.mimetype};base64,${logoBuffer.toString('base64')}`;

      // Clean up the temporary file
      fs.unlinkSync(req.file.path);

      // Update user's business details with logo base64
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }


      // Update business details with logo base64 - preserve existing details or use defaults
      const existingDetails = user.businessDetails || {} as any;
      const updatedBusinessDetails = {
        businessName: existingDetails.businessName || "Company Name",
        ownerName: existingDetails.ownerName || "Owner Name", 
        businessAddress: existingDetails.businessAddress || "Business Address",
        gstNumber: existingDetails.gstNumber || "",
        businessEmail: existingDetails.businessEmail || "contact@company.com",
        businessPhone: existingDetails.businessPhone || "0000000000",
        logoUrl: logoBase64
      };

      
      const updatedUser = await storage.updateUser(req.user.id, { businessDetails: updatedBusinessDetails });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to save logo data to database" });
      }
      

      res.json({ 
        message: "Logo uploaded successfully", 
        logoUrl: logoBase64,
        filename: req.file.filename 
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      // Remove uploaded file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to remove uploaded file:', unlinkError);
        }
      }
      console.error("Logo upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Signature upload endpoint
  app.post("/api/auth/upload-signature", authenticateUser, signatureUpload.single('signature'), async (req: AuthRequest, res) => {
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No signature file provided" });
      }

      // Validate file size again on server side
      if (req.file.size > 20480) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "File size must be 20KB or less" });
      }

      // Check if file actually exists on disk
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({ message: "File upload failed - file not saved" });
      }

      // Convert signature to base64 for permanent storage
      const signatureBuffer = fs.readFileSync(req.file.path);
      const signatureBase64 = `data:${req.file.mimetype};base64,${signatureBuffer.toString('base64')}`;

      // Clean up the temporary file
      fs.unlinkSync(req.file.path);

      // Update user's business details with signature base64
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }


      // Update business details with signature base64 - preserve existing details
      const existingDetails = user.businessDetails || {} as any;
      const updatedBusinessDetails = {
        businessName: existingDetails.businessName || "Company Name",
        ownerName: existingDetails.ownerName || "Owner Name", 
        businessAddress: existingDetails.businessAddress || "Business Address",
        gstNumber: existingDetails.gstNumber || "",
        businessEmail: existingDetails.businessEmail || "contact@company.com",
        businessPhone: existingDetails.businessPhone || "0000000000",
        logoUrl: existingDetails.logoUrl || "",
        signatureUrl: signatureBase64
      };

      
      const updatedUser = await storage.updateUser(req.user.id, { businessDetails: updatedBusinessDetails });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to save signature data to database" });
      }
      

      res.json({ 
        message: "Signature uploaded successfully", 
        signatureUrl: signatureBase64,
        filename: req.file.filename 
      });
    } catch (error) {
      console.error('Signature upload error:', error);
      // Remove uploaded file on error if it still exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to remove uploaded file:', unlinkError);
        }
      }
      console.error("Signature upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin Security Monitoring
  app.get("/api/admin/security/stats", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      // Flatten all login attempts from the Map into a single array
      const allAttempts: LoginAttempt[] = [];
      Array.from(loginAttempts.entries()).forEach(([userId, userAttempts]) => {
        allAttempts.push(...userAttempts);
      });
      
      // Filter for recent attempts (last 24 hours)
      const recentAttempts = allAttempts.filter((attempt: LoginAttempt) => 
        Date.now() - attempt.timestamp.getTime() < 24 * 60 * 60 * 1000
      );
      
      const failedAttempts = recentAttempts.filter((attempt: LoginAttempt) => !attempt.success);
      const successfulAttempts = recentAttempts.filter((attempt: LoginAttempt) => attempt.success);
      
      const uniqueFailedIPs = Array.from(new Set(failedAttempts.map((attempt: LoginAttempt) => attempt.ip)));
      const failedByUser = failedAttempts.reduce((acc: Record<string, number>, attempt: LoginAttempt) => {
        acc[attempt.userId] = (acc[attempt.userId] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        totalAttempts: recentAttempts.length,
        successfulLogins: successfulAttempts.length,
        failedLogins: failedAttempts.length,
        uniqueFailedIPs: uniqueFailedIPs.length,
        suspiciousUsers: Object.entries(failedByUser)
          .filter(([_, count]) => (count as number) >= 3)
          .map(([userId, count]) => ({ userId, attempts: count })),
        recentFailures: failedAttempts
          .slice(-10)
          .map((attempt: LoginAttempt) => ({
            userId: attempt.userId,
            ip: attempt.ip,
            timestamp: attempt.timestamp,
            userAgent: attempt.userAgent
          }))
      });
    } catch (error) {
      console.error("Error getting security stats:", error);
      console.error("Get security stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin Routes
  app.get("/api/admin/tenants", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Fetch tenants error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/tenants", authenticateUser, requireAdmin, async (req, res) => {
    try {
      
      // Clean the data before validation
      const cleanedData = { ...req.body };
      if (cleanedData.email === "") delete cleanedData.email;
      if (cleanedData.phone === "") delete cleanedData.phone;
      if (cleanedData.address === "") delete cleanedData.address;
      
      const tenantData = mongoTenantSchema.parse(cleanedData);
      const tenant = await storage.createTenant(tenantData);
      res.json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid tenant data", errors: error.errors });
      }
      console.error('Tenant creation error:', error);
      console.error("Tenant creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/tenants/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid tenant ID format" });
      }

      const tenantData = mongoTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(id, tenantData);

      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid tenant data", errors: error.errors });
      }
      console.error("Tenant update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/tenants/:id", authenticateUser, requireAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const id = req.params.id;

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid tenant ID format" });
      }

      // First, find and delete the associated user(s) for this tenant within transaction
      const tenantUsers = await storage.getUsersByTenant(id);
      for (const user of tenantUsers) {
        await storage.deleteUser(user.id);
      }

      // Then delete the tenant within transaction
      await storage.deleteTenant(id);

      // Commit transaction
      await session.commitTransaction();
      res.json({ message: "Client and associated user(s) deleted successfully" });
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      console.error("Tenant deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    } finally {
      await session.endSession();
    }
  });

  app.get("/api/admin/users", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Fetch users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userData = mongoUserSchema.parse(req.body);
      // Create user data with proper ObjectId conversion
      const userToCreate: any = { ...userData };
      if (userData.tenantId) {
        userToCreate.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }
      const user = await storage.createUser(userToCreate);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("User creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/users/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      const userData = mongoUserSchema.partial().parse(req.body);
      // Convert tenantId to ObjectId if it's a string
      const userToUpdate: any = { ...userData };
      if (userData.tenantId) {
        if (!mongoose.Types.ObjectId.isValid(userData.tenantId)) {
          return res.status(400).json({ message: "Invalid tenant ID format" });
        }
        userToUpdate.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }
      const user = await storage.updateUser(id, userToUpdate);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("User update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("User deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { tempPassword } = req.body;
      
      if (!tempPassword) {
        return res.status(400).json({ message: "Temporary password is required" });
      }
      
      if (tempPassword.length < 6) {
        return res.status(400).json({ message: "Temporary password must be at least 6 characters long" });
      }
      
      await storage.adminResetUserPassword(userId, tempPassword);
      res.json({ message: "User password reset successfully. User will be required to set a new password on next login." });
    } catch (error) {
      console.error("Password reset failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin toggle user activation endpoint
  app.patch("/api/admin/users/:id/toggle-activation", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }
      
      await storage.updateUser(userId, { isActive });
      res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
    } catch (error) {
      console.error("User activation update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced Admin Routes for Manager Control

  // Get managers for a specific tenant
  app.get("/api/admin/tenants/:tenantId/managers", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const managers = await storage.getManagersByTenant(tenantId);
      res.json(managers);
    } catch (error) {
      console.error("Fetch managers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update tenant manager limit
  app.patch("/api/admin/tenants/:tenantId/manager-limit", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { maxManagers } = req.body;
      
      if (typeof maxManagers !== 'number' || maxManagers < 0) {
        return res.status(400).json({ message: "maxManagers must be a positive number" });
      }
      
      await storage.updateTenant(tenantId, { maxManagers });
      res.json({ message: "Manager limit updated successfully" });
    } catch (error) {
      console.error("Manager limit update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset manager password (admin action)
  app.post("/api/admin/managers/:managerId/reset-password", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const managerId = req.params.managerId;
      const { tempPassword } = req.body;
      
      if (!tempPassword || tempPassword.length < 6) {
        return res.status(400).json({ message: "Temporary password must be at least 6 characters long" });
      }
      
      await storage.adminResetUserPassword(managerId, tempPassword);
      res.json({ message: "Manager password reset successfully" });
    } catch (error) {
      console.error("Manager password reset failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Deactivate client and all managers
  app.patch("/api/admin/tenants/:tenantId/deactivate-all", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      await storage.deactivateClientAndManagers(tenantId);
      res.json({ message: "Client and all managers deactivated successfully" });
    } catch (error) {
      console.error("Client deactivation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activate client and all managers
  app.patch("/api/admin/tenants/:tenantId/activate-all", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      await storage.activateClientAndManagers(tenantId);
      res.json({ message: "Client and all managers activated successfully" });
    } catch (error) {
      console.error("Client activation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete manager (admin action)
  app.delete("/api/admin/managers/:managerId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const managerId = req.params.managerId;
      await storage.deleteUser(managerId);
      res.json({ message: "Manager deleted successfully" });
    } catch (error) {
      console.error("Manager deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Subscription Plan Management Routes
  
  // Get tenant plan and limits
  app.get("/api/admin/tenants/:tenantId/plan", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      const limits = await storage.getTenantLimits(tenantId);
      
      res.json({
        subscriptionPlan: tenant.subscriptionPlan || 'starter',
        limits: limits || { vehicles: 6, drivers: 3, managers: 1 }
      });
    } catch (error) {
      console.error("Fetch plan details error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update tenant plan and limits
  app.patch("/api/admin/tenants/:tenantId/plan", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { subscriptionPlan, limits } = req.body;
      
      // Validate subscription plan
      const validPlans = ['starter', 'pro', 'custom'];
      if (!validPlans.includes(subscriptionPlan)) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }
      
      // Validate limits
      if (!limits || typeof limits.vehicles !== 'number' || typeof limits.drivers !== 'number' || typeof limits.managers !== 'number') {
        return res.status(400).json({ message: "Invalid limits format" });
      }
      
      if (limits.vehicles < 1 || limits.drivers < 1 || limits.managers < 1) {
        return res.status(400).json({ message: "All limits must be at least 1" });
      }
      
      const updatedTenant = await storage.updateTenantPlan(tenantId, subscriptionPlan, limits);
      if (!updatedTenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      res.json({ 
        message: "Plan updated successfully",
        subscriptionPlan: updatedTenant.subscriptionPlan,
        limits: updatedTenant.limits
      });
    } catch (error) {
      console.error('Error updating tenant plan:', error);
      console.error("Plan update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check current usage vs limits for a tenant
  app.get("/api/admin/tenants/:tenantId/usage", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      
      const [vehicleUsage, driverUsage, managerUsage] = await Promise.all([
        storage.checkVehicleLimit(tenantId),
        storage.checkDriverLimit(tenantId),
        storage.checkManagerLimit(tenantId)
      ]);
      
      res.json({
        vehicles: vehicleUsage,
        drivers: driverUsage,
        managers: managerUsage
      });
    } catch (error) {
      console.error("Fetch usage data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getTenantStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      console.error("Fetch stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Management Routes (for admins and clients to manage sub-users)
  app.post("/api/users/sub-users", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to create sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can create sub-users." });
      }

      // Check manager limit for clients (admins can bypass)
      if (req.user?.role === 'client') {
        const tenant = await storage.getTenant(req.tenantId!);
        if (!tenant) {
          return res.status(404).json({ message: "Tenant not found" });
        }

        const existingManagers = await storage.getManagersByTenant(req.tenantId!);
        const maxManagers = tenant.maxManagers || 5; // Default to 5 if not set

        if (existingManagers.length >= maxManagers) {
          return res.status(400).json({ 
            message: `You've reached the manager limit (${maxManagers}). Contact admin to increase your limit.`,
            currentCount: existingManagers.length,
            maxAllowed: maxManagers
          });
        }
      }

      // Extract and validate permissions
      const defaultPermissions = [
        'create_booking',
        'view_bookings',
        'edit_booking',
        'generate_invoice'
      ];
      
      const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : defaultPermissions;
      

      
      const userData = {
        userId: req.body.userId,
        password: req.body.password,
        name: req.body.name,
        role: 'manager', // Sub-users are always managers
        tenantId: req.tenantId, // Use the tenant ID from the authenticated user
        isActive: true,
        permissions: permissions
      };

      const subUser = await storage.createSubUser(userData, req.userId!);
      
      // Remove password from response
      const { password, ...userResponse } = subUser.toObject();
      
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Error creating sub-user:", error);
      console.error("Sub-user creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/sub-users", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to view sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can view sub-users." });
      }

      const subUsers = await storage.getSubUsersByTenant(req.tenantId!);
      res.json(subUsers);
    } catch (error) {
      console.error("Error fetching sub-users:", error);
      console.error("Fetch sub-users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  app.delete("/api/users/sub-users/:userId", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to deactivate sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can deactivate sub-users." });
      }

      const userIdToDeactivate = req.params.userId;
      await storage.deactivateSubUser(userIdToDeactivate, req.userId!);
      
      res.json({ message: "Sub-user deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating sub-user:", error);
      console.error("Sub-user deactivation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/sub-users/:userId/reactivate", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to reactivate sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can reactivate sub-users." });
      }

      const userIdToReactivate = req.params.userId;
      await storage.reactivateSubUser(userIdToReactivate, req.userId!);
      
      res.json({ message: "Sub-user reactivated successfully" });
    } catch (error) {
      console.error("Error reactivating sub-user:", error);
      console.error("Sub-user reactivation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Revenue Report
  app.get("/api/reports/revenue", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;

      const report = await storage.getRevenueReport(
        req.tenantId!,
        startDate as string,
        endDate as string
      );

      res.json(report);
    } catch (error) {
      console.error("Error fetching revenue report:", error);
      console.error("Revenue report fetch error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Vehicle Routes
  app.get("/api/vehicles", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const vehicles = await storage.getVehiclesByTenant(req.tenantId!);
      res.json(vehicles);
    } catch (error) {
      console.error("Fetch vehicles error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/vehicles", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Check vehicle limit before adding
      const vehicleUsage = await storage.checkVehicleLimit(req.tenantId!);
      if (!vehicleUsage.canAdd) {
        return res.status(400).json({ 
          message: `You've reached your maximum allowed vehicles (${vehicleUsage.limit}). Upgrade your plan or contact admin.`,
          current: vehicleUsage.current,
          limit: vehicleUsage.limit
        });
      }

      // Map frontend field names to MongoDB schema
      const mappedData = {
        ...req.body,
        tenantId: req.tenantId,
        // Handle different model field names
        vehicleModel: req.body.vehicleModel || req.body.model,
        // Handle different license plate field names  
        licensePlate: req.body.licensePlate || req.body.registrationNumber,
        // Handle different vehicle type mappings
        type: req.body.vehicleType && ['sedan', 'hatchback', 'coupe', 'convertible'].includes(req.body.vehicleType) 
          ? req.body.vehicleType 
          : req.body.type || 'economy',
        // Handle different pricing field names
        pricePerDay: req.body.ratePerDay || req.body.dailyRate || req.body.pricePerDay || 0,
        pricePerHour: req.body.hourlyRate || req.body.pricePerHour || 0,
        pricePerKm: req.body.ratePerKm || req.body.pricePerKm || 0
      };
      
      const vehicleData = mongoVehicleSchema.parse(mappedData);
      const vehicle = await storage.createVehicle(vehicleData);
      res.json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vehicle data", errors: error.errors });
      }
      console.error("Vehicle creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/vehicles/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID format" });
      }

      // Map frontend field names to MongoDB schema for updates
      const mappedData = {
        ...req.body,
        // Handle different model field names
        vehicleModel: req.body.vehicleModel || req.body.model,
        // Handle different license plate field names  
        licensePlate: req.body.licensePlate || req.body.registrationNumber,
        // Handle different vehicle type mappings
        type: req.body.vehicleType && ['sedan', 'hatchback', 'coupe', 'convertible'].includes(req.body.vehicleType) 
          ? req.body.vehicleType 
          : req.body.type,
        // Handle different pricing field names
        pricePerDay: req.body.ratePerDay || req.body.dailyRate || req.body.pricePerDay,
        pricePerHour: req.body.hourlyRate || req.body.pricePerHour,
        pricePerKm: req.body.ratePerKm || req.body.pricePerKm
      };
      
      const vehicleData = mongoVehicleSchema.partial().parse(mappedData);
      const vehicle = await storage.updateVehicle(id, vehicleData);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      res.json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Vehicle update error:", error);
      console.error("Vehicle update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/vehicles/:id", authenticateUser, requireTenant, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteVehicle(id);
      res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
      console.error("Vehicle deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/vehicles/available", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { pickupDate, returnDate } = req.query;

      if (!pickupDate || !returnDate) {
        return res.status(400).json({ message: "Pickup and return dates are required" });
      }

      // Validate date formats
      const pickupTime = new Date(pickupDate as string).getTime();
      const returnTime = new Date(returnDate as string).getTime();

      if (isNaN(pickupTime) || isNaN(returnTime)) {
        return res.status(400).json({ message: "Invalid date format. Please use ISO 8601 format." });
      }

      if (pickupTime >= returnTime) {
        return res.status(400).json({ message: "Pickup date must be before return date" });
      }

      const vehicles = await storage.getAvailableVehicles(
        req.tenantId!,
        pickupDate as string,
        returnDate as string
      );
      res.json(vehicles);
    } catch (error) {
      console.error("Fetch available vehicles error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Driver Routes
  app.get("/api/drivers", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const drivers = await storage.getDriversByTenant(req.tenantId!);
      res.json(drivers);
    } catch (error) {
      console.error("Fetch drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/drivers", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Check driver limit before adding
      const driverUsage = await storage.checkDriverLimit(req.tenantId!);
      if (!driverUsage.canAdd) {
        return res.status(400).json({ 
          message: `You've reached your maximum allowed drivers (${driverUsage.limit}). Upgrade your plan or contact admin.`,
          current: driverUsage.current,
          limit: driverUsage.limit
        });
      }

      const driverData = mongoDriverSchema.parse({ ...req.body, tenantId: req.tenantId });
      const driver = await storage.createDriver(driverData);
      res.json(driver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid driver data", errors: error.errors });
      }
      console.error("Driver creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/drivers/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid driver ID format" });
      }

      const driverData = mongoDriverSchema.partial().parse(req.body);
      const driver = await storage.updateDriver(id, driverData);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      res.json(driver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Driver update error:", error);
      console.error("Driver update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/drivers/:id", authenticateUser, requireTenant, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteDriver(id);
      res.json({ message: "Driver deleted successfully" });
    } catch (error) {
      console.error("Driver deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/drivers/available", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { pickupDate, returnDate } = req.query;

      if (!pickupDate || !returnDate) {
        return res.status(400).json({ message: "Pickup and return dates are required" });
      }

      // Validate date formats
      const pickupTime = new Date(pickupDate as string).getTime();
      const returnTime = new Date(returnDate as string).getTime();

      if (isNaN(pickupTime) || isNaN(returnTime)) {
        return res.status(400).json({ message: "Invalid date format. Please use ISO 8601 format." });
      }

      if (pickupTime >= returnTime) {
        return res.status(400).json({ message: "Pickup date must be before return date" });
      }

      const drivers = await storage.getAvailableDrivers(
        req.tenantId!,
        pickupDate as string,
        returnDate as string
      );
      res.json(drivers);
    } catch (error) {
      console.error("Fetch available drivers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Booking Routes
  app.get("/api/bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      

      
      res.json(bookings);
    } catch (error) {
      console.error("Fetch bookings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Fix existing bookings - add createdBy field to bookings that don't have it
  app.post("/api/admin/fix-booking-audit", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const result = await storage.fixBookingAuditTrail();
      res.json({ message: `Fixed ${result} bookings` });
    } catch (error) {
      console.error("Fix booking audit trail error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/bookings/upcoming", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getUpcomingBookings(req.tenantId!);
      res.json(bookings);
    } catch (error) {
      console.error("Fetch upcoming bookings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookingId = `BK${Date.now()}`;
      
      // Map frontend field names to MongoDB schema
      const mappedData = {
        ...req.body,
        tenantId: req.tenantId,
        bookingId,
        // Map amount to totalAmount
        totalAmount: req.body.amount || req.body.totalAmount,
        // Ensure proper field names
        dropoffLocation: req.body.dropoffLocation || req.body.dropOffLocation,
        // Handle customer email - convert empty string to undefined
        customerEmail: req.body.customerEmail || undefined,
        // Handle driverId - convert empty string to undefined for MongoDB ObjectId
        driverId: req.body.driverId && req.body.driverId.trim() !== '' ? req.body.driverId : undefined,
        // Handle totalKilometers for per-km pricing
        totalKilometers: req.body.totalKilometers || undefined,
        // Default values for optional fields
        tollCharges: req.body.tollCharges || 0,
        parkingCharges: req.body.parkingCharges || 0,
        // Add audit logging for who created the booking
        createdBy: {
          userId: req.userId!,
          role: req.user?.role || 'client'
        }
      };
      
      const bookingData = mongoBookingSchema.parse(mappedData);
      const booking = await storage.createBooking(bookingData);
      
      // Send real-time notification for new booking
      const server = (global as any).notificationServer;
      if (server && server.broadcastNotification) {
        const notification = {
          type: 'booking_created',
          message: `New booking created: ${bookingId}`,
          data: {
            bookingId,
            customerName: booking.customerName,
            amount: booking.totalAmount,
            pickupDate: booking.pickupDate,
            bookingType: booking.bookingType
          },
          timestamp: new Date().toISOString()
        };
        server.broadcastNotification(req.tenantId!, notification);
      } else {
      }
      
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Booking validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      }
      console.error('Booking creation error:', error);
      console.error("Booking creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/bookings/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid booking ID format" });
      }

      const bookingData = mongoBookingSchema.partial().parse(req.body);
      const booking = await storage.updateBooking(id, bookingData);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Send real-time notification if booking was completed
      if (bookingData.status === 'completed') {
        const server = (global as any).notificationServer;
        if (server && server.broadcastNotification) {
          server.broadcastNotification(req.tenantId!, {
            type: 'booking_completed',
            message: `Booking completed: ${booking.bookingId}`,
            data: {
              bookingId: booking.bookingId,
              customerName: booking.customerName,
              amount: booking.totalAmount,
              returnDate: booking.returnDate,
              bookingType: booking.bookingType
            },
            timestamp: new Date().toISOString()
          });
        }
      }
      
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Booking update error:", error);
      console.error("Booking update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Cancel booking endpoint
  app.post("/api/bookings/:id/cancel", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { cancellationReason } = req.body;
      
      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }
      
      const booking = await storage.updateBooking(id, {
        status: 'cancelled',
        cancellationReason: cancellationReason.trim()
      });
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Send real-time notification for cancelled booking
      const server = (global as any).notificationServer;
      if (server && server.broadcastNotification) {
        server.broadcastNotification(req.tenantId!, {
          type: 'booking_cancelled',
          message: `Booking cancelled: ${booking.bookingId}`,
          data: {
            bookingId: booking.bookingId,
            customerName: booking.customerName,
            amount: booking.totalAmount,
            cancellationReason: booking.cancellationReason,
            bookingType: booking.bookingType
          },
          timestamp: new Date().toISOString()
        });
      }
      
      res.json(booking);
    } catch (error) {
      console.error('Cancel booking error:', error);
      console.error("Cancel booking failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/bookings/:id", authenticateUser, requireTenant, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteBooking(id);
      res.json({ message: "Booking deleted successfully" });
    } catch (error) {
      console.error("Booking deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Expense routes
  app.get("/api/expenses", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const expenses = await storage.getExpensesByTenant(req.tenantId!);
      res.json(expenses);
    } catch (error) {
      console.error('Get expenses error:', error);
      console.error("Fetch expenses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/expenses", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Basic validation
      const { vehicleId, category, amount, date, description, attachmentUrl } = req.body;
      
      if (!vehicleId || !category || !amount || !date) {
        return res.status(400).json({ message: "Vehicle, category, amount, and date are required" });
      }

      const expenseData = {
        tenantId: req.tenantId!,
        vehicleId,
        category,
        amount: parseFloat(amount),
        date: new Date(date),
        description: description || '',
        attachmentUrl: attachmentUrl || '',
        createdBy: {
          userId: req.userId!,
          role: req.user?.role || 'client'
        }
      };

      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      console.error('Create expense error:', error);
      console.error("Expense creation failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/expenses/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error('Get expense error:', error);
      console.error("Fetch expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/expenses/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.amount) {
        updateData.amount = parseFloat(updateData.amount);
      }
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }

      const expense = await storage.updateExpense(req.params.id, updateData);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error('Update expense error:', error);
      console.error("Expense update failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/expenses/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      await storage.deleteExpense(req.params.id);
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error('Delete expense error:', error);
      console.error("Expense deletion failed:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // DRIVER ATTENDANCE TRACKING ENDPOINTS
  // ============================================

  // Mark attendance (single/bulk)
  app.post("/api/driver-attendance/mark", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId, date, status, leaveType, notes, workHours } = req.body;

      if (!driverId || !date || !status) {
        return res.status(400).json({ message: "Missing required fields: driverId, date, status" });
      }

      // Parse date and normalize to start of day
      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      // Check if attendance already exists for this date
      const existingAttendance = await Attendance.findOne({
        tenantId: req.tenantId,
        driverId,
        date: {
          $gte: attendanceDate,
          $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      // Get driver salary info for salary cutoff calculation
      const driver = await Driver.findById(driverId);
      const salary = await DriverSalary.findOne({
        tenantId: req.tenantId,
        driverId,
        status: "pending"
      });

      let salaryCutoffAmount = 0;
      if (salary && status === "absent") {
        salaryCutoffAmount = salary.baseSalary / 30; // Assuming 30 working days per month
      }

      const attendanceData = {
        tenantId: req.tenantId,
        driverId,
        date: attendanceDate,
        status,
        leaveType: status === "LEAVE" ? leaveType : undefined,
        notes,
        workHours: workHours || 0,
        salaryCutoffAmount,
        autoMarked: false,
        markedBy: {
          userId: req.user?.userId || "system",
          userName: req.user?.userId || "system",
          role: req.user?.role || "manager"
        },
        updatedAt: new Date()
      };

      let attendance;
      if (existingAttendance) {
        // Update existing attendance
        attendance = await Attendance.findByIdAndUpdate(existingAttendance._id, attendanceData, { new: true });
      } else {
        // Create new attendance
        attendance = await Attendance.create(attendanceData);
      }

      res.json({ message: "Attendance marked successfully", attendance });
    } catch (error) {
      console.error("Mark attendance error:", error);
      console.error("Mark attendance error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get monthly summary
  app.get("/api/driver-attendance/summary/:driverId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.params;
      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;

      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);

      const attendances = await Attendance.find({
        tenantId: req.tenantId,
        driverId,
        date: { $gte: startDate, $lte: endDate }
      });

      const summary = {
        presentDays: attendances.filter((a: any) => a.status === "present" || a.status === "BOOKING_SERVE" || a.status === "IDLE_AVAILABLE").length,
        absentDays: attendances.filter((a: any) => a.status === "absent" || a.status === "ABSENT").length,
        leaveDays: attendances.filter((a: any) => a.status === "LEAVE").length,
        totalWorkingDays: attendances.length,
        attendancePercentage: attendances.length > 0
          ? ((attendances.filter((a: any) => a.status === "present" || a.status === "BOOKING_SERVE" || a.status === "IDLE_AVAILABLE").length / attendances.length) * 100).toFixed(2)
          : 0,
        totalSalaryDeduction: attendances
          .filter((a: any) => a.status === "absent" || a.status === "ABSENT")
          .reduce((sum: number, a: any) => sum + (a.salaryCutoffAmount || 0), 0),
        month: Number(month),
        year: Number(year)
      };

      res.json(summary);
    } catch (error) {
      console.error("Get attendance summary error:", error);
      console.error("Fetch attendance summary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get calendar view
  app.get("/api/driver-attendance/calendar/:driverId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.params;
      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;

      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);

      const attendances = await Attendance.find({
        tenantId: req.tenantId,
        driverId,
        date: { $gte: startDate, $lte: endDate }
      });

      const calendarData = attendances.map((a: any) => ({
        date: a.date,
        status: a.status,
        workHours: a.workHours,
        notes: a.notes,
        leaveType: a.leaveType
      }));

      res.json({ calendar: calendarData, month: Number(month), year: Number(year) });
    } catch (error) {
      console.error("Get calendar view error:", error);
      console.error("Fetch calendar view error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Edit past attendance
  app.put("/api/driver-attendance/edit/:attendanceId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { attendanceId } = req.params;
      const { status, leaveType, notes, workHours } = req.body;

      const attendance = await Attendance.findById(attendanceId);
      if (!attendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      // Verify tenant ownership
      if (attendance.tenantId.toString() !== req.tenantId?.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get driver salary info for salary cutoff calculation
      const salary = await DriverSalary.findOne({
        tenantId: req.tenantId,
        driverId: attendance.driverId,
        status: "pending"
      });

      let salaryCutoffAmount = 0;
      if (salary && status === "absent") {
        salaryCutoffAmount = salary.baseSalary / 30;
      }

      const updateData = {
        status,
        leaveType: status === "LEAVE" ? leaveType : undefined,
        notes,
        workHours,
        salaryCutoffAmount,
        updatedAt: new Date()
      };

      const updatedAttendance = await Attendance.findByIdAndUpdate(attendanceId, updateData, { new: true });
      res.json({ message: "Attendance updated successfully", attendance: updatedAttendance });
    } catch (error) {
      console.error("Edit attendance error:", error);
      console.error("Edit attendance error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get attendance statistics
  app.get("/api/driver-attendance/stats/:driverId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.params;

      // Get all attendances for the driver
      const allAttendances = await Attendance.find({
        tenantId: req.tenantId,
        driverId
      });

      // Calculate last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const recentAttendances = allAttendances.filter((a: any) => a.date >= ninetyDaysAgo);

      const presentDays = recentAttendances.filter((a: any) =>
        a.status === "present" || a.status === "BOOKING_SERVE" || a.status === "IDLE_AVAILABLE"
      ).length;

      const absentDays = recentAttendances.filter((a: any) =>
        a.status === "absent" || a.status === "ABSENT"
      ).length;

      const attendancePercentage = recentAttendances.length > 0
        ? ((presentDays / recentAttendances.length) * 100).toFixed(2)
        : 0;

      const salaryDeductions = recentAttendances
        .filter((a: any) => a.status === "absent" || a.status === "ABSENT")
        .reduce((sum: number, a: any) => sum + (a.salaryCutoffAmount || 0), 0);

      const stats = {
        attendancePercentage: Number(attendancePercentage),
        presentDays,
        absentDays,
        lowAttendanceFlag: Number(attendancePercentage) < 80,
        totalSalaryDeductions: salaryDeductions,
        last90Days: {
          total: recentAttendances.length,
          present: presentDays,
          absent: absentDays
        }
      };

      res.json(stats);
    } catch (error) {
      console.error("Get attendance stats error:", error);
      console.error("Fetch attendance stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== LEAVE MANAGEMENT ROUTES ====================

  // 1. Request leave
  app.post("/api/driver-leaves/request", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId, leaveType, startDate, endDate, reason, notes } = req.body;
      const tenantId = req.user?.tenantId?.toString();

      if (!tenantId || !driverId || !leaveType || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const leave = await LeaveManagementService.requestLeave(tenantId, driverId, {
        leaveType,
        startDate,
        endDate,
        reason,
        notes,
      });

      res.json({ message: "Leave request submitted successfully", leave });
    } catch (error: any) {
      console.error("Request leave error:", error);
      res.status(500).json({ message: error.message || "Failed to request leave" });
    }
  });

  // 2. Get leave balance
  app.get("/api/driver-leaves/balance/:driverId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.params;
      const tenantId = req.user?.tenantId?.toString();

      if (!tenantId || !driverId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const balance = await LeaveManagementService.getLeaveBalance(tenantId, driverId);
      res.json({ balance });
    } catch (error: any) {
      console.error("Get leave balance error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch leave balance" });
    }
  });

  // 3. Approve leave
  app.put("/api/driver-leaves/:leaveId/approve", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { leaveId } = req.params;
      const tenantId = req.user?.tenantId?.toString();

      if (!tenantId || !leaveId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Only managers/admins can approve
      if (req.user?.role !== "manager" && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Only managers can approve leave" });
      }

      const approver = {
        userId: req.user?.userId || "unknown",
        userName: req.user?.businessDetails?.ownerName || req.user?.userId || "unknown",
      };

      const leave = await LeaveManagementService.approveLeave(tenantId, leaveId, approver);

      // Create attendance records for the leave period
      await LeaveManagementService.createLeaveAttendance(
        tenantId,
        leave.driverId.toString(),
        leave
      );

      res.json({ message: "Leave approved successfully", leave });
    } catch (error: any) {
      console.error("Approve leave error:", error);
      res.status(500).json({ message: error.message || "Failed to approve leave" });
    }
  });

  // 4. Reject leave
  app.put("/api/driver-leaves/:leaveId/reject", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { leaveId } = req.params;
      const { rejectionReason } = req.body;
      const tenantId = req.user?.tenantId?.toString();

      if (!tenantId || !leaveId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Only managers/admins can reject
      if (req.user?.role !== "manager" && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Only managers can reject leave" });
      }

      const approver = {
        userId: req.user?.userId || "unknown",
        userName: req.user?.businessDetails?.ownerName || req.user?.userId || "unknown",
      };

      const leave = await LeaveManagementService.rejectLeave(
        tenantId,
        leaveId,
        rejectionReason || "No reason provided",
        approver
      );

      res.json({ message: "Leave rejected successfully", leave });
    } catch (error: any) {
      console.error("Reject leave error:", error);
      res.status(500).json({ message: error.message || "Failed to reject leave" });
    }
  });

  // 5. Get leave history
  app.get("/api/driver-leaves/history/:driverId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const tenantId = req.user?.tenantId?.toString();

      if (!tenantId || !driverId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const { leaves, total } = await LeaveManagementService.getLeaveHistory(
        tenantId,
        driverId,
        Number(limit),
        Number(offset)
      );

      res.json({ leaves, total, limit: Number(limit), offset: Number(offset) });
    } catch (error: any) {
      console.error("Get leave history error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch leave history" });
    }
  });

  // Get leave statistics (dashboard)
  app.get("/api/driver-leaves/stats", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user?.tenantId?.toString();

      if (!tenantId) {
        return res.status(400).json({ message: "Missing tenant information" });
      }

      const stats = await LeaveManagementService.getLeaveStatistics(tenantId);
      res.json(stats);
    } catch (error: any) {
      console.error("Get leave statistics error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch leave statistics" });
    }
  });

  // Test endpoint to manually trigger background job
  app.post("/api/test-background-job", async (req, res) => {
    try {
      const completedCount = await storage.markExpiredBookingsAsCompleted();
      res.json({ message: `Marked ${completedCount} expired booking(s) as completed` });
    } catch (error) {
      res.status(500).json({ message: "Failed to run background job", error: (error as Error).message });
    }
  });

  // Register Driver Onboarding Routes
  app.use("/api/driver-onboarding", driverOnboardingRoutes);

  // Register User Onboarding Routes
  app.use("/api/onboarding", userOnboardingRoutes);

  // ===== PHASE 3: SAAS BILLING ROUTES =====
  // Register Plans Routes
  app.use("/api", plansRoutes);

  // Register Subscriptions Routes
  app.use("/api", subscriptionsRoutes);

  // Register Invoicing Routes
  app.use("/api", invoicingRoutes);

  // Register Payments Routes
  app.use("/api", paymentsRoutes);

  // ===== PHASE 4: ADVANCED AUTH & SECURITY =====
  // Register Advanced Auth Routes
  app.use("/api", authAdvancedRoutes);

  // ===== ADVANCED ADMIN DASHBOARD =====
  const adminAdvancedRoutes = await import('./routes/admin-advanced');
  app.use("/api/admin", adminAdvancedRoutes.default);

  // Record metrics every 30 seconds
  setInterval(async () => {
    const { AnalyticsService } = await import('./services/analytics-service');
    AnalyticsService.recordMetrics();
  }, 30000);

  // Register Signup Routes (Public)
  app.use("/api/signup", signupRoutes);

  // Initialize Renewal Scheduler
  try {
    const renewalScheduler = new RenewalScheduler();
    renewalScheduler.initialize();
  } catch (error) {
    console.error('Error initializing renewal scheduler:', error);
  }

  // ===== WAVE 9: SERVICE OPERATIONS ROUTES =====
  const { ServiceTicketService } = await import('./services/ServiceTicketService');
  const { EngineerAssignmentService } = await import('./services/EngineerAssignmentService');
  const { FieldVisitService } = await import('./services/FieldVisitService');
  const { SLAService } = await import('./services/SLAService');

  const ticketService = new ServiceTicketService();
  const assignmentService = new EngineerAssignmentService();
  const fieldVisitService = new FieldVisitService();
  const slaService = new SLAService();

  // POST /api/service-tickets - Create a service ticket
  app.post("/api/service-tickets", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { assetId, assetType, clientId, clientName, clientPhone, type, priority, description } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      if (!assetId || !assetType || !clientId || !clientName || !clientPhone || !type || !priority || !description) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const ticket = await ticketService.createTicket({
        tenantId,
        assetId: new mongoose.Types.ObjectId(assetId),
        assetType,
        clientId: new mongoose.Types.ObjectId(clientId),
        clientName,
        clientPhone,
        type,
        priority,
        description,
        createdBy: {
          userId: req.user?.userId || "",
          role: req.user?.role || ""
        }
      });

      res.status(201).json({ message: "Service ticket created", ticket });
    } catch (error: any) {
      console.error("Create ticket error:", error);
      res.status(500).json({ message: error.message || "Failed to create ticket" });
    }
  });

  // GET /api/service-tickets - List tickets
  app.get("/api/service-tickets", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { status, priority, clientId, assetId, limit = 20, offset = 0 } = req.query;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const { tickets, total } = await ticketService.listTickets(tenantId, {
        status: status as string,
        priority: priority as string,
        clientId: clientId as string,
        assetId: assetId as string,
        limit: Number(limit),
        offset: Number(offset)
      });

      res.json({ tickets, total, limit: Number(limit), offset: Number(offset) });
    } catch (error: any) {
      console.error("List tickets error:", error);
      res.status(500).json({ message: error.message || "Failed to list tickets" });
    }
  });

  // GET /api/service-tickets/:id - Get ticket details
  app.get("/api/service-tickets/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const ticket = await ticketService.getTicket(tenantId, id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error: any) {
      console.error("Get ticket error:", error);
      res.status(500).json({ message: error.message || "Failed to get ticket" });
    }
  });

  // PUT /api/service-tickets/:id - Update ticket status
  app.put("/api/service-tickets/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, diagnosis, resolution } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const ticket = await ticketService.updateTicketStatus(tenantId, id, {
        status,
        diagnosis,
        resolution
      });

      res.json({ message: "Ticket updated", ticket });
    } catch (error: any) {
      console.error("Update ticket error:", error);
      res.status(500).json({ message: error.message || "Failed to update ticket" });
    }
  });

  // POST /api/service-tickets/:id/assign - Assign engineer
  app.post("/api/service-tickets/:id/assign", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { engineerId } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const engineerObjectId = engineerId ? new mongoose.Types.ObjectId(engineerId) : undefined;
      const { ticket } = await assignmentService.assignTicketToEngineer(tenantId, id, engineerObjectId);

      res.json({ message: "Engineer assigned", ticket });
    } catch (error: any) {
      console.error("Assign engineer error:", error);
      res.status(500).json({ message: error.message || "Failed to assign engineer" });
    }
  });

  // POST /api/service-tickets/:id/resolve - Mark as resolved
  app.post("/api/service-tickets/:id/resolve", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { diagnosis, resolution } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const ticket = await ticketService.updateTicketStatus(tenantId, id, {
        status: "RESOLVED",
        diagnosis,
        resolution
      });

      res.json({ message: "Ticket resolved", ticket });
    } catch (error: any) {
      console.error("Resolve ticket error:", error);
      res.status(500).json({ message: error.message || "Failed to resolve ticket" });
    }
  });

  // POST /api/service-tickets/:id/close - Close ticket
  app.post("/api/service-tickets/:id/close", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const ticket = await ticketService.updateTicketStatus(tenantId, id, {
        status: "CLOSED"
      });

      res.json({ message: "Ticket closed", ticket });
    } catch (error: any) {
      console.error("Close ticket error:", error);
      res.status(500).json({ message: error.message || "Failed to close ticket" });
    }
  });

  // POST /api/fieldvisits - Create field visit
  app.post("/api/fieldvisits", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { ticketId, assetId, visitDate, diagnosis, actionTaken, assetConditionBefore, assetConditionAfter, partsUsed, laborCost } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");
      const engineerId = new mongoose.Types.ObjectId(req.user?._id?.toString() || "");

      if (!ticketId || !assetId || !visitDate || !diagnosis || !actionTaken || !assetConditionBefore) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const fieldVisit = await fieldVisitService.createFieldVisit({
        tenantId,
        ticketId: new mongoose.Types.ObjectId(ticketId),
        engineerId,
        engineerName: req.user?.userId || "",
        assetId: new mongoose.Types.ObjectId(assetId),
        visitDate: new Date(visitDate),
        diagnosis,
        actionTaken,
        assetConditionBefore,
        assetConditionAfter,
        partsUsed,
        laborCost
      });

      res.status(201).json({ message: "Field visit created", fieldVisit });
    } catch (error: any) {
      console.error("Create field visit error:", error);
      res.status(500).json({ message: error.message || "Failed to create field visit" });
    }
  });

  // GET /api/fieldvisits/:id - Get field visit
  app.get("/api/fieldvisits/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const fieldVisit = await fieldVisitService.getFieldVisit(tenantId, id);
      if (!fieldVisit) {
        return res.status(404).json({ message: "Field visit not found" });
      }

      res.json(fieldVisit);
    } catch (error: any) {
      console.error("Get field visit error:", error);
      res.status(500).json({ message: error.message || "Failed to get field visit" });
    }
  });

  // POST /api/fieldvisits/:id/photos - Upload photos
  app.post("/api/fieldvisits/:id/photos", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { url, description } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      if (!url || !description) {
        return res.status(400).json({ message: "URL and description required" });
      }

      const fieldVisit = await fieldVisitService.uploadPhoto(tenantId, id, { url, description });

      res.json({ message: "Photo uploaded", fieldVisit });
    } catch (error: any) {
      console.error("Upload photo error:", error);
      res.status(500).json({ message: error.message || "Failed to upload photo" });
    }
  });

  // GET /api/fieldvisits/by-ticket/:ticketId - Get visits for ticket
  app.get("/api/fieldvisits/by-ticket/:ticketId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { ticketId } = req.params;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const fieldVisits = await fieldVisitService.getFieldVisitsByTicket(
        tenantId,
        new mongoose.Types.ObjectId(ticketId)
      );

      res.json({ fieldVisits, total: fieldVisits.length });
    } catch (error: any) {
      console.error("Get field visits error:", error);
      res.status(500).json({ message: error.message || "Failed to get field visits" });
    }
  });

  // GET /api/engineers/:id/schedule - Engineer schedule
  app.get("/api/engineers/:id/schedule", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");
      const engineerId = new mongoose.Types.ObjectId(id);

      const tickets = await assignmentService.getEngineerSchedule(tenantId, engineerId);

      res.json({ tickets, total: tickets.length });
    } catch (error: any) {
      console.error("Get engineer schedule error:", error);
      res.status(500).json({ message: error.message || "Failed to get engineer schedule" });
    }
  });

  // GET /api/engineers/:id/tickets - Assigned tickets
  app.get("/api/engineers/:id/tickets", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { includeResolved = false } = req.query;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");
      const engineerId = new mongoose.Types.ObjectId(id);

      const tickets = await assignmentService.getAssignedTickets(
        tenantId,
        engineerId,
        includeResolved === "true"
      );

      res.json({ tickets, total: tickets.length });
    } catch (error: any) {
      console.error("Get assigned tickets error:", error);
      res.status(500).json({ message: error.message || "Failed to get assigned tickets" });
    }
  });

  // PUT /api/engineers/:id/availability - Update availability
  app.put("/api/engineers/:id/availability", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { available } = req.body;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");
      const engineerId = new mongoose.Types.ObjectId(id);

      const workload = await assignmentService.updateEngineerAvailability(tenantId, engineerId, available);

      res.json({ message: "Availability updated", workload });
    } catch (error: any) {
      console.error("Update availability error:", error);
      res.status(500).json({ message: error.message || "Failed to update availability" });
    }
  });

  // GET /api/sla/metrics - SLA dashboard
  app.get("/api/sla/metrics", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { days = 7 } = req.query;
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const dashboard = await slaService.getSLADashboard(tenantId, Number(days));

      res.json(dashboard);
    } catch (error: any) {
      console.error("Get SLA metrics error:", error);
      res.status(500).json({ message: error.message || "Failed to get SLA metrics" });
    }
  });

  // GET /api/sla/breaches - Breached SLAs
  app.get("/api/sla/breaches", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const tenantId = new mongoose.Types.ObjectId(req.user?.tenantId?.toString() || "");

      const breaches = await slaService.getBreachedSLAs(tenantId);

      res.json(breaches);
    } catch (error: any) {
      console.error("Get breached SLAs error:", error);
      res.status(500).json({ message: error.message || "Failed to get breached SLAs" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
