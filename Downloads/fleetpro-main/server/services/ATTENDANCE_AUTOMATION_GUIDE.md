# AttendanceAutomationService - Complete Guide

## Overview

The `AttendanceAutomationService` automatically marks driver attendance based on their operational state and booking activity. It intelligently determines whether a driver is:
- **BOOKING_SERVE**: Actively serving a booking
- **IDLE_AVAILABLE**: Available and idle (no active booking)
- **LEAVE**: On leave (sick, casual, earned, unpaid, emergency)
- **ABSENT**: Absent without explanation
- **MANUAL_OVERRIDE**: Manually marked by admin/manager

## Data Model

### IAttendance Interface

```typescript
interface IAttendance extends Document {
  tenantId: mongoose.Types.ObjectId;        // Tenant reference
  driverId: mongoose.Types.ObjectId;         // Driver reference
  date: Date;                                // Attendance date (YYYY-MM-DD)
  status: AttendanceStatus;                  // Current attendance status
  checkInTime?: Date;                        // When driver checked in
  checkOutTime?: Date;                       // When driver checked out
  bookingId?: mongoose.Types.ObjectId;       // Reference to booking if on BOOKING_SERVE
  leaveType?: LeaveType;                     // Leave type (sick, casual, earned, unpaid, emergency)
  totalHours?: number;                       // Total hours worked
  notes?: string;                            // Additional notes
  autoMarked: boolean;                       // Whether auto-marked by service
  markedBy?: {                               // Who manually marked (if not auto)
    userId: string;
    userName: string;
    role: string;
  };
  createdAt: Date;                           // Record creation time
  updatedAt: Date;                           // Last update time
}
```

### Attendance Status Types

| Status | Description | Use Case |
|--------|-------------|----------|
| `BOOKING_SERVE` | Driver is actively serving a booking | Driver picked up customer and is on route |
| `IDLE_AVAILABLE` | Driver is available with no active booking | Driver is waiting for next booking |
| `LEAVE` | Driver is on approved leave | Sick leave, casual leave, etc. |
| `ABSENT` | Driver is absent without explanation | No show, no leave approval |
| `MANUAL_OVERRIDE` | Admin/Manager manually marked attendance | Special circumstances requiring override |

### Leave Types

- `sick`: Sick leave
- `casual`: Casual leave
- `earned`: Earned/privileged leave
- `unpaid`: Unpaid leave
- `emergency`: Emergency leave

## Installation & Setup

### 1. Model Integration

The Attendance model is already integrated in `server/models/index.ts`:

```typescript
import { Attendance } from '../models/index';
```

### 2. Service Import

```typescript
import { AttendanceAutomationService } from '../services/AttendanceAutomationService';

const service = new AttendanceAutomationService();
// Or use singleton
import { attendanceAutomationService } from '../services/AttendanceAutomationService';
```

### 3. Database Indexes

The following indexes are automatically created for optimal performance:

```typescript
// Composite index for daily lookups
{ tenantId: 1, driverId: 1, date: 1 }

// Tenant date queries
{ tenantId: 1, date: 1 }

// Driver history queries
{ driverId: 1, date: -1 }

// Status-based queries
{ status: 1, tenantId: 1 }

// Manual override tracking
{ autoMarked: 1 }

// Recent entries
{ createdAt: -1 }
```

## Service Methods

### 1. autoMarkAttendance()

Automatically marks attendance for a driver based on their state.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;  // Required
  driverId: mongoose.Types.ObjectId;  // Required
  date?: Date;                         // Optional, defaults to today
  status: AttendanceStatus;            // Required
  leaveType?: LeaveType;              // Optional, for LEAVE status
  bookingId?: mongoose.Types.ObjectId; // Optional, for BOOKING_SERVE
  notes?: string;                      // Optional
  checkInTime?: Date;                  // Optional
  checkOutTime?: Date;                 // Optional
}
```

**Example:**
```typescript
const attendance = await service.autoMarkAttendance({
  tenantId: new ObjectId('...'),
  driverId: new ObjectId('...'),
  status: 'IDLE_AVAILABLE',
  checkInTime: new Date('2024-01-15 09:00:00'),
  checkOutTime: new Date('2024-01-15 17:00:00'),
  notes: 'Regular day'
});
```

**Returns:** `IAttendance` document with auto-marked flag set to `true`

### 2. manualOverrideAttendance()

Allows admin/manager to manually set attendance status.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  date?: Date;
  status: AttendanceStatus;
  leaveType?: LeaveType;
  notes?: string;
  markedBy: {                  // Required for manual marking
    userId: string;
    userName: string;
    role: string;
  };
  checkInTime?: Date;
  checkOutTime?: Date;
}
```

