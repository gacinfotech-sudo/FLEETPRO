# Two-Factor Authentication (2FA) & Advanced Security - Complete Guide

## Overview

The Two-Factor Authentication & Advanced Security System provides enterprise-grade account protection for FleetPro. Supports TOTP (authenticator apps), SMS OTP, Email OTP, backup recovery codes, device trust, and suspicious login detection.

## Features

### Core 2FA Capabilities

- **TOTP (Time-based One-Time Password)**: Google Authenticator, Microsoft Authenticator, Authy
- **SMS OTP**: One-time passwords via SMS text message
- **Email OTP**: One-time passwords via email
- **Backup Recovery Codes**: 10 recovery codes for account recovery
- **Device Trust**: Remember this device for 30 days
- **Suspicious Login Detection**: Automatic detection of unusual activity
- **Account Lockout**: Automatic lockout after 5 failed attempts
- **Login History**: Complete audit trail of login attempts
- **Security Alerts**: Notifications for suspicious activity
- **Multi-factor Enforcement**: Optional tenant-wide 2FA enforcement

### Authentication Methods

| Method | Delivery | Recovery | Best For |
|--------|----------|----------|----------|
| **TOTP** | Authenticator App | Recovery Codes | High Security |
| **SMS OTP** | Text Message | Recovery Codes | Mobile Users |
| **Email OTP** | Email | Recovery Codes | Web Users |
| **Recovery Code** | One-time backup code | Account Recovery | Emergency Access |

## API Endpoints

### 2FA Setup & Configuration

#### Generate TOTP Secret

**POST** `/api/2fa/setup/totp`

Initialize TOTP 2FA with QR code and backup codes.

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/setup/totp \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "method": "totp",
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": [
    "A1B2-3C4D",
    "E5F6-7G8H",
    "I9J0-1K2L",
    ...
  ],
  "message": "Scan QR code with authenticator app and verify code to enable 2FA"
}
```

**Steps:**
1. User scans QR code with Google Authenticator/Authy
2. App generates 6-digit code
3. User submits code to verify endpoint
4. User saves backup codes in secure location

#### Verify & Enable TOTP

**POST** `/api/2fa/verify/totp`

Verify TOTP code and enable 2FA.

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/verify/totp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "code": "123456"
  }'
```

**Response:**
```json
{
  "message": "2FA enabled successfully",
  "method": "totp",
  "backupCodes": [
    "A1B2-3C4D",
    "E5F6-7G8H",
    ...
  ]
}
```

#### Setup SMS OTP

**POST** `/api/2fa/setup/sms`

Setup SMS-based 2FA.

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/setup/sms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+91-9876543210"
  }'
```

**Response:**
```json
{
  "message": "OTP sent to phone number",
  "method": "sms",
  "phoneNumber": "****3210",
  "expiresIn": 600
}
```

#### Setup Email OTP

**POST** `/api/2fa/setup/email`

Setup Email-based 2FA.

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/setup/email \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response:**
```json
{
  "message": "OTP sent to email address",
  "method": "email",
  "email": "u***@example.com",
  "expiresIn": 900
}
```

### 2FA Verification

#### Verify 2FA Code

**POST** `/api/2fa/verify`

Verify 2FA code during login.

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "code": "123456",
    "method": "totp"
  }'
```

**Response:**
```json
{
  "verified": true,
  "message": "2FA verified successfully"
}
```

#### Verify Recovery Code

**POST** `/api/2fa/recovery-code`

Use backup recovery code for login.

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/recovery-code \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "A1B2-3C4D"
  }'
