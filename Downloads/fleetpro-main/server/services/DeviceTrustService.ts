import crypto from 'crypto';
import mongoose from 'mongoose';
import { TrustedDevice } from '../models/index';

export interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
  acceptLanguage?: string;
  timezone?: string;
  screenResolution?: string;
}

class DeviceTrustService {
  /**
   * Generate device fingerprint from request context
   */
  generateFingerprint(deviceFingerprint: DeviceFingerprint): string {
    const fingerprintData = [
      deviceFingerprint.userAgent,
      deviceFingerprint.ipAddress,
      deviceFingerprint.acceptLanguage || '',
      deviceFingerprint.timezone || '',
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Register/trust a device
   */
  async trustDevice(
    userId: string,
    tenantId: string,
    deviceName: string,
    fingerprint: string,
    ipAddress: string,
    userAgent: string,
    rememberDays: number = 30
  ): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rememberDays);

      const trustedDevice = new TrustedDevice({
        userId: userObjectId,
        tenantId: tenantObjectId,
        deviceName,
        fingerprint,
        ipAddress,
        userAgent,
        lastUsedAt: new Date(),
        expiresAt,
        isActive: true,
      });

      await trustedDevice.save();

      return {
        deviceId: trustedDevice._id,
        deviceName,
        expiresAt,
      };
    } catch (error) {
      console.error('Failed to trust device:', error);
      throw error;
    }
  }

  /**
   * Check if device is trusted
   */
  async isTrusted(userId: string, tenantId: string, fingerprint: string): Promise<boolean> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const device = await TrustedDevice.findOne({
        userId: userObjectId,
        tenantId: tenantObjectId,
        fingerprint,
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      if (device) {
        // Update last used timestamp
        await TrustedDevice.updateOne({ _id: device._id }, { lastUsedAt: new Date() });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check device trust:', error);
      return false;
    }
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId: string, tenantId: string): Promise<any[]> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const devices = await TrustedDevice.find({
        userId: userObjectId,
        tenantId: tenantObjectId,
        isActive: true,
      })
        .sort({ lastUsedAt: -1 })
        .lean();

      return devices.map((device: any) => ({
        deviceId: device._id,
        deviceName: device.deviceName,
        ipAddress: this.maskIPAddress(device.ipAddress),
        lastUsedAt: device.lastUsedAt,
        expiresAt: device.expiresAt,
        isExpired: new Date() > device.expiresAt,
      }));
    } catch (error) {
      console.error('Failed to get trusted devices:', error);
      throw error;
    }
  }

  /**
   * Revoke device trust
   */
  async revokeDevice(userId: string, tenantId: string, deviceId: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const deviceObjectId = new mongoose.Types.ObjectId(deviceId);

      await TrustedDevice.updateOne(
        {
          _id: deviceObjectId,
          userId: userObjectId,
          tenantId: tenantObjectId,
        },
        { isActive: false, revokedAt: new Date() }
      );


      return {
        message: 'Device has been revoked',
      };
    } catch (error) {
      console.error('Failed to revoke device:', error);
      throw error;
    }
  }

  /**
   * Revoke all devices except current
   */
  async revokeAllExcept(userId: string, tenantId: string, fingerprint: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      await TrustedDevice.updateMany(
        {
          userId: userObjectId,
          tenantId: tenantObjectId,
          fingerprint: { $ne: fingerprint },
          isActive: true,
        },
        { isActive: false, revokedAt: new Date() }
      );


      return {
        message: 'All other devices have been revoked',
      };
    } catch (error) {
      console.error('Failed to revoke all devices:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired devices
   */
  async cleanupExpiredDevices(tenantId: string): Promise<number> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const result = await TrustedDevice.deleteMany({
        tenantId: tenantObjectId,
        expiresAt: { $lt: new Date() },
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error('Failed to cleanup expired devices:', error);
      throw error;
    }
  }

  /**
   * Mask IP address for display
   */
  private maskIPAddress(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.*`;
    }
    return ipAddress;
  }
}

export const deviceTrustService = new DeviceTrustService();
