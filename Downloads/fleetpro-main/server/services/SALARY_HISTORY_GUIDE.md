# Salary History & Audit Trail Implementation Guide

## Overview

The Salary History system provides an immutable record of all salary changes with comprehensive audit trails. This ensures complete transparency, compliance, and historical tracking of salary modifications.

## Key Features

### 1. **Immutable Records**
- Once created, salary history records cannot be modified or deleted
- All changes are tracked through the audit trail
- Timestamps are immutable and set at creation time
- Provides legal compliance and dispute resolution

### 2. **Change Types**
- **Hike**: Salary increase (promotion, raise, etc.)
- **Adjustment**: Correction of previous errors
- **Deduction**: Temporary or permanent salary reduction
- **Incentive Change**: Modification to incentive structure
- **Initial Setup**: First salary record for a driver

### 3. **Status Workflow**
```
Draft → Pending Approval → Approved → Applied
                      ↓
                   Rejected
```

### 4. **Approval Flow**
- Draft: Initial creation state
- Pending Approval: Submitted for manager/admin review
- Approved: Approved by authorized personnel
- Rejected: Rejected with reason
- Applied: Active and applied to payroll

### 5. **Audit Trail Features**
- Action tracking (created, updated, approved, rejected, applied, viewed, exported)
- Actor identification (who made the change)
- Detailed change information (old value → new value)
- Severity levels (low, medium, high)
- IP address and user agent tracking
- Tagging system for categorization

## Database Schema

### SalaryHistory Collection
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  driverId: ObjectId,
  salaryMasterId?: ObjectId,
  changeType: 'hike' | 'adjustment' | 'deduction' | 'incentive_change' | 'initial_setup',
  previousValue: {
    baseSalary?: number,
    incentives?: number,
    deductions?: number,
    netSalary?: number
  },
  newValue: {
    baseSalary?: number,
    incentives?: number,
    deductions?: number,
    netSalary?: number
  },
  changeAmount?: number,
  percentageChange?: number,
  reason?: string,
  notes?: string,
  appliedFrom: Date,
  createdBy: {
    userId: string,
    userName: string,
    role: string
  },
  approvedBy?: {
    userId: string,
    userName: string,
    approvalDate: Date
  },
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'applied',
  attachmentUrl?: string,
  createdAt: Date // Immutable
}
```

### SalaryAuditTrail Collection
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  driverId: ObjectId,
  salaryHistoryId?: ObjectId,
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'applied' | 'viewed' | 'exported',
  actionDetails: {
    fieldChanged?: string,
    oldValue?: any,
    newValue?: any,
    changeDescription?: string
  },
  actor: {
    userId: string,
    userName: string,
    role: string,
    department?: string
  },
  ipAddress?: string,
  userAgent?: string,
  status: 'success' | 'failed',
  errorMessage?: string,
  severity: 'low' | 'medium' | 'high',
  tags?: string[],
  createdAt: Date // Immutable
}
```

## API Endpoints

### Create Salary History
```
POST /api/salary-history
Content-Type: application/json

{
  "driverId": "507f1f77bcf86cd799439011",
  "salaryMasterId": "507f1f77bcf86cd799439012",
  "changeType": "hike",
  "previousValue": {
    "baseSalary": 20000,
    "incentives": 2000,
    "deductions": 1000,
    "netSalary": 21000
  },
  "newValue": {
    "baseSalary": 23000,
    "incentives": 2000,
    "deductions": 1000,
    "netSalary": 24000
  },
  "changeAmount": 3000,
  "reason": "Annual performance review - Excellent performance",
  "appliedFrom": "2026-09-01T00:00:00Z"
}

Response: 201
{
  "_id": "507f1f77bcf86cd799439013",
  "driverId": "507f1f77bcf86cd799439011",
  "status": "draft",
  "changeType": "hike",
  "percentageChange": 14.29,
  "createdAt": "2026-08-13T10:30:00Z",
  ...
}
```

### Submit for Approval
```
POST /api/salary-history/:salaryHistoryId/submit-approval
Content-Type: application/json

Response: 200
{
  "status": "pending_approval",
  ...
}
```