**Example:**
```typescript
const attendance = await service.manualOverrideAttendance({
  tenantId: new ObjectId('...'),
  driverId: new ObjectId('...'),
  status: 'LEAVE',
  leaveType: 'emergency',
  notes: 'Family emergency - approved by manager',
  markedBy: {
    userId: 'mgr123',
    userName: 'John Manager',
    role: 'manager'
  }
});
```

**Returns:** `IAttendance` document with auto-marked flag set to `false`

### 3. markLeave()

Marks leave for a driver over a date range.

**Parameters:**
```typescript
tenantId: mongoose.Types.ObjectId;
driverId: mongoose.Types.ObjectId;
startDate: Date;
endDate: Date;
leaveType: LeaveType;
notes?: string;
markedBy?: {
  userId: string;
  userName: string;
  role: string;
};
```

**Example:**
```typescript
const leaveRecords = await service.markLeave(
  new ObjectId('...'),      // tenantId
  new ObjectId('...'),      // driverId
  new Date('2024-01-15'),   // startDate
  new Date('2024-01-17'),   // endDate (3 days)
  'casual',                 // leaveType
  'Casual leave for personal reasons',
  {
    userId: 'mgr123',
    userName: 'Manager',
    role: 'manager'
  }
);
```

**Returns:** Array of `IAttendance` documents (one per day)

### 4. processAllDriversAttendance()

Automatically processes attendance for all active drivers in a tenant.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  date?: Date;  // Defaults to today
}
```

**Example:**
```typescript
const result = await service.processAllDriversAttendance(
  new ObjectId('...'),  // tenantId
  new Date('2024-01-15')
);

console.log(result);
// {
//   processed: 15,        // Total drivers processed
//   updated: 15,          // Successfully updated
//   errors: []            // Any errors during processing
// }
```

**Returns:** Result object with statistics

### 5. getAttendanceHistory()

Retrieves attendance records for a driver over a date range.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
}
```

**Example:**
```typescript
const history = await service.getAttendanceHistory(
  new ObjectId('...'),
  new ObjectId('...'),
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
```

**Returns:** Array of `IAttendance` documents sorted by date (newest first)

### 6. getAttendanceStats()

Calculates attendance statistics for a driver.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
}
```

**Example:**
```typescript
const stats = await service.getAttendanceStats(
  new ObjectId('...'),
  new ObjectId('...'),
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

console.log(stats);
// {
//   totalDays: 28,
//   presentDays: 24,
//   leaveDays: 2,
//   bookingDays: 15,
//   absentDays: 2,
//   avgHoursPerDay: 8.5
// }
```

**Returns:** Statistics object with breakdown

### 7. getDailyAttendanceReport()

Gets attendance for all drivers on a specific date.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  date?: Date;  // Defaults to today
}
```

**Example:**
```typescript
const report = await service.getDailyAttendanceReport(
  new ObjectId('...'),
  new Date('2024-01-15')
);

console.log(report);
// [
//   {
//     driverId: ObjectId('...'),
//     driverName: 'John Doe',
//     status: 'BOOKING_SERVE',
//     checkInTime: Date('2024-01-15 09:00:00'),
//     checkOutTime: Date('2024-01-15 17:30:00'),
//     totalHours: 8.5,
//     leaveType: null
//   },
//   ...
// ]
```

**Returns:** Array of daily attendance records with driver info

### 8. bulkUpdateAttendance()

Updates attendance for multiple drivers in bulk.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  driverIds: mongoose.Types.ObjectId[];
  date: Date;
  status: AttendanceStatus;
  leaveType?: LeaveType;
  notes?: string;
}
```

**Example:**
```typescript
const result = await service.bulkUpdateAttendance(
  new ObjectId('...'),                    // tenantId
  [driverId1, driverId2, driverId3],     // driverIds
  new Date('2024-01-15'),                // date
  'IDLE_AVAILABLE',                      // status
  undefined,                             // leaveType
  'Holiday - office closed'              // notes
);

