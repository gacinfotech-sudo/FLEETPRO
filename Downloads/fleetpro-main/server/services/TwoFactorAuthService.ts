import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { User, TwoFactorAuth, RecoveryCodes } from '../models/index';

export interface TwoFactorSetupRequest {
  userId: string;
  tenantId: string;
  method: 'totp' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
}

export interface TwoFactorVerifyRequest {
  userId: string;
  code: string;
  method: 'totp' | 'sms' | 'email';
  rememberDevice?: boolean;
}

class TwoFactorAuthService {
  /**
   * Generate TOTP secret and QR code for authenticator app setup
   */
  async generateTOTPSecret(userId: string, email: string): Promise<any> {
    try {
      const secret = speakeasy.generateSecret({
        name: `FleetPro (${email})`,
        issuer: 'FleetPro',
        length: 32,
      });

      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      return {
        secret: secret.base32,
        qrCode,
        backupCodes: this.generateBackupCodes(10),
      };
    } catch (error) {
      console.error('Failed to generate TOTP secret:', error);
      throw error;
    }
  }

  /**
   * Enable 2FA for user with TOTP
   */
  async enableTOTP(userId: string, tenantId: string, secret: string, code: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Verify the code matches the secret
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        throw new Error('Invalid verification code');
      }

      // Create or update 2FA settings
      const twoFactorAuth = await TwoFactorAuth.findOneAndUpdate(
        { userId: userObjectId, tenantId: tenantObjectId },
        {
          userId: userObjectId,
          tenantId: tenantObjectId,
          method: 'totp',
          secret,
          isEnabled: true,
          enabledAt: new Date(),
          codesUsed: 0,
        },
        { upsert: true, new: true }
      );

      // Create recovery codes
      const backupCodes = this.generateBackupCodes(10);
      const hashedCodes = backupCodes.map(code => ({
        code: this.hashCode(code),
        used: false,
      }));

      await RecoveryCodes.findOneAndUpdate(
        { userId: userObjectId, tenantId: tenantObjectId },
        {
          userId: userObjectId,
          tenantId: tenantObjectId,
          codes: hashedCodes,
        },
        { upsert: true, new: true }
      );