```

**Response:**
```json
{
  "verified": true,
  "message": "Recovery code accepted"
}
```

### 2FA Management

#### Get 2FA Status

**GET** `/api/2fa/status`

Check current 2FA configuration.

**Request:**
```bash
curl http://localhost:5050/api/2fa/status \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "isEnabled": true,
  "method": "totp",
  "lastVerifiedAt": "2026-08-17T10:30:00Z",
  "enabledAt": "2026-08-10T14:20:00Z",
  "phoneNumber": null,
  "email": null
}
```

#### Disable 2FA

**POST** `/api/2fa/disable`

Disable 2FA (optionally with password confirmation).

**Request:**
```bash
curl -X POST http://localhost:5050/api/2fa/disable \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "message": "2FA has been disabled",
  "warning": "Your account is now less secure. Consider re-enabling 2FA."
}
```

### Device Management

#### Get Trusted Devices

**GET** `/api/security/devices`

List all trusted devices.

**Request:**
```bash
curl http://localhost:5050/api/security/devices \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "devices": [
    {
      "deviceId": "507f1f77bcf86cd799439020",
      "deviceName": "My iPhone",
      "ipAddress": "203.0.***.*",
      "lastUsedAt": "2026-08-17T10:30:00Z",
      "expiresAt": "2026-09-16T10:30:00Z",
      "isExpired": false
    },
    {
      "deviceId": "507f1f77bcf86cd799439021",
      "deviceName": "Office Laptop",
      "ipAddress": "192.168.***.*",
      "lastUsedAt": "2026-08-15T14:20:00Z",
      "expiresAt": "2026-09-14T14:20:00Z",
      "isExpired": false
    }
  ]
}
```

#### Revoke Device Trust

**DELETE** `/api/security/devices/:deviceId`

Revoke trust from a specific device.

**Request:**
```bash
curl -X DELETE http://localhost:5050/api/security/devices/507f1f77bcf86cd799439020 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "message": "Device revoked successfully"
}
```

### Security Monitoring

#### Get Login History

**GET** `/api/security/login-history`

View complete login audit trail.

**Query Parameters:**
- `limit` (default: 50): Number of records to return

**Request:**
```bash
curl "http://localhost:5050/api/security/login-history?limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "loginHistory": [
    {
      "timestamp": "2026-08-17T10:30:00Z",
      "status": "success",
      "ipAddress": "203.0.***.*",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)...",
      "location": "India",
      "reason": null
    },
    {
      "timestamp": "2026-08-17T08:15:00Z",
      "status": "failed",
      "ipAddress": "192.168.***.*",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "location": "India",
      "reason": "Invalid password"
    }
  ]
}
```

#### Get Security Summary

**GET** `/api/security/summary`

Overall security health check.

**Request:**
```bash
curl http://localhost:5050/api/security/summary \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "accountLocked": false,
  "totalLogins": 45,
  "failedAttempts": 2,
  "uniqueIPsUsed": 3,
  "lastLogin": "2026-08-17T10:30:00Z",
  "lastLoginIP": "203.0.113.45",
  "securityRiskLevel": "low"
}
```

## Login Flow with 2FA

### Standard Login (with 2FA)

1. **Submit Credentials**
   ```
   POST /api/auth/login
   { username, password }
   ```

2. **Server Response** - If 2FA enabled:
   ```json
   {
     "requiresVerification": true,
     "method": "totp",
     "temporaryToken": "temp_token_xxx"
   }
   ```

3. **Submit 2FA Code**
   ```
   POST /api/2fa/verify
   { userId, code, method }
   ```

4. **Server Validates** - If valid:
   ```json
   {
     "verified": true,
     "sessionToken": "session_token_xxx"
   }
   ```

5. **User Logged In** - If remembering device:
   ```
   Device fingerprint stored for 30 days
   ```

### Recovery Code Flow

1. **Lost authenticator app?**
   ```
   User clicks "Use recovery code"
   ```

2. **Submit Recovery Code**
   ```
   POST /api/2fa/recovery-code
   { code: "A1B2-3C4D" }
   ```

3. **Code Validated & Marked Used**
   ```
   User gains access
   Code cannot be reused
   ```

## Security Best Practices

### For Users

1. **Enable 2FA**
   - ✅ Use TOTP for highest security
   - ✅ SMS OTP as backup
   - ✅ Save recovery codes securely

2. **Protect Recovery Codes**
   - ✅ Store in password manager
   - ✅ Keep separate from device with authenticator
   - ✅ Don't share with anyone

3. **Review Login History**
   - ✅ Check `/api/security/login-history` regularly
   - ✅ Alert if see unfamiliar IPs
   - ✅ Revoke untrusted devices

4. **Manage Trusted Devices**
   - ✅ Only trust personal devices
   - ✅ Revoke access from shared computers
   - ✅ Clear on device loss/sale

### For Administrators

1. **Enforce 2FA**
   - ✅ Require 2FA for admin accounts
   - ✅ Optional for regular users
   - ✅ Mandatory for sensitive tenants

2. **Monitor Security**
   - ✅ Watch for account lockouts
   - ✅ Alert on multiple failed attempts
   - ✅ Review suspicious login patterns

3. **Audit Logs**
   - ✅ 2FA enabled/disabled logged
   - ✅ Recovery code usage tracked
   - ✅ Device trust changes audited

## Database Models

### TwoFactorAuth

```typescript
{
  userId: ObjectId,
  tenantId: ObjectId,
  method: 'totp' | 'sms' | 'email',
  secret?: string,              // TOTP secret
  phoneNumber?: string,         // SMS number
  email?: string,               // Email address
  otpHash?: string,             // Hashed OTP
  otpExpiresAt?: Date,          // OTP expiration
  isEnabled: boolean,
  enabledAt: Date,
  disabledAt?: Date,
  lastVerifiedAt: Date,
  codesUsed: number
}
```

### RecoveryCodes

```typescript
{
  userId: ObjectId,
  tenantId: ObjectId,
  codes: [
    {
      code: string,             // Hashed code
      used: boolean,
      usedAt?: Date
    }
  ]
}
```

### TrustedDevice

```typescript
{
  userId: ObjectId,
  tenantId: ObjectId,
  deviceName: string,           // "My iPhone", "Office Laptop"
  fingerprint: string,          // Device fingerprint hash
  ipAddress: string,
  userAgent: string,
  lastUsedAt: Date,
  expiresAt: Date,              // 30 days from creation
  isActive: boolean,
  revokedAt?: Date
}
```

### LoginAttempt

```typescript
{
  userId: ObjectId,
  tenantId: ObjectId,
  ipAddress: string,
  userAgent: string,
  status: 'success' | 'failed',
  reason?: string,              // "Invalid password", "Account locked"
  location?: string,
  timestamp: Date
}
```

## Security Thresholds

### Account Lockout

- **Trigger**: 5 failed login attempts in 15 minutes
- **Duration**: 30 minutes automatic unlock
- **Notification**: Email alert to account owner

### Suspicious Activity Alerts

| Flag | Trigger | Action |
|------|---------|--------|
| **Multiple Failed Attempts** | 5+ failures in 24h | Require 2FA verification |
| **Multiple IPs** | 3+ different IPs in 24h | Send security alert |
| **Rapid Logins** | 10+ attempts in 1 hour | Temporary account lockout |
| **New IP Address** | Login from unknown IP | Add security warning |

### Recovery Code Limits

- **Generated**: 10 codes per 2FA enable
- **Valid**: Until account 2FA is disabled
- **One-time use**: Each code usable once only
- **Regeneration**: New codes generated when re-enabling 2FA

## Integration Examples

### Enable 2FA (TOTP)

```javascript
async function enable2FA() {
  // Step 1: Generate secret
  const setupResponse = await fetch('/api/2fa/setup/totp', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { secret, qrCode, backupCodes } = await setupResponse.json();
  
  // Step 2: Show QR code and backup codes to user
  displayQRCode(qrCode);
  displayBackupCodes(backupCodes);
  
  // Step 3: User scans and enters code
  const userCode = await getUserInput('Enter 6-digit code from app:');
  
  // Step 4: Verify and enable
  const verifyResponse = await fetch('/api/2fa/verify/totp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ secret, code: userCode })
  });
  
  const result = await verifyResponse.json();
  showSuccess('2FA enabled successfully!');
}
```

### Check Security Status

```javascript
async function checkSecurityStatus() {
  const response = await fetch('/api/security/summary', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const status = await response.json();
  
  if (status.securityRiskLevel === 'high') {
    showWarning(`High security risk: ${status.failedAttempts} failed attempts`);
  }
  
  if (status.uniqueIPsUsed > 5) {
    showWarning(`Account accessed from ${status.uniqueIPsUsed} different locations`);
  }
}
```

## Compliance & Standards

### NIST Recommendations

- ✅ Requires shared secret (TOTP)
- ✅ Supports SMS/Email as secondary
- ✅ Recovery codes for backup access
- ✅ Account lockout mechanism
- ✅ Login attempt logging

### SOC2 Requirements

- ✅ Multi-factor authentication capability
- ✅ Audit trail of 2FA events
- ✅ Device trust & management
- ✅ Account lockout procedures
- ✅ Suspicious activity monitoring

### GDPR Compliance

- ✅ User control over 2FA settings
- ✅ Device history auditable
- ✅ Recovery codes manageable
- ✅ Account recovery without data loss

## Troubleshooting

### Lost Authenticator App

1. Use recovery code to login
2. Disable 2FA: POST /api/2fa/disable
3. Re-enable 2FA: POST /api/2fa/setup/totp
4. Save new backup codes

### Account Locked

1. Wait 30 minutes for automatic unlock
2. Or contact admin for immediate unlock
3. Reset password for security
4. Review login history

### OTP Expired

1. Request new OTP
2. New OTP sent immediately
3. Valid for 10 minutes (SMS) or 15 minutes (Email)

### Device Not Trusted

- Device fingerprint doesn't match
- Expires after 30 days automatically
- Manually revoke via /api/security/devices/:deviceId

## Production Checklist

- [ ] TOTP implementation tested
- [ ] SMS OTP service configured (Twilio/AWS SNS)
- [ ] Email OTP service configured
- [ ] Recovery code generation tested
- [ ] Device fingerprinting verified
- [ ] Account lockout threshold set
- [ ] Suspicious activity detection enabled
- [ ] Login history retention set
- [ ] Email alerts configured
- [ ] User documentation created
- [ ] Admin dashboard shows 2FA stats
- [ ] Backup & recovery procedures documented

## Future Enhancements

- [ ] WebAuthn/FIDO2 security keys
- [ ] Biometric authentication (fingerprint, face)
- [ ] Passwordless login options
- [ ] Risk-based authentication (adaptive MFA)
- [ ] Geo-location based alerts
- [ ] Single sign-on (SSO) integration

---

**Last Updated**: 2026-08-17  
**Status**: Production Ready  
**Auth Methods**: 3 (TOTP, SMS, Email)  
**Recovery Codes**: 10 per user  
**Device Trust**: 30-day expiration  
**Account Lockout**: 5 attempts / 30 min
