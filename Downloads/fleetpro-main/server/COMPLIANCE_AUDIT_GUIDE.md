# Compliance & Audit Logging System - Complete Guide

## Overview

The Compliance & Audit Logging System provides enterprise-grade audit trails, compliance policy management, and regulatory reporting for FleetPro. Supports GDPR, CCPA, HIPAA, SOC2, and ISO27001 compliance frameworks.

## Features

### Core Capabilities

- **Comprehensive Audit Logging**: Every user action tracked with timestamp, IP, and user agent
- **Compliance Policy Management**: Define, enforce, and track compliance requirements
- **Data Retention Policies**: Automated data lifecycle management (delete, archive)
- **Regulatory Reporting**: Pre-built reports for GDPR, CCPA, SOC2, and ISO27001
- **Access Audit Trail**: Track file access, API usage, data modifications
- **User Activity Timeline**: Complete history of user actions
- **Compliance Dashboard**: Real-time compliance score and policy status
- **Immutable Logs**: Audit logs cannot be modified (append-only)

### Supported Frameworks

| Framework | Focus | Use Case |
|-----------|-------|----------|
| **GDPR** | Privacy & data protection | EU-based businesses, data subjects |
| **CCPA** | Consumer privacy rights | California-based businesses |
| **HIPAA** | Healthcare data security | Healthcare organizations |
| **SOC2** | Security & trust controls | SaaS/Cloud service providers |
| **ISO27001** | Information security | Enterprise security standards |

## API Endpoints

### Audit Logs

#### Get Audit Logs

**GET** `/api/audit-logs`

Retrieve audit logs for your tenant.

**Query Parameters:**
- `action` (optional): Filter by action type
- `resourceType` (optional): Filter by resource type
- `status` (optional): Filter by status (success/failure)
- `limit` (default: 50): Number of records
- `skip` (default: 0): Pagination offset

**Request:**
```bash
curl http://localhost:5050/api/audit-logs?action=LOGIN&limit=50 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "logs": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "tenantId": "507f1f77bcf86cd799439001",
      "userId": "507f1f77bcf86cd799439012",
      "action": "LOGIN",
      "resourceType": "user",
      "status": "success",
      "ipAddress": "203.0.113.45",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-08-17T10:30:00Z"
    }
  ]
}
```

#### Get User Audit Logs

**GET** `/api/audit-logs/:userId`

Get all actions performed by a specific user.

**Request:**
```bash
curl http://localhost:5050/api/audit-logs/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer <token>"
```

#### Get Audit Statistics

**GET** `/api/audit-logs/stats`

Get audit statistics for the past N days.

**Query Parameters:**
- `days` (default: 30): Number of days to analyze

**Response:**
```json
{
  "totalLogs": 1250,
  "successCount": 1200,
  "failureCount": 50,
  "uniqueUsers": 15,
  "actionTypes": 8,
  "resourceTypes": 6,
  "successRate": 96
}
```

### Compliance Policies

#### Get Compliance Policies

**GET** `/api/compliance/policies`

Retrieve all compliance policies for your tenant.

**Request:**
```bash
curl http://localhost:5050/api/compliance/policies \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "policies": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "policyName": "GDPR Data Protection Policy",
      "framework": "GDPR",
      "status": "active",
      "requirements": [
        "Data subject access rights",
        "Data deletion capabilities",
        "Encryption in transit and at rest"
      ],
      "effectiveDate": "2026-01-01T00:00:00Z",
      "expiryDate": "2027-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Compliance Policy

**POST** `/api/compliance/policies`

Create a new compliance policy (Admin only).

**Request:**
```bash
curl -X POST http://localhost:5050/api/compliance/policies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "policyName": "SOC2 Type II Controls",
    "description": "Security controls for SaaS platform",
    "framework": "SOC2",
    "requirements": [
      "Two-factor authentication",
      "Encryption at rest",
      "Audit logging",
      "Access controls",
      "Incident response"
    ],
    "status": "active",
    "effectiveDate": "2026-08-17"
  }'
```

#### Get Compliance Status

**GET** `/api/compliance/status`

Get overall compliance status and policy coverage.

**Response:**
```json
{
  "tenantId": "507f1f77bcf86cd799439001",
  "complianceScore": 85,
  "totalPolicies": 5,
  "activePolicies": 4,
  "frameworksCovered": ["GDPR", "SOC2", "ISO27001"],
  "dataRetentionPolicies": 3,
  "lastReview": "2026-08-17T10:30:00Z",
  "status": "compliant"
}
```

### Compliance Reports

#### Generate GDPR Report

**GET** `/api/compliance/gdpr-report/:userId`

Export user's personal data for GDPR Subject Access Request (SAR).

**Request:**
```bash
curl http://localhost:5050/api/compliance/gdpr-report/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "requestId": "507f1f77bcf86cd799439030",
  "userId": "507f1f77bcf86cd799439012",
  "requestType": "GDPR_DATA_EXPORT",
  "status": "pending",
  "requestedAt": "2026-08-17T10:30:00Z",
  "expiresAt": "2026-09-16T10:30:00Z",
  "dataIncluded": [
    "profile_data",
    "transaction_history",
    "communication_logs",
    "activity_logs",
    "file_uploads"
  ]
}
```

#### Generate SOC2 Report

**GET** `/api/compliance/soc2-report`

Generate SOC2 Type II compliance report (Admin only).

**Request:**
```bash
curl http://localhost:5050/api/compliance/soc2-report \
  -H "Authorization: Bearer <admin-token>"
