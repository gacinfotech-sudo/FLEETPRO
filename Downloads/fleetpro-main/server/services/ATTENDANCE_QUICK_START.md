# AttendanceAutomationService - Quick Start Guide

## 5-Minute Setup

### 1. Import the Service
```typescript
import { attendanceAutomationService } from '../services/AttendanceAutomationService';
```

### 2. Mark Attendance
```typescript
const attendance = await attendanceAutomationService.autoMarkAttendance({
  tenantId: new ObjectId('tenant-id'),
  driverId: new ObjectId('driver-id'),
  status: 'IDLE_AVAILABLE',
  checkInTime: new Date('2024-01-15 09:00:00'),
  checkOutTime: new Date('2024-01-15 17:00:00'),
  notes: 'Regular working day'
});

console.log(`Driver marked as: ${attendance.status}`);
console.log(`Hours worked: ${attendance.totalHours}`);
```

## Common Tasks

### Task 1: Mark Driver as Serving Booking
```typescript
// When driver picks up customer
const booking = await Booking.findById(bookingId);

await attendanceAutomationService.autoMarkAttendance({
  tenantId: booking.tenantId,
  driverId: booking.driverId,
  date: booking.pickupDate,
  status: 'BOOKING_SERVE',
  bookingId: booking._id,
  notes: `Serving booking ${booking.bookingId}`
});
```

### Task 2: Process All Drivers for a Day
```typescript
// Batch process all drivers (ideal for cron job)
const result = await attendanceAutomationService.processAllDriversAttendance(
  tenantId,
  new Date('2024-01-15')
);

console.log(`Processed: ${result.processed} drivers`);
console.log(`Updated: ${result.updated} records`);
if (result.errors.length > 0) {
  console.error(`Errors: ${result.errors.length}`);
}
```

### Task 3: Mark Leave (Sick/Casual)
```typescript
// Single day leave
await attendanceAutomationService.markLeave(
  tenantId,
  driverId,
  new Date('2024-01-15'),
  new Date('2024-01-15'),
  'sick',
  'Fever and cold - medical certificate attached'
);

// Multiple days leave
await attendanceAutomationService.markLeave(
  tenantId,
  driverId,
  new Date('2024-01-15'),
  new Date('2024-01-17'),  // 3 days
  'casual',
  'Casual leave for personal reasons'
);
```

### Task 4: Manual Override by Manager
```typescript
// Admin/Manager manually marking attendance
await attendanceAutomationService.manualOverrideAttendance({
  tenantId,
  driverId,
  status: 'LEAVE',
  leaveType: 'emergency',
  notes: 'Family emergency - approved',
  markedBy: {
    userId: 'mgr123',
    userName: 'John Manager',
    role: 'manager'
  }
});
```

### Task 5: Get Driver Statistics
```typescript
// Monthly statistics for a driver
const stats = await attendanceAutomationService.getAttendanceStats(
  tenantId,
  driverId,
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

console.log(`January Report for Driver:`);
console.log(`- Total Days: ${stats.totalDays}`);
console.log(`- Present Days: ${stats.presentDays}`);
console.log(`- Leave Days: ${stats.leaveDays}`);
console.log(`- Booking Days: ${stats.bookingDays}`);
console.log(`- Absent Days: ${stats.absentDays}`);
console.log(`- Avg Hours/Day: ${stats.avgHoursPerDay}`);
```

### Task 6: Daily Attendance Report
```typescript
// Get all drivers' attendance for today
const report = await attendanceAutomationService.getDailyAttendanceReport(
  tenantId,
  new Date('2024-01-15')
);

report.forEach(record => {
  console.log(`${record.driverName}: ${record.status}`);
});
```

### Task 7: Find Missing Attendance
```typescript
// Identify drivers without attendance marked
const missing = await attendanceAutomationService.getMissingAttendance(
  tenantId,
  new Date('2024-01-15')
);

missing.forEach(driver => {
  console.log(`Missing: ${driver.driverName} (${driver.driverId})`);
});
```

### Task 8: Bulk Update Attendance
```typescript
// Update multiple drivers at once (e.g., holiday)
const driverIds = [driverId1, driverId2, driverId3];

const result = await attendanceAutomationService.bulkUpdateAttendance(
  tenantId,
  driverIds,
  new Date('2024-01-26'),  // Republic Day
  'LEAVE',
  undefined,
  'Republic Day Holiday'
);

console.log(`Updated: ${result.updated}, Failed: ${result.failed}`);
```

### Task 9: Get Attendance History
```typescript
// Get last 30 days for a driver
const today = new Date();
const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

const history = await attendanceAutomationService.getAttendanceHistory(
  tenantId,
  driverId,
  thirtyDaysAgo,
  today
);

history.forEach(record => {
  console.log(`${record.date.toDateString()}: ${record.status}`);
});
```

## Attendance Status Reference

```
BOOKING_SERVE  → Driver is actively serving a booking
IDLE_AVAILABLE → Driver is available with no booking
LEAVE          → Driver is on approved leave
ABSENT         → Driver is absent (no marking + no leave)
MANUAL_OVERRIDE→ Admin/manager manually marked
```

## Leave Types

```
sick      → Sick leave
casual    → Casual leave
earned    → Earned/privileged leave
unpaid    → Unpaid leave
emergency → Emergency leave
```

## Common Errors & Solutions

### Error: "Driver not found"
**Solution**: Verify driverId is correct and driver exists in database
```typescript
const driver = await Driver.findById(driverId);
if (!driver) throw new Error('Driver not found');
```

## Testing Your Integration

```typescript
// Test marking attendance
const test = async () => {
  const tenantId = new ObjectId('test-tenant');
  const driverId = new ObjectId('test-driver');

  try {
    // Test 1: Auto-mark
    const att1 = await attendanceAutomationService.autoMarkAttendance({
      tenantId,
      driverId,
      status: 'IDLE_AVAILABLE'
    });
    console.log('✓ Auto-mark works');

    // Test 2: Statistics
    const stats = await attendanceAutomationService.getAttendanceStats(
      tenantId,
      driverId,
      new Date('2024-01-01'),
      new Date('2024-01-31')
    );
    console.log('✓ Statistics works');

    // Test 3: Report
    const report = await attendanceAutomationService.getDailyAttendanceReport(
      tenantId
    );
    console.log('✓ Report generation works');

    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
};

test();
```

## Performance Tips

1. **Use processAllDriversAttendance() for batch operations** - Much faster than looping
2. **Process daily via cron** - Don't process on-demand for all drivers
3. **Use indexes** - All queries use indexes automatically
4. **Archive old records** - Delete records older than 1-2 years
5. **Use bulk operations** - Better than individual updates

## Documentation Links

- **Full API Guide**: `ATTENDANCE_AUTOMATION_GUIDE.md`
- **Test Cases**: `AttendanceAutomationService.test.ts`
- **Source Code**: `AttendanceAutomationService.ts`

Happy coding!