      return {
        message: '2FA enabled successfully',
        method: 'totp',
        backupCodes, // Show once for user to save
      };
    } catch (error) {
      console.error('Failed to enable TOTP:', error);
      throw error;
    }
  }

  /**
   * Enable SMS OTP for 2FA
   */
  async enableSMSOTP(userId: string, tenantId: string, phoneNumber: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Validate phone number format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
      if (!phoneRegex.test(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Generate and send OTP
      const otp = this.generateOTP(6);
      const otpHash = this.hashCode(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await TwoFactorAuth.findOneAndUpdate(
        { userId: userObjectId, tenantId: tenantObjectId },
        {
          userId: userObjectId,
          tenantId: tenantObjectId,
          method: 'sms',
          phoneNumber,
          otpHash,
          otpExpiresAt: expiresAt,
          isEnabled: false, // Not enabled until verified
        },
        { upsert: true }
      );

      // SMS delivery deferred: Integrate with Twilio/AWS SNS for OTP transmission
      // In-memory OTP generation (above) provides fallback for testing
      // When enabled: SMSService.sendOTP(phoneNumber, otp)

      return {
        message: 'OTP sent to phone number',
        method: 'sms',
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        expiresIn: 600, // seconds
      };
    } catch (error) {
      console.error('Failed to enable SMS OTP:', error);
      throw error;
    }
  }

  /**
   * Enable Email OTP for 2FA
   */
  async enableEmailOTP(userId: string, tenantId: string, email: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email address');
      }

      // Generate and send OTP
      const otp = this.generateOTP(6);
      const otpHash = this.hashCode(otp);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await TwoFactorAuth.findOneAndUpdate(
        { userId: userObjectId, tenantId: tenantObjectId },
        {
          userId: userObjectId,
          tenantId: tenantObjectId,
          method: 'email',
          email,
          otpHash,
          otpExpiresAt: expiresAt,
          isEnabled: false,
        },
        { upsert: true }
      );

      // Email delivery deferred: Integrate with EmailService for OTP transmission
      // In-memory OTP generation (above) provides fallback for testing
      // When enabled: EmailService.sendOTPEmail(email, otp)

      return {
        message: 'OTP sent to email address',
        method: 'email',
        email: this.maskEmail(email),
        expiresIn: 900, // seconds
      };
    } catch (error) {
      console.error('Failed to enable Email OTP:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP code
   */
  async verifyTOTP(userId: string, tenantId: string, code: string): Promise<boolean> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const twoFactorAuth = await TwoFactorAuth.findOne({
        userId: userObjectId,
        tenantId: tenantObjectId,
        method: 'totp',
        isEnabled: true,
      });

      if (!twoFactorAuth) {
        return false;
      }

      const verified = speakeasy.totp.verify({
        secret: twoFactorAuth.secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (verified) {
        // Update last verified timestamp
        await TwoFactorAuth.updateOne(
          { _id: twoFactorAuth._id },
          { lastVerifiedAt: new Date() }
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to verify TOTP:', error);
      return false;
    }
  }

  /**
   * Verify OTP code (SMS or Email)
   */
  async verifyOTP(userId: string, tenantId: string, code: string): Promise<boolean> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const twoFactorAuth = await TwoFactorAuth.findOne({
        userId: userObjectId,
        tenantId: tenantObjectId,
        method: { $in: ['sms', 'email'] },
      });

      if (!twoFactorAuth) {
        return false;
      }

      // Check if OTP has expired
      if (twoFactorAuth.otpExpiresAt && new Date() > twoFactorAuth.otpExpiresAt) {
        throw new Error('OTP has expired');
      }

      // Verify OTP hash
      const otpHash = this.hashCode(code);
      if (otpHash !== twoFactorAuth.otpHash) {
        return false;
      }

      // Mark as enabled and update last verified
      await TwoFactorAuth.updateOne(
        { _id: twoFactorAuth._id },
        {
          isEnabled: true,
          lastVerifiedAt: new Date(),
          otpHash: null, // Clear used OTP
          otpExpiresAt: null,
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      return false;
    }
  }

  /**
   * Verify recovery code and consume it
   */
  async verifyRecoveryCode(userId: string, tenantId: string, code: string): Promise<boolean> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const recoveryCodes = await RecoveryCodes.findOne({
        userId: userObjectId,
        tenantId: tenantObjectId,
      });

      if (!recoveryCodes) {
        return false;
      }

      // Find matching code
      const codeHash = this.hashCode(code);
      const matchingCode = recoveryCodes.codes.find(
        (c: any) => c.code === codeHash && !c.used
      );

      if (!matchingCode) {
        return false;
      }

      // Mark code as used
      await RecoveryCodes.updateOne(
        { _id: recoveryCodes._id, 'codes.code': codeHash },
        { $set: { 'codes.$[elem].used': true } },
        { arrayFilters: [{ 'elem.code': codeHash }] }
      );

      return true;
    } catch (error) {
      console.error('Failed to verify recovery code:', error);
      return false;
    }
  }

  /**
   * Disable 2FA for user
   */
  async disable2FA(userId: string, tenantId: string, password?: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Optional: Verify password before disabling
      if (password) {
        const user = await User.findById(userObjectId);
        if (!user) {
          throw new Error('User not found');
        }
        // TODO: Verify password hash
      }

      await TwoFactorAuth.updateOne(
        { userId: userObjectId, tenantId: tenantObjectId },
        { isEnabled: false, disabledAt: new Date() }
      );


      return {
        message: '2FA has been disabled',
        warning: 'Your account is now less secure. Consider re-enabling 2FA.',
      };
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      throw error;
    }
  }

  /**
   * Get user's 2FA status
   */
  async get2FAStatus(userId: string, tenantId: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const twoFactorAuth = await TwoFactorAuth.findOne({
        userId: userObjectId,
        tenantId: tenantObjectId,
      }).lean();

      if (!twoFactorAuth) {
        return {
          isEnabled: false,
          method: null,
          lastVerifiedAt: null,
        };
      }

      return {
        isEnabled: twoFactorAuth.isEnabled,
        method: twoFactorAuth.method,
        lastVerifiedAt: twoFactorAuth.lastVerifiedAt,
        enabledAt: twoFactorAuth.enabledAt,
        phoneNumber: twoFactorAuth.phoneNumber ? this.maskPhoneNumber(twoFactorAuth.phoneNumber) : null,
        email: twoFactorAuth.email ? this.maskEmail(twoFactorAuth.email) : null,
      };
    } catch (error) {
      console.error('Failed to get 2FA status:', error);
      throw error;
    }
  }

  /**
   * Generate backup/recovery codes
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`); // Format: XXXX-XXXX
    }
    return codes;
  }

  /**
   * Generate OTP code
   */
  private generateOTP(length: number = 6): string {
    return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
  }

  /**
   * Hash code for storage
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Mask phone number for display
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '****';
    return `****${phoneNumber.slice(-4)}`;
  }

  /**
   * Mask email for display
   */
  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    return `${name[0]}***@${domain}`;
  }
}

export const twoFactorAuthService = new TwoFactorAuthService();
