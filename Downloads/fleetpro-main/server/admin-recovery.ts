
import { storage } from "./storage-mongodb";
import bcrypt from "bcrypt";

/**
 * Emergency Admin Password Recovery
 * This should only be run manually on the server when admin access is lost
 */
export async function emergencyAdminPasswordReset(newPassword: string) {
  try {
    
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long");
    }
    
    // Find admin user
    const adminUsers = await storage.getUsers();
    const adminUser = adminUsers.find(user => user.role === 'admin');
    
    if (!adminUser) {
      throw new Error("No admin user found in the system");
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update admin password directly in database and clear session
    await storage.updateUser(adminUser.id, { 
      password: hashedPassword,
      mustResetPassword: false
    });
    
    // Clear admin session to force logout
    await storage.updateUserSession(adminUser.id, null);
    
    
    return {
      success: true,
      adminUserId: adminUser.userId,
      message: "Admin password reset successfully"
    };
    
  } catch (error) {
    console.error("❌ Admin password reset failed:", error);
    throw error;
  }
}

/**
 * Create a backup admin user (only if no admin exists)
 */
export async function createBackupAdmin(userId: string, password: string) {
  try {
    const users = await storage.getUsers();
    const existingAdmin = users.find(user => user.role === 'admin');
    
    if (existingAdmin) {
      return false;
    }
    
    const adminData = {
      userId,
      password,
      role: 'admin' as const,
      isActive: true,
      mustResetPassword: false
    };
    
    await storage.createUser(adminData);
    return true;
    
  } catch (error) {
    console.error("❌ Failed to create backup admin:", error);
    throw error;
  }
}

/**
 * Emergency admin creation using environment variables
 * This allows creating a temporary admin when locked out
 */
export async function createEmergencyAdmin() {
  try {
    const emergencyId = process.env.EMERGENCY_ADMIN_ID;
    const emergencyPassword = process.env.EMERGENCY_ADMIN_PASSWORD;
    
    if (!emergencyId || !emergencyPassword) {
      return false;
    }
    
    
    // Check if emergency admin already exists
    const users = await storage.getUsers();
    const existingEmergencyAdmin = users.find(user => user.userId === emergencyId);
    
    if (existingEmergencyAdmin) {
      return true;
    }
    
    const adminData = {
      userId: emergencyId,
      password: emergencyPassword,
      role: 'admin' as const,
      isActive: true,
      mustResetPassword: true // Force password change on first login
    };
    
    await storage.createUser(adminData);
    
    return true;
    
  } catch (error) {
    console.error("❌ Failed to create emergency admin:", error);
    return false;
  }
}

/**
 * Security audit log for admin recovery actions
 */
export async function logAdminRecoveryAction(action: string, details: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    details,
    severity: 'HIGH',
    type: 'ADMIN_RECOVERY'
  };
  
  
  // In a production environment, you might want to:
  // - Save to a separate security log file
  // - Send alerts to security team
  // - Log to external security monitoring system
}