console.log(result);
// { updated: 3, failed: 0 }
```

**Returns:** Object with `updated` and `failed` counts

### 9. getMissingAttendance()

Identifies drivers with missing attendance records for a date.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  date?: Date;  // Defaults to today
}
```

**Example:**
```typescript
const missing = await service.getMissingAttendance(
  new ObjectId('...'),
  new Date('2024-01-15')
);

console.log(missing);
// [
//   {
//     driverId: ObjectId('...'),
//     driverName: 'Jane Smith',
//     status: 'available',
//     reason: 'Attendance not marked'
//   },
//   ...
// ]
```

**Returns:** Array of drivers with missing attendance

### 10. rebuildAttendanceForDate()

Clears and rebuilds attendance for a specific date (Admin use only).

**WARNING:** This method deletes existing records and rebuilds them.

**Parameters:**
```typescript
{
  tenantId: mongoose.Types.ObjectId;
  date: Date;
}
```

**Example:**
```typescript
const updated = await service.rebuildAttendanceForDate(
  new ObjectId('...'),
  new Date('2024-01-15')
);

console.log(`Rebuilt ${updated} attendance records`);
```

**Returns:** Number of records rebuilt

## Integration with API Routes

### Example: Mark Attendance Endpoint

```typescript
// In routes.ts
router.post('/api/attendance/mark', async (req, res) => {
  try {
    const { tenantId, driverId, status, leaveType, notes } = req.body;

    const attendance = await attendanceAutomationService.autoMarkAttendance({
      tenantId: new ObjectId(tenantId),
      driverId: new ObjectId(driverId),
      status,
      leaveType,
      notes
    });

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});
```

### Example: Process All Drivers Endpoint

```typescript
router.post('/api/attendance/process-all', async (req, res) => {
  try {
    const { tenantId, date } = req.body;

    const result = await attendanceAutomationService.processAllDriversAttendance(
      new ObjectId(tenantId),
      date ? new Date(date) : undefined
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});
```

### Example: Get Daily Report Endpoint

```typescript
router.get('/api/attendance/daily-report/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { date } = req.query;

    const report = await attendanceAutomationService.getDailyAttendanceReport(
      new ObjectId(tenantId),
      date ? new Date(date as string) : undefined
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});
```

## Automation Scenarios

### Scenario 1: Auto-mark based on Booking

```typescript
// When a booking is created/confirmed
const booking = await Booking.findById(bookingId);
if (booking && booking.driverId) {
  await attendanceAutomationService.autoMarkAttendance({
    tenantId: booking.tenantId,
    driverId: booking.driverId,
    date: booking.pickupDate,
    status: 'BOOKING_SERVE',
    bookingId: booking._id as mongoose.Types.ObjectId
  });
}
```

### Scenario 2: Daily Batch Processing

```typescript
// Run daily (e.g., via cron job at midnight)
const tenants = await Tenant.find({ isActive: true });

for (const tenant of tenants) {
  const result = await attendanceAutomationService.processAllDriversAttendance(
    tenant._id as mongoose.Types.ObjectId,
    new Date()
  );
  
  console.log(`[${tenant.name}] Processed: ${result.processed}, Updated: ${result.updated}`);
  
  if (result.errors.length > 0) {
    console.error(`Errors: ${JSON.stringify(result.errors)}`);
  }
}
```

### Scenario 3: Leave Approval Workflow