### Approve Salary Change
```
POST /api/salary-history/:salaryHistoryId/approve
Content-Type: application/json

Response: 200
{
  "status": "approved",
  "approvedBy": {
    "userId": "manager1",
    "userName": "John Manager",
    "approvalDate": "2026-08-13T11:00:00Z"
  }
}
```

### Reject Salary Change
```
POST /api/salary-history/:salaryHistoryId/reject
Content-Type: application/json

{
  "reason": "Needs more documentation for justification"
}

Response: 200
{
  "status": "rejected",
  "notes": "Rejected: Needs more documentation for justification"
}
```

### Apply Salary Change
```
POST /api/salary-history/:salaryHistoryId/apply
Content-Type: application/json

Response: 200
{
  "status": "applied",
  ...
}
```

### Get Driver Salary History
```
GET /api/salary-history/driver/:driverId?limit=50&offset=0&status=applied&changeType=hike&startDate=2026-01-01&endDate=2026-08-31

Response: 200
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "driverId": "507f1f77bcf86cd799439011",
      "changeType": "hike",
      "percentageChange": 14.29,
      "status": "applied",
      "appliedFrom": "2026-09-01T00:00:00Z",
      ...
    }
  ],
  "total": 1
}
```

### Get Audit Trail for Salary History
```
GET /api/salary-history/:salaryHistoryId/audit?limit=100&offset=0

Response: 200
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "action": "created",
      "actor": {
        "userId": "admin1",
        "userName": "Admin User",
        "role": "admin"
      },
      "severity": "high",
      "createdAt": "2026-08-13T10:30:00Z",
      ...
    },
    {
      "_id": "507f1f77bcf86cd799439015",
      "action": "approved",
      "actor": {
        "userId": "manager1",
        "userName": "John Manager",
        "role": "manager"
      },
      "severity": "high",
      "createdAt": "2026-08-13T11:00:00Z",
      ...
    }
  ],
  "total": 2
}
```

### Get Complete Audit Trail for Driver
```
GET /api/salary-history/driver/:driverId/audit?limit=100&action=approved&severity=high

Response: 200
{
  "data": [...],
  "total": 10
}
```

### Get Salary Summary
```
GET /api/salary-history/driver/:driverId/summary

Response: 200
{
  "currentRecord": {...},
  "lastHike": {...},
  "totalChanges": 5,
  "pendingApprovals": 1,
  "history": [...]
}
```

### Export Salary History
```
GET /api/salary-history/driver/:driverId/export?format=json|csv

Response: 200
{
  // JSON or CSV data
}
```

### Validate Salary History Integrity
```
POST /api/salary-history/driver/:driverId/validate

Response: 200
{
  "valid": true,
  "issues": []
}
```

## Service Methods

### SalaryHistoryService

#### createSalaryHistory(data: CreateSalaryHistoryDTO): Promise<ISalaryHistory>
Creates a new salary history record. Automatically calculates percentage change and creates audit trail.

```typescript
const service = new SalaryHistoryService();
const history = await service.createSalaryHistory({
  tenantId: new ObjectId('507f1f77bcf86cd799439010'),
  driverId: new ObjectId('507f1f77bcf86cd799439011'),
  changeType: 'hike',
  newValue: { baseSalary: 25000 },
  appliedFrom: new Date('2026-09-01'),
  createdBy: {
    userId: 'admin1',
    userName: 'Admin User',
    role: 'admin'
  }
});
```

#### submitForApproval(id: ObjectId, actor): Promise<ISalaryHistory>
Changes status from 'draft' to 'pending_approval' and logs audit trail.

#### approveSalaryChange(id: ObjectId, approver): Promise<ISalaryHistory>
Approves a pending salary change. Status becomes 'approved'.

#### rejectSalaryChange(id: ObjectId, reason: string, actor): Promise<ISalaryHistory>
Rejects a pending salary change with reason documentation.

#### applySalaryChange(id: ObjectId, actor): Promise<ISalaryHistory>
Applies an approved salary change to active payroll. Status becomes 'applied'.

#### getDriverSalaryHistory(tenantId, driverId, options): Promise<{data, total}>
Retrieves salary history with pagination and filtering.

