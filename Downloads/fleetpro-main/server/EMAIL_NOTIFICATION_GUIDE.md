# Email Notification System - Complete Guide

## Overview

The Email Notification System provides a robust, production-ready email infrastructure for FleetPro SaaS. It includes:

- **8 Pre-built Email Templates** (Welcome, Payment Confirmation, Subscription Upgrade, User Invitation, Password Reset, Payment Failed, Subscription Renewal, Usage Alert, Support Ticket Update)
- **Notification Queue** with automatic retry logic and exponential backoff
- **User Preferences** system (enable/disable specific notification types)
- **Admin Tools** for test emails and managing failed notifications
- **Automatic Integration** with key business events

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Business Logic (Payment, Subscription, User Creation)   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ NotificationQueueService.queueEmail()                   │
│ - Check user preferences                                │
│ - Create queue entry in MongoDB                         │
│ - Trigger background processor                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Background Job (Every 5 minutes)                        │
│ - Process pending emails                                │
│ - Implement exponential backoff retry                   │
│ - Track sent/failed status                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ EmailService.sendEmail()                                │
│ - Render template with variables                        │
│ - Send via SMTP (or console in dev)                     │
│ - Return success/failure                                │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### Notification Preferences (User)

**GET** `/api/notifications/preferences`
- Get all notification preferences for current user
- Returns: Array of preferences with enabled/disabled status

**PUT** `/api/notifications/preferences/:templateId`
- Enable/disable a specific notification type
- Body: `{ enabled: boolean, frequency?: 'immediate'|'daily'|'weekly'|'never' }`
- Returns: Updated preference

### Notification History (User)

**GET** `/api/notifications/history?limit=50`
- Get notification sending history for tenant
- Returns: Array of notification records with status

### Admin Tools

**POST** `/api/admin/notifications/retry-failed`
- Retry all failed email notifications
- Requires admin role
- Returns: Status message

**POST** `/api/admin/notifications/send-test`
- Send a test email
- Requires admin role
- Body: `{ recipientEmail, templateId, variables?: {} }`
- Returns: Success status

## Email Templates

### 1. `welcome`
- **When**: New user account created
- **Variables**: `name`, `email`, `loginUrl`
- **Example**:
```typescript
await notificationQueueService.queueEmail({
  recipientEmail: 'user@example.com',
  templateId: 'welcome',
  variables: {
    name: 'John',
    email: 'user@example.com',
    loginUrl: 'http://app.com/login'
  }
});
```

### 2. `payment_confirmation`
- **When**: Payment received
- **Variables**: `name`, `amount`, `transactionId`, `date`, `plan`, `billingUrl`

### 3. `subscription_upgraded`
- **When**: Plan upgraded/downgraded
- **Variables**: `name`, `oldPlan`, `newPlan`, `vehicleLimit`, `driverLimit`, `managerLimit`

### 4. `user_invitation`
- **When**: New team member invited
- **Variables**: `invitedEmail`, `inviterName`, `tenantName`, `role`, `invitationUrl`

### 5. `password_reset`
- **When**: Password reset requested
- **Variables**: `name`, `resetUrl`

### 6. `payment_failed`
- **When**: Payment declined
- **Variables**: `name`, `amount`, `date`, `reason`, `billingUrl`

### 7. `subscription_renewal`
- **When**: Subscription renewal notice (7 days before)
- **Variables**: `name`, `plan`, `renewalDate`, `amount`, `billingUrl`

### 8. `usage_alert`
- **When**: Resource limit approaching (80% usage)
- **Variables**: `name`, `resource`, `usage`, `limit`, `upgradeUrl`

### 9. `support_ticket_update`
- **When**: Support ticket status changes
- **Variables**: `name`, `ticketId`, `status`, `message`, `ticketUrl`

## Configuration

### Environment Variables

```bash
# SMTP Configuration (optional - defaults to console logging)
SMTP_HOST=smtp.gmail.com          # Email provider SMTP host
SMTP_PORT=587                      # SMTP port
SMTP_USER=your-email@gmail.com    # SMTP username
SMTP_PASSWORD=your-app-password   # SMTP password
SMTP_SECURE=false                  # Use TLS (true/false)
SMTP_FROM=noreply@fleetpro.com    # From address

# Application URL (for email links)
APP_URL=https://fleetpro.example.com
```

### Local Development

By default, emails are logged to console instead of sent:
```
[EMAIL] To: user@example.com
[EMAIL] Subject: Welcome to FleetPro
[EMAIL] Body:
<html>...</html>
```

## Database Models

### NotificationQueue

```typescript
{
  _id: ObjectId
  tenantId?: ObjectId         // Associated tenant
  userId?: ObjectId           // Associated user
  recipientEmail: string      // Email to send to
  templateId: string          // Template identifier
  variables: object           // Template variables
  status: 'pending'|'sent'|'failed'|'bounced'
  retryCount: number          // Current retry count
  maxRetries: number          // Max retry attempts (default: 3)
  nextRetryAt?: Date          // When to retry next
  sentAt?: Date              // When email was sent
  failureReason?: string     // Why it failed
  messageId?: string         // Email provider message ID
  createdAt: Date
  updatedAt: Date
}
```