```

**Response:**
```json
{
  "reportId": "507f1f77bcf86cd799439040",
  "reportType": "SOC2_COMPLIANCE",
  "framework": "SOC2 Type II",
  "trustPrinciples": [
    "CC - Security",
    "A - Availability",
    "P - Processing Integrity",
    "C - Confidentiality",
    "PI - Privacy"
  ],
  "controlAreas": [
    "Access Control",
    "Encryption",
    "Audit Logging",
    "Incident Response",
    "Change Management",
    "Disaster Recovery"
  ],
  "policies": 5,
  "generatedAt": "2026-08-17T10:30:00Z"
}
```

#### Generate CCPA Report

**GET** `/api/compliance/ccpa-report`

Generate CCPA compliance report (Admin only).

**Request:**
```bash
curl http://localhost:5050/api/compliance/ccpa-report \
  -H "Authorization: Bearer <admin-token>"
```

**Response:**
```json
{
  "reportId": "507f1f77bcf86cd799439050",
  "reportType": "CCPA_COMPLIANCE",
  "framework": "CCPA/CPRA",
  "requirements": [
    "Right to Know",
    "Right to Delete",
    "Right to Opt-Out",
    "Right to Non-Discrimination"
  ],
  "dataCategories": [
    "Identifiers",
    "Commercial Information",
    "Biometric Information",
    "Internet Activity",
    "Geolocation Data",
    "Professional Information"
  ],
  "disclosures": {
    "dataCategoryCount": 6,
    "businessPurposes": 5,
    "thirdPartyShares": 3
  },
  "generatedAt": "2026-08-17T10:30:00Z"
}
```

### Data Retention Policies

#### Get Data Retention Policies

**GET** `/api/data-retention`

Retrieve all data retention policies.

**Request:**
```bash
curl http://localhost:5050/api/data-retention \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "policies": [
    {
      "_id": "507f1f77bcf86cd799439060",
      "dataType": "audit_logs",
      "retentionDays": 365,
      "autoDelete": false,
      "archiveBeforeDelete": true,
      "purpose": "Compliance & audit trail"
    },
    {
      "_id": "507f1f77bcf86cd799439061",
      "dataType": "error_logs",
      "retentionDays": 90,
      "autoDelete": true,
      "archiveBeforeDelete": true,
      "purpose": "Debugging & monitoring"
    }
  ]
}
```

#### Set Data Retention Policy

**POST** `/api/data-retention`

Create or update a data retention policy (Admin only).

**Request:**
```bash
curl -X POST http://localhost:5050/api/data-retention \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "user_sessions",
    "retentionDays": 30,
    "autoDelete": true,
    "archiveBeforeDelete": false,
    "purpose": "Session management & security"
  }'
```

## Audit Log Actions

### Common Actions Tracked

| Action | Description | Resource Type |
|--------|-------------|---------------|
| LOGIN | User login | user |
| LOGOUT | User logout | user |
| CREATE | Resource created | any |
| UPDATE | Resource modified | any |
| DELETE | Resource soft-deleted | any |
| EXPORT | Data exported | export |
| SHARE | File/resource shared | sharing |
| ACCESS_GRANTED | Permission granted | access |
| ACCESS_REVOKED | Permission revoked | access |
| DOWNLOAD | File downloaded | file |
| API_KEY_CREATED | API key generated | api_key |
| API_KEY_REVOKED | API key revoked | api_key |
| PASSWORD_RESET | Password changed | user |
| TWO_FACTOR_ENABLED | 2FA activated | security |

## Data Retention

### Default Retention Policies

| Data Type | Retention | Auto-Delete | Archive |
|-----------|-----------|-------------|---------|
| Audit Logs | 365 days | No | Yes (after 90 days) |
| Error Logs | 90 days | Yes | Yes |
| Access Logs | 30 days | Yes | No |
| User Sessions | 30 days | Yes | No |
| Deleted Records | 30 days | Yes | Yes |

### Custom Retention Configuration

Set custom retention policies via `/api/data-retention`:

```javascript
{
  dataType: "customer_feedback",
  retentionDays: 730,        // 2 years
  autoDelete: true,
  archiveBeforeDelete: true,
  purpose: "Customer insights & analysis"
}
```

## Compliance Frameworks

### GDPR (General Data Protection Regulation)

**Requirements:**
- Data subject access rights
- Right to deletion (right to be forgotten)
- Data portability
- Encryption in transit and at rest
- Data processing agreements
- Privacy impact assessments

**Endpoints:**
- `GET /api/compliance/gdpr-report/:userId` - Subject Access Request
- `GET /api/audit-logs` - Data processing history

### SOC2 Type II (Service Organization Control)

**Trust Principles:**
1. **Security (CC)** - System protected against unauthorized access
2. **Availability (A)** - System operates as intended 24/7
3. **Processing Integrity (P)** - Data processed accurately and timely
4. **Confidentiality (C)** - Data protected from unauthorized access
5. **Privacy (PI)** - Personal data collected & used appropriately

**Audit Trails:**
- Access logs for all user actions
- Configuration change tracking
- Security incident logs

### CCPA/CPRA (California Consumer Privacy Act)

**Consumer Rights:**
- Right to Know - access personal data
- Right to Delete - remove personal data
- Right to Opt-Out - opt out of data sales
- Right to Non-Discrimination - no discrimination for exercising rights

**Tracking:**
- Data category inventory
- Third-party sharing log
- Business purpose tracking

### ISO27001 (Information Security Management)

**Key Controls:**
- Access control & authentication
- Encryption & cryptography
- Incident management
- Business continuity & recovery
- Security awareness training

## Integration Examples

### Track Custom Action

```javascript
const { auditLogService } = await import('./services/AuditLogService');