Options:
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by status
- `changeType`: Filter by change type
- `startDate`: Filter by applied date range
- `endDate`: Filter by applied date range

#### getSalaryAuditTrail(salaryHistoryId, options): Promise<{data, total}>
Gets complete audit trail for a specific salary change.

#### getDriverSalaryAuditTrail(tenantId, driverId, options): Promise<{data, total}>
Gets audit trail for all salary changes for a driver.

Options:
- `limit`: Results per page
- `offset`: Pagination offset
- `action`: Filter by action type
- `severity`: Filter by severity level
- `startDate`: Date range start
- `endDate`: Date range end

#### getDriverSalarySummary(tenantId, driverId): Promise<Summary>
Gets comprehensive salary summary including current, last hike, and pending approvals.

#### exportSalaryHistory(tenantId, driverId, format): Promise<string>
Exports salary history as JSON or CSV format.

#### validateIntegrity(tenantId, driverId): Promise<{valid, issues}>
Validates salary history continuity and reports any issues.

## Implementation Checklist

- [x] Database models and schemas created
- [x] SalaryHistoryService implemented with all methods
- [x] React components created (SalaryHistoryTable, Details, AuditTrail)
- [ ] API routes in routes.ts
- [ ] Request/response validation schemas
- [ ] Audit trail logging for all operations
- [ ] Permission checks (manager/admin only)
- [ ] Integration tests
- [ ] UI integration into driver profile page
- [ ] Email notifications for approvals
- [ ] Scheduled task for auto-application on effective date
- [ ] Dashboard widget for pending approvals
- [ ] Reports generation

## Security Considerations

1. **Immutability**: Records cannot be modified after creation
2. **Audit Trail**: All actions are logged with actor identification
3. **Permissions**: Only managers and admins can create/approve changes
4. **IP Tracking**: Track IP addresses for suspicious activity detection
5. **Timestamps**: Server-side immutable timestamps prevent tampering
6. **Compliance**: Complete audit trail for compliance and audits

## Usage Examples

### Create and Submit Salary Hike for Approval

```typescript
// Step 1: Create salary history record
const history = await salaryHistoryService.createSalaryHistory({
  tenantId: req.user.tenantId,
  driverId: req.body.driverId,
  changeType: 'hike',
  previousValue: { baseSalary: 20000 },
  newValue: { baseSalary: 23000 },
  changeAmount: 3000,
  percentageChange: 15,
  reason: 'Annual raise - Performance review',
  appliedFrom: new Date('2026-09-01'),
  createdBy: {
    userId: req.user.userId,
    userName: req.user.businessDetails.ownerName,
    role: req.user.role
  }
});

// Step 2: Submit for approval
await salaryHistoryService.submitForApproval(history._id, {
  userId: req.user.userId,
  userName: req.user.businessDetails.ownerName,
  role: req.user.role
});

// Step 3: Approve (by manager)
await salaryHistoryService.approveSalaryChange(history._id, {
  userId: 'manager1',
  userName: 'Manager Name',
  role: 'manager'
});

// Step 4: Apply on effective date
await salaryHistoryService.applySalaryChange(history._id, {
  userId: 'system',
  userName: 'System',
  role: 'system'
});
```

### Generate Salary History Report

```typescript
// Get complete summary
const summary = await salaryHistoryService.getDriverSalarySummary(
  tenantId,
  driverId
);

// Export as CSV
const csvData = await salaryHistoryService.exportSalaryHistory(
  tenantId,
  driverId,
  'csv'
);

// Validate integrity
const validation = await salaryHistoryService.validateIntegrity(
  tenantId,
  driverId
);
```

## Monitoring and Alerts

Monitor these metrics:
- Total salary changes per driver
- Pending approvals count
- Rejected changes
- Failed salary applications
- High-severity audit trail events

## Future Enhancements

1. Batch salary updates
2. Salary increment schedules
3. Automatic increment on anniversaries
4. Comparison reports
5. Salary benchmarking
6. Predictive analytics for salary planning
7. Integration with payment gateway
8. Multi-level approval workflows