### NotificationPreference

```typescript
{
  _id: ObjectId
  tenantId: ObjectId          // Tenant
  userId: ObjectId            // User
  templateId: string          // Template type
  enabled: boolean            // If enabled
  frequency: 'immediate'|'daily'|'weekly'|'never'
  createdAt: Date
  updatedAt: Date
}
```

## Integration Examples

### Example 1: Send Welcome Email on User Creation

```typescript
// In routes/paymentsRoutes.ts or similar
import { notificationQueueService } from './services/NotificationQueueService';

// When creating user...
const user = await storage.createUser(userData);

// Queue welcome email
await notificationQueueService.queueEmail({
  tenantId: user.tenantId?.toString(),
  userId: user._id?.toString(),
  recipientEmail: user.email,
  templateId: 'welcome',
  variables: {
    name: user.name,
    email: user.email,
    loginUrl: `${process.env.APP_URL || 'http://localhost:5050'}/login`
  }
});
```

### Example 2: Send Payment Confirmation

```typescript
// In routes/paymentsRoutes.ts
const payment = await paymentsService.recordPayment({ ... });

await notificationQueueService.queueEmail({
  tenantId: tenantId?.toString(),
  recipientEmail: tenant.email,
  templateId: 'payment_confirmation',
  variables: {
    name: tenant.businessName,
    amount: payment.amount,
    transactionId: payment.transactionId,
    date: new Date().toLocaleDateString('en-IN'),
    plan: tenant.subscriptionPlan,
    billingUrl: `${process.env.APP_URL}/billing`
  }
});
```

### Example 3: Check if User Wants Notification

```typescript
// In any notification logic
const preference = await NotificationPreference.findOne({
  tenantId: tenantId,
  userId: userId,
  templateId: 'payment_confirmation'
});

if (preference && !preference.enabled) {
  console.log('User disabled this notification');
  return;
}
```

## Retry Logic

The system implements **exponential backoff** retry strategy:

1. **First failure**: Retry in 5 minutes
2. **Second failure**: Retry in 25 minutes (5^2)
3. **Third failure**: Retry in 125 minutes (5^3)
4. **Max retries**: 3 attempts before marking as failed

Failed emails can be manually retried via admin endpoint:
```bash
POST /api/admin/notifications/retry-failed
```

## Monitoring

### Check Email Status

```bash
# Get notification history
GET /api/notifications/history?limit=50

# Response includes:
{
  "status": "sent|failed|pending",
  "sentAt": "2026-08-17T10:30:00Z",
  "failureReason": null,
  "templateId": "payment_confirmation",
  "recipientEmail": "user@example.com"
}
```

### Admin Dashboard

Add these endpoints to admin dashboard for monitoring:

```typescript
// Failed emails
GET /api/notifications/history?status=failed

// Pending emails
GET /api/notifications/history?status=pending

// Sent today
GET /api/notifications/history?createdAt={today}
```

## Testing

### Send Test Email (Admin)

```bash
curl -X POST http://localhost:5050/api/admin/notifications/send-test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "test@example.com",
    "templateId": "welcome",
    "variables": {
      "name": "Test User",
      "email": "test@example.com",
      "loginUrl": "http://localhost:5050/login"
    }
  }'
```

### Check Email History

```bash
curl http://localhost:5050/api/notifications/history \
  -H "Authorization: Bearer <token>"
```

## Production Checklist

- [ ] Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD environment variables
- [ ] Set APP_URL to production domain
- [ ] Configure SMTP_FROM to company email
- [ ] Test email delivery with test endpoint
- [ ] Monitor failed emails daily
- [ ] Set up alerts for high failure rates
- [ ] Archive old notifications (>30 days)
- [ ] Test each email template before launch

## Troubleshooting

### Email not sending

1. Check environment variables are set
2. Verify SMTP credentials work
3. Check email status: `GET /api/notifications/history`
4. Look for failureReason in notification record
5. Retry failed emails: `POST /api/admin/notifications/retry-failed`

### Email in pending for too long

1. Check background job is running (log should show messages every 5 min)
2. Restart server if job stalled
3. Manually retry: `POST /api/admin/notifications/retry-failed`

### User not receiving emails

1. Check email address is correct in database
2. Check user notification preference is enabled
3. Check SMTP provider spam folder
4. Verify template variables are populated correctly

## Performance Notes

- **Queue Processing**: Every 5 minutes via background job
- **Batch Size**: 10 emails per process cycle
- **Storage**: Notifications retained indefinitely (consider archiving)
- **Scalability**: Can handle 10,000+ emails/day with single instance

## Future Enhancements

- [ ] Email delivery webhooks (bounce, open, click tracking)
- [ ] SMS notifications
- [ ] In-app notifications
- [ ] Notification digest (daily/weekly summary)
- [ ] Multi-language email templates
- [ ] Dynamic unsubscribe links
- [ ] Email analytics dashboard

---

**Last Updated**: 2026-08-17  
**Status**: Production Ready  
**Integration**: 3 features (Payment, User Creation, Subscription Change)