await auditLogService.createLog({
  tenantId: req.user.tenantId,
  userId: req.user._id,
  action: 'BULK_EXPORT',
  resourceType: 'booking',
  resourceId: booking._id,
  changes: { format: 'csv', recordCount: 1000 },
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  status: 'success',
  metadata: { duration: '2.5s' }
});
```

### Check Compliance Status

```javascript
const { complianceService } = await import('./services/ComplianceService');

const status = await complianceService.checkComplianceStatus(tenantId);

if (status.complianceScore < 70) {
  // Alert: Low compliance score
  sendAlert(`Compliance score: ${status.complianceScore}%`);
}
```

### Query Audit Trail

```javascript
const { auditLogService } = await import('./services/AuditLogService');

// Get all failed login attempts in last 7 days
const failedLogins = await auditLogService.getLogs({
  tenantId,
  action: 'LOGIN',
  status: 'failure',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});
```

## Compliance Checklist

### Pre-Launch Audit

- [ ] All user actions logged to audit trail
- [ ] Audit logs immutable & tamper-proof
- [ ] Data retention policies defined
- [ ] Compliance framework selected (GDPR, SOC2, etc.)
- [ ] GDPR/CCPA compliance policies created
- [ ] Access control policies documented
- [ ] Encryption policies enforced
- [ ] Incident response procedures documented

### Ongoing Compliance

- [ ] Audit logs monitored for suspicious activity
- [ ] Compliance reports generated monthly
- [ ] Data retention policies executed automatically
- [ ] Failed access attempts reviewed
- [ ] Policy changes logged & approved
- [ ] Regular compliance score checks
- [ ] Audit trail backups maintained
- [ ] Regulatory changes monitored

### Audit Response

- [ ] Subject Access Requests processed within 30 days (GDPR)
- [ ] Data deletion requests honored within 30 days
- [ ] Incident timeline documented in audit logs
- [ ] Affected users notified
- [ ] Compliance reports filed with regulators

## Security Considerations

### Audit Log Protection

- **Immutability**: Logs append-only, no modification/deletion
- **Encryption**: Logs encrypted in transit and at rest
- **Access Control**: Only admins can read audit logs
- **Retention**: Logs retained per data retention policy
- **Backup**: Regular backups to separate secure storage

### Compliance Report Security

- **Authentication**: Admin-only access
- **Audit**: Report access logged in audit trail
- **Encryption**: Reports encrypted when downloaded
- **Retention**: Reports archived per retention policy
- **Integrity**: Reports include hash for tamper detection

## Troubleshooting

### Logs Not Appearing

**Issue**: Actions not logged to audit trail
- Verify audit logging service is running
- Check logs service configuration
- Ensure all handlers call `createLog()`

### High Volume of Logs

**Issue**: Audit logs consuming excessive storage
- Review data retention policies
- Increase archival frequency
- Enable compression for archived logs

### Compliance Score Declining

**Issue**: Compliance score dropping
- Check for expired policies
- Review data retention compliance
- Verify policy requirements being met

## Production Checklist

- [ ] Audit logging enabled in production
- [ ] Database backups for audit logs
- [ ] Monitoring & alerting for failed actions
- [ ] Data retention automation in place
- [ ] Compliance framework selected
- [ ] Policies created & active
- [ ] GDPR/CCPA pages updated
- [ ] Privacy policy reviewed by legal
- [ ] Incident response plan documented
- [ ] Compliance audit scheduled annually

---

**Last Updated**: 2026-08-17  
**Status**: Production Ready  
**Supported Frameworks**: GDPR, CCPA, HIPAA, SOC2, ISO27001  
**Audit Log Retention**: 365 days (configurable)  
**Reports Available**: GDPR, SOC2, CCPA, Custom