```typescript
// When leave is approved
const approveLeave = async (leaveRequestId: string) => {
  const leaveRequest = await LeaveRequest.findById(leaveRequestId);
  
  const records = await attendanceAutomationService.markLeave(
    leaveRequest.tenantId,
    leaveRequest.driverId,
    leaveRequest.startDate,
    leaveRequest.endDate,
    leaveRequest.leaveType,
    leaveRequest.reason,
    {
      userId: approver.userId,
      userName: approver.name,
      role: approver.role
    }
  );
  
  await LeaveRequest.updateOne(
    { _id: leaveRequestId },
    { status: 'approved' }
  );
};
```

### Scenario 4: Attendance Report Generation

```typescript
// Generate monthly report
const generateMonthlyReport = async (tenantId: ObjectId, year: number, month: number) => {
  const drivers = await Driver.find({ tenantId, isActive: true });
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const report = {
    month: `${year}-${String(month).padStart(2, '0')}`,
    drivers: []
  };
  
  for (const driver of drivers) {
    const stats = await attendanceAutomationService.getAttendanceStats(
      tenantId,
      driver._id as mongoose.Types.ObjectId,
      startDate,
      endDate
    );
    
    report.drivers.push({
      driverId: driver._id,
      driverName: driver.name,
      ...stats
    });
  }
  
  return report;
};
```

## Database Queries

### Query 1: Get all BOOKING_SERVE records for a tenant

```typescript
const bookingServeRecords = await Attendance.find({
  tenantId: new ObjectId('...'),
  status: 'BOOKING_SERVE'
});
```

### Query 2: Get drivers on leave for a date range

```typescript
const onLeave = await Attendance.find({
  tenantId: new ObjectId('...'),
  status: 'LEAVE',
  date: {
    $gte: startDate,
    $lte: endDate
  }
}).populate('driverId', 'name phone');
```

### Query 3: Get drivers with most hours worked

```typescript
const topPerformers = await Attendance.aggregate([
  { $match: { tenantId: new ObjectId('...') } },
  { $group: {
      _id: '$driverId',
      totalHours: { $sum: '$totalHours' }
    }
  },
  { $sort: { totalHours: -1 } },
  { $limit: 10 }
]);
```

## Performance Considerations

1. **Indexes**: All critical indexes are automatically created
2. **Batch Processing**: Use `bulkUpdateAttendance()` for multiple drivers
3. **Date Normalization**: Dates are normalized to prevent duplicates
4. **Lazy Loading**: Driver/Booking data is only loaded when needed

## Error Handling

```typescript
try {
  const attendance = await service.autoMarkAttendance({
    tenantId,
    driverId,
    status: 'IDLE_AVAILABLE'
  });
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Driver not found')) {
      // Handle missing driver
    } else if (error.message.includes('Tenant not found')) {
      // Handle missing tenant
    } else {
      // Handle other errors
    }
  }
}
```

## Testing

Run the test suite:

```bash
npm test -- AttendanceAutomationService.test.ts
```

The test suite covers:
- Auto-marking attendance
- Manual overrides
- Leave marking
- History retrieval
- Statistics calculation
- Daily reports
- Bulk updates
- Missing attendance detection
- Error handling

## Best Practices

1. **Always validate tenantId and driverId before calling service methods**
2. **Use `autoMarkAttendance()` for automatic state-based marking**
3. **Use `manualOverrideAttendance()` only for special cases**
4. **Run `processAllDriversAttendance()` as a scheduled job daily**
5. **Archive old attendance records after a retention period**
6. **Monitor the `errors` array returned by batch operations**
7. **Use appropriate leave types for accurate reporting**
8. **Normalize dates to prevent duplicate records**

## Future Enhancements

Potential improvements:
- GPS-based check-in/check-out
- Biometric integration
- Mobile app integration
- Attendance approval workflow
- Payroll integration
- Attendance forecasting
- Anomaly detection for suspicious patterns
- Multi-tenant reporting dashboards

## Support & Documentation

For additional help:
- Check existing test cases in `AttendanceAutomationService.test.ts`
- Review integration examples in the `Integration with API Routes` section
- Contact the development team for implementation support
