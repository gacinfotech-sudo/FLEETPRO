import mongoose from 'mongoose';

interface DocumentationArtifact {
  title: string;
  content: string;
  version: string;
  lastUpdated: Date;
  sections?: string[];
}

export class FinalDocumentationService {
  private artifacts: Map<string, DocumentationArtifact> = new Map();

  /**
   * Generate Architecture Overview
   */
  generateArchitectureOverview(): DocumentationArtifact {
    const content = `
# System Architecture Overview

## High-Level Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Client Layer (React)                 │
│  Dashboard │ Reports │ Contracts │ Assets │ Payments    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   API Gateway (Express)                 │
│  Route Processing │ Authentication │ Rate Limiting      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Business Logic Services (TypeScript)        │
│  Payment │ Asset │ Contract │ Audit │ Analytics │ RBAC  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Data Access Layer (Mongoose)               │
│  Query Building │ Validation │ Schema Management        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Database Layer (MongoDB)                   │
│  Collections │ Indexes │ Replication │ Backup          │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Service Architecture

### 1. Authentication Service
- JWT-based authentication
- Session management
- Password hashing with bcrypt
- Multi-factor authentication support

### 2. Payment Service
- Payment processing (multiple payment methods)
- Invoice generation and tracking
- Refund management
- Payment status monitoring

### 3. Asset Management Service
- Asset CRUD operations
- Depreciation calculation
- Lifecycle tracking
- Asset reporting

### 4. Contract Management Service
- Contract creation and versioning
- Approval workflows
- Milestone tracking
- Payment scheduling

### 5. Analytics Service
- Dashboard metrics calculation
- Report generation
- Data aggregation
- Forecasting

### 6. Audit Service
- Action logging
- Change tracking
- Compliance reporting
- Data retrieval

### 7. RBAC Service
- Role definition and management
- Permission assignment
- Access control enforcement
- Role hierarchy

### 8. Notification Service
- Email notifications
- SMS notifications
- In-app notifications
- Notification scheduling

## Data Flow

\`\`\`
User Request
    ↓
Express Middleware (Auth, Validation)
    ↓
Route Handler
    ↓
Service Layer (Business Logic)
    ↓
Database Query (Mongoose)
    ↓
MongoDB
    ↓
Response (JSON)
    ↓
Client Application
\`\`\`

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Backend**: Express, TypeScript, Mongoose, Node.js
- **Database**: MongoDB
- **Authentication**: JWT, bcrypt
- **Validation**: Zod
- **File Upload**: Multer
- **API Documentation**: Auto-generated from code

## Deployment Architecture

- **Web Server**: Node.js/Express on port 5000
- **Database**: MongoDB Atlas (cloud) or self-hosted
- **Environment**: Development, Staging, Production
- **Monitoring**: Application logs, database metrics
- **Backup**: Daily automated backups
    `;

    const artifact: DocumentationArtifact = {
      title: 'System Architecture Overview',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'High-Level Architecture',
        'Service Architecture',
        'Data Flow',
        'Technology Stack',
        'Deployment Architecture',
      ],
    };

    this.artifacts.set('architecture', artifact);
    return artifact;
  }

  /**
   * Generate API Reference
   */
  generateAPIReference(): DocumentationArtifact {
    const content = `
# API Reference

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "user_id",
  "email": "user@example.com",
  "token": "jwt_token"
}
\`\`\`

### POST /auth/login
Authenticate user and return JWT token.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "token": "jwt_token",
  "user": { "id": "user_id", "email": "user@example.com" }
}
\`\`\`

## Payment Endpoints

### POST /payments
Create a new payment record.

**Request:**
\`\`\`json
{
  "amount": 1000,
  "currency": "USD",
  "method": "credit_card",
  "contractId": "contract_id"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "payment_id",
  "amount": 1000,
  "status": "completed",
  "timestamp": "2026-08-16T10:00:00Z"
}
\`\`\`

### GET /payments/:id
Get payment details.

**Response:**
\`\`\`json
{
  "id": "payment_id",
  "amount": 1000,
  "status": "completed",
  "method": "credit_card",
  "createdAt": "2026-08-16T10:00:00Z"
}
\`\`\`

## Asset Endpoints

### POST /assets
Create a new asset.

**Request:**
\`\`\`json
{
  "name": "Vehicle ABC-123",
  "type": "vehicle",
  "purchasePrice": 100000,
  "purchaseDate": "2026-01-01"
}
\`\`\`

### GET /assets
List all assets with pagination.

**Query Parameters:**
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10)
- \`status\`: Filter by status (active, retired)

## Contract Endpoints

### POST /contracts
Create a new contract.

**Request:**
\`\`\`json
{
  "type": "lease",
  "totalAmount": 100000,
  "startDate": "2026-08-01",
  "endDate": "2026-12-31"
}
\`\`\`

### PUT /contracts/:id/approve
Approve a contract.

**Request:**
\`\`\`json
{
  "approvedBy": "user_id"
}
\`\`\`

## Error Responses

### 400 Bad Request
\`\`\`json
{
  "error": "Validation failed",
  "details": { "email": "Invalid email format" }
}
\`\`\`

### 401 Unauthorized
\`\`\`json
{
  "error": "Authentication required"
}
\`\`\`

### 403 Forbidden
\`\`\`json
{
  "error": "Insufficient permissions"
}
\`\`\`

### 500 Server Error
\`\`\`json
{
  "error": "Internal server error",
  "requestId": "req_id"
}
\`\`\`

## Rate Limiting

All endpoints are rate-limited to 100 requests per 15 minutes per IP address.

Headers returned:
- \`X-RateLimit-Limit\`: 100
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Reset time (Unix timestamp)

## Authentication

Include JWT token in Authorization header:

\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

## Response Format

All responses are JSON. Standard response wrapper:

\`\`\`json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2026-08-16T10:00:00Z"
}
\`\`\`
    `;

    const artifact: DocumentationArtifact = {
      title: 'API Reference',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Authentication Endpoints',
        'Payment Endpoints',
        'Asset Endpoints',
        'Contract Endpoints',
        'Error Responses',
        'Rate Limiting',
        'Authentication',
        'Response Format',
      ],
    };

    this.artifacts.set('api-reference', artifact);
    return artifact;
  }

  /**
   * Generate Database Schema Documentation
   */
  generateDatabaseSchema(): DocumentationArtifact {
    const content = `
# Database Schema Documentation

## Collections Overview

### Users Collection
\`\`\`
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  firstName: String,
  lastName: String,
  role: String (admin, manager, user, viewer),
  tenantId: ObjectId,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

**Indexes:**
- \`{ email: 1 }\` (unique)
- \`{ tenantId: 1, isActive: 1 }\`
- \`{ createdAt: -1 }\`

### Payments Collection
\`\`\`
{
  _id: ObjectId,
  tenantId: ObjectId,
  amount: Number,
  currency: String,
  method: String (credit_card, bank_transfer, check),
  status: String (pending, completed, failed, refunded),
  contractId: ObjectId,
  invoice: ObjectId,
  processedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

**Indexes:**
- \`{ tenantId: 1, status: 1 }\`
- \`{ contractId: 1 }\`
- \`{ createdAt: -1 }\`

### Assets Collection
\`\`\`
{
  _id: ObjectId,
  tenantId: ObjectId,
  name: String,
  type: String (vehicle, equipment, property),
  purchasePrice: Number,
  purchaseDate: Date,
  currentValue: Number,
  status: String (active, retired),
  depreciation: {
    method: String (straight_line, declining_balance),
    rate: Number,
    bookValue: Number
  },
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

**Indexes:**
- \`{ tenantId: 1, type: 1, status: 1 }\`
- \`{ purchaseDate: -1 }\`

### Contracts Collection
\`\`\`
{
  _id: ObjectId,
  tenantId: ObjectId,
  type: String (lease, purchase, service),
  totalAmount: Number,
  status: String (draft, approved, active, completed, cancelled),
  startDate: Date,
  endDate: Date,
  approvals: [{
    approvedBy: ObjectId,
    approvalDate: Date
  }],
  milestones: [{
    sequence: Number,
    amount: Number,
    dueDate: Date,
    status: String
  }],
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

**Indexes:**
- \`{ tenantId: 1, status: 1 }\`
- \`{ startDate: 1, endDate: 1 }\`

### Audit Logs Collection
\`\`\`
{
  _id: ObjectId,
  tenantId: ObjectId,
  userId: ObjectId,
  action: String,
  resourceType: String,
  resourceId: ObjectId,
  before: Object,
  after: Object,
  changes: [{
    field: String,
    oldValue: Any,
    newValue: Any
  }],
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}
\`\`\`

**Indexes:**
- \`{ tenantId: 1, timestamp: -1 }\`
- \`{ userId: 1, timestamp: -1 }\`
- \`{ resourceType: 1, resourceId: 1 }\`

## Relationships

\`\`\`
Users
  ├─ Contracts (1:N)
  ├─ Payments (1:N)
  └─ Audit Logs (1:N)

Contracts
  ├─ Payments (1:N via milestone)
  └─ Assets (1:N)

Assets
  └─ Audit Logs (1:N)
\`\`\`

## Tenant Isolation Strategy

All collections have a \`tenantId\` field that enables multi-tenant isolation:
- All queries include tenant filter: \`{ tenantId: currentTenantId, ... }\`
- Cross-tenant queries are prevented at application level
- Database-level row security policies enforce isolation
    `;

    const artifact: DocumentationArtifact = {
      title: 'Database Schema Documentation',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Collections Overview',
        'Relationships',
        'Tenant Isolation Strategy',
      ],
    };

    this.artifacts.set('database-schema', artifact);
    return artifact;
  }

  /**
   * Generate Deployment Checklist
   */
  generateDeploymentChecklist(): DocumentationArtifact {
    const content = `
# Deployment Checklist

## Pre-Deployment

- [ ] All tests passing locally
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance baseline met
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Dependencies up to date
- [ ] Documentation updated
- [ ] Breaking changes documented

## Infrastructure Setup

- [ ] MongoDB cluster configured
- [ ] Database backups enabled
- [ ] SSL/TLS certificates installed
- [ ] Load balancer configured
- [ ] CDN configured (if applicable)
- [ ] Email service configured
- [ ] Logging infrastructure ready
- [ ] Monitoring alerts configured
- [ ] Auto-scaling policies set

## Application Deployment

- [ ] Build production bundle
- [ ] Run final security scan
- [ ] Set production environment variables
- [ ] Configure database connection string
- [ ] Deploy to production server
- [ ] Run database migrations
- [ ] Seed initial data (if needed)
- [ ] Verify all services running
- [ ] Run smoke tests in production

## Post-Deployment

- [ ] Monitor error logs
- [ ] Check application metrics
- [ ] Verify all features working
- [ ] Test user flows end-to-end
- [ ] Verify email notifications
- [ ] Check database performance
- [ ] Review audit logs
- [ ] Notify stakeholders
- [ ] Create incident response procedures

## Rollback Procedure

If issues occur:

1. Stop traffic to new version
2. Route traffic back to stable version
3. Investigate issue
4. Document root cause
5. Fix and retest
6. Deploy fix with reduced traffic initially
7. Monitor closely
8. Gradually increase traffic

## Post-Deployment Validation

Run these checks:

\`\`\`bash
# Check server health
curl https://api.example.com/health

# Verify database connectivity
curl https://api.example.com/api/health/database

# Test authentication
curl -X POST https://api.example.com/auth/login

# Run smoke tests
npm run test:smoke
\`\`\`

## Monitoring Setup

- Application logs: /var/log/app.log
- Error tracking: Sentry
- Performance monitoring: New Relic
- Uptime monitoring: StatusPage.io
- Database monitoring: MongoDB Atlas Console

## Communication

- [ ] Notify DevOps team
- [ ] Update status page
- [ ] Notify key stakeholders
- [ ] Document in change log
- [ ] Schedule post-deployment review
    `;

    const artifact: DocumentationArtifact = {
      title: 'Deployment Checklist',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Pre-Deployment',
        'Infrastructure Setup',
        'Application Deployment',
        'Post-Deployment',
        'Rollback Procedure',
        'Post-Deployment Validation',
        'Monitoring Setup',
        'Communication',
      ],
    };

    this.artifacts.set('deployment-checklist', artifact);
    return artifact;
  }

  /**
   * Generate Security Checklist
   */
  generateSecurityChecklist(): DocumentationArtifact {
    const content = `
# Security Checklist

## Code Security

- [ ] No hardcoded secrets in code
- [ ] All dependencies scanned for vulnerabilities
- [ ] SQL injection prevention verified
- [ ] XSS protection implemented
- [ ] CSRF tokens on all state-changing endpoints
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't expose sensitive info
- [ ] Security headers configured (Helmet.js)

## Authentication & Authorization

- [ ] JWT tokens properly signed and verified
- [ ] Password requirements enforced (min 12 chars)
- [ ] Passwords hashed with bcrypt (salt rounds: 12)
- [ ] Session tokens have expiration
- [ ] MFA implemented for admin accounts
- [ ] RBAC properly enforced
- [ ] Permission checks on all protected endpoints
- [ ] No privilege escalation vulnerabilities

## Data Protection

- [ ] HTTPS/TLS enabled
- [ ] Sensitive data encrypted at rest
- [ ] Sensitive data masked in logs
- [ ] Database connection encrypted
- [ ] API keys stored in environment variables
- [ ] PII data handled according to regulations
- [ ] Data retention policies implemented
- [ ] Secure data deletion procedures

## Network Security

- [ ] Firewall rules configured
- [ ] Only necessary ports open
- [ ] Rate limiting enabled
- [ ] DDoS protection configured
- [ ] VPN for database access
- [ ] API endpoints protected by authentication
- [ ] CORS properly configured
- [ ] Proxy headers validated

## Monitoring & Logging

- [ ] Security event logging enabled
- [ ] Audit logs retained (minimum 1 year)
- [ ] Failed login attempts logged
- [ ] Permission changes logged
- [ ] Sensitive data access logged
- [ ] Alerts configured for suspicious activity
- [ ] Log tamper protection enabled
- [ ] Logs sent to centralized system

## Database Security

- [ ] Database credentials secured
- [ ] Database user has minimal permissions
- [ ] Backup encryption enabled
- [ ] Regular backups tested
- [ ] Database transaction logging enabled
- [ ] Connection pooling configured
- [ ] SQL injection prevention verified
- [ ] Database audit logging enabled

## Infrastructure Security

- [ ] OS security patches applied
- [ ] Antivirus/malware scanning enabled
- [ ] File integrity monitoring
- [ ] Physical security implemented
- [ ] Access control to servers
- [ ] SSH key-based auth (no passwords)
- [ ] Sudo access restricted
- [ ] Regular security updates scheduled

## Compliance & Policies

- [ ] Privacy policy published
- [ ] Terms of service documented
- [ ] Data processing agreements in place
- [ ] GDPR compliance verified
- [ ] Data breach notification plan
- [ ] Security incident response plan
- [ ] Penetration testing scheduled
- [ ] Compliance audit completed

## Third-Party & Dependencies

- [ ] Third-party services vetted
- [ ] SLAs in place
- [ ] API keys rotated regularly
- [ ] Dependencies regularly updated
- [ ] Security vulnerabilities tracked (npm audit)
- [ ] License compliance verified
- [ ] Third-party data handling policies reviewed
    `;

    const artifact: DocumentationArtifact = {
      title: 'Security Checklist',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Code Security',
        'Authentication & Authorization',
        'Data Protection',
        'Network Security',
        'Monitoring & Logging',
        'Database Security',
        'Infrastructure Security',
        'Compliance & Policies',
        'Third-Party & Dependencies',
      ],
    };

    this.artifacts.set('security-checklist', artifact);
    return artifact;
  }

  /**
   * Generate Performance Optimization Tips
   */
  generatePerformanceGuide(): DocumentationArtifact {
    const content = `
# Performance Optimization Guide

## Database Optimization

### Indexing Strategy
- Create indexes on frequently queried fields
- Use compound indexes for multi-field queries
- Monitor index usage and remove unused indexes
- Analyze query execution plans

### Query Optimization
- Use projection to fetch only needed fields
- Implement pagination for large result sets
- Use aggregation pipeline for complex queries
- Cache frequently accessed data

### Example Optimized Query
\`\`\`typescript
// Good: Project only needed fields
db.users.find({ tenantId: ID }, { email: 1, firstName: 1, role: 1 })

// Bad: Fetch all fields
db.users.find({ tenantId: ID })
\`\`\`

## Caching Strategy

### In-Memory Caching
- Cache frequently accessed data (users, roles)
- Use TTL to invalidate stale data
- Implement cache warming on startup
- Monitor cache hit rates

### Redis Configuration
- Set appropriate memory limits
- Configure eviction policies
- Enable persistence for critical cache
- Monitor redis memory usage

## API Performance

### Request Optimization
- Compress responses with gzip
- Implement request deduplication
- Use HTTP caching headers
- Batch multiple requests where possible

### Response Optimization
- Return only necessary fields
- Implement GraphQL to avoid over-fetching
- Use pagination to limit response size
- Compress large payloads

## Frontend Performance

### Bundle Size Optimization
- Code splitting for lazy loading
- Tree shaking to remove unused code
- Minify CSS and JavaScript
- Monitor bundle size on each build

### Runtime Performance
- Implement virtual scrolling for large lists
- Use memo for expensive component re-renders
- Debounce user input handlers
- Lazy load images

## Monitoring & Metrics

### Key Metrics to Track
- API response time (P50, P95, P99)
- Database query execution time
- Memory usage
- CPU usage
- Error rates
- Cache hit rates

### Performance Baselines
- Page load time: < 2 seconds
- API response time: < 500ms (P95)
- Database query time: < 100ms
- Cache hit rate: > 80%

### Tools
- New Relic for APM
- DataDog for infrastructure monitoring
- Lighthouse for frontend performance
- MongoDB performance profiler

## Common Performance Issues & Solutions

### Issue: Slow Database Queries
**Solution:**
- Add appropriate indexes
- Analyze query plans
- Consider query denormalization
- Implement caching layer

### Issue: High Memory Usage
**Solution:**
- Review memory allocation settings
- Implement stream processing for large datasets
- Clear old logs and cache
- Monitor memory leaks

### Issue: Slow Frontend Performance
**Solution:**
- Reduce bundle size
- Implement lazy loading
- Use CDN for static assets
- Optimize images

### Issue: High CPU Usage
**Solution:**
- Profile CPU-intensive operations
- Consider horizontal scaling
- Implement background job processing
- Optimize algorithms
    `;

    const artifact: DocumentationArtifact = {
      title: 'Performance Optimization Guide',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Database Optimization',
        'Caching Strategy',
        'API Performance',
        'Frontend Performance',
        'Monitoring & Metrics',
        'Common Performance Issues & Solutions',
      ],
    };

    this.artifacts.set('performance-guide', artifact);
    return artifact;
  }

  /**
   * Generate Monitoring Setup Guide
   */
  generateMonitoringGuide(): DocumentationArtifact {
    const content = `
# Monitoring Setup Guide

## Application Monitoring

### Error Tracking
- Sentry for error aggregation
- Slack notifications for critical errors
- Daily error reports
- Error trend analysis

### Performance Monitoring
- New Relic APM for application performance
- Trace slow transactions
- Alert on response time degradation
- Custom metrics for business logic

### Logs
- Centralized logging (ELK stack or Datadog)
- Log retention: 30 days hot, 1 year cold
- Structured logging in JSON format
- Log levels: debug, info, warn, error

## Infrastructure Monitoring

### System Metrics
- CPU usage (alert if > 80%)
- Memory usage (alert if > 85%)
- Disk usage (alert if > 90%)
- Network throughput
- Process count

### Container/VM Metrics
- Container restart count
- Process health status
- File descriptor usage
- Thread count

## Database Monitoring

### MongoDB Metrics
- Query execution time
- Slow query log (> 100ms)
- Replication lag
- Disk usage per collection
- Index efficiency
- Connection pool usage

### Database Health
- Backup success/failure
- Replication status
- Storage alerts
- Connection limit monitoring

## Uptime & Availability

### Health Checks
\`\`\`
GET /health - returns 200 if healthy
GET /health/deep - checks DB connection
\`\`\`

### Monitoring
- Uptime monitoring via external service
- Page load time tracking
- API endpoint availability
- Feature flag health

## Alerting Strategy

### Critical Alerts (page immediately)
- Application crash
- Database unavailable
- Authentication service down
- Payment processing failure

### High Priority Alerts (within 1 hour)
- High error rate (> 5%)
- Response time degradation
- Database replication lag > 30s
- CPU usage > 85%

### Medium Priority Alerts (within 4 hours)
- Disk usage > 80%
- Memory usage > 75%
- Slow queries detected
- Low cache hit rate

### Low Priority Alerts (daily digest)
- Unusual traffic patterns
- Deprecated API usage
- Security warnings
- License expiration alerts

## Dashboard Setup

### Operations Dashboard
- System health overview
- Current error rate
- Active users
- Database performance
- API response times

### Business Dashboard
- Key business metrics
- Payment processing stats
- Asset utilization
- Contract status overview

### Security Dashboard
- Failed login attempts
- Suspicious activity
- Data access patterns
- Permission changes

## Incident Response

### On-Call Rotation
- Defined escalation path
- Clear incident procedures
- Post-incident reviews
- Knowledge base for common issues

### Runbooks
- How to restart application
- How to failover database
- How to rollback deployment
- How to handle DDoS attack
- How to restore from backup

## Metrics Collection

### Application Metrics
\`\`\`typescript
// Record payment processing time
metrics.timer('payment.process', duration);

// Record error
metrics.increment('error.count', { type: 'payment_failed' });

// Record gauge
metrics.gauge('active.users', userCount);
\`\`\`

## Alert Notifications

- Email to ops team
- Slack notifications
- PagerDuty integration
- SMS for critical alerts
    `;

    const artifact: DocumentationArtifact = {
      title: 'Monitoring Setup Guide',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Application Monitoring',
        'Infrastructure Monitoring',
        'Database Monitoring',
        'Uptime & Availability',
        'Alerting Strategy',
        'Dashboard Setup',
        'Incident Response',
        'Metrics Collection',
        'Alert Notifications',
      ],
    };

    this.artifacts.set('monitoring-guide', artifact);
    return artifact;
  }

  /**
   * Generate Troubleshooting Index
   */
  generateTroubleshootingGuide(): DocumentationArtifact {
    const content = `
# Troubleshooting Guide

## Common Issues & Solutions

### Issue: Server won't start
**Error:** "Error: Cannot connect to MongoDB"

**Solution:**
1. Verify MongoDB is running: \`mongosh\`
2. Check connection string in .env file
3. Verify network connectivity to database
4. Check MongoDB authentication credentials
5. Review server logs for detailed error

\`\`\`bash
# Start MongoDB locally
brew services start mongodb-community

# Or Docker
docker run -d -p 27017:27017 mongo
\`\`\`

### Issue: Payment processing fails
**Error:** "Payment gateway timeout"

**Solution:**
1. Check payment service logs: \`tail -f .server.log\`
2. Verify payment gateway API key is correct
3. Check network connectivity to payment provider
4. Review payment service rate limits
5. Retry payment with exponential backoff

### Issue: High memory usage
**Error:** "Memory usage at 95%"

**Solution:**
1. Check for memory leaks: \`npm run analyze:memory\`
2. Review event listener counts
3. Check cache size and TTL settings
4. Implement memory limit in Docker
5. Consider horizontal scaling

### Issue: Slow database queries
**Error:** "Query taking > 1 second"

**Solution:**
1. Analyze query execution plan: \`db.collection.explain('executionStats')\`
2. Add missing indexes: \`db.collection.createIndex(...)\`
3. Check current indexes: \`db.collection.getIndexes()\`
4. Review query filter conditions
5. Consider query optimization or denormalization

### Issue: Authentication fails
**Error:** "Invalid token" or "Unauthorized"

**Solution:**
1. Check JWT secret in .env file
2. Verify token expiration time
3. Clear browser cookies and retry
4. Check authentication middleware is applied
5. Review user role and permissions

### Issue: File upload fails
**Error:** "ENOENT: no such file or directory"

**Solution:**
1. Verify upload directory exists: \`ls -la uploads/\`
2. Check directory permissions: \`chmod 755 uploads/\`
3. Verify disk space: \`df -h\`
4. Check multer configuration
5. Review file size limits

### Issue: Email notifications not sent
**Error:** "Failed to send email"

**Solution:**
1. Verify email service credentials in .env
2. Check email service health: \`telnet smtp.service.com 587\`
3. Review email queue: \`db.emailQueue.find().limit(10)\`
4. Check spam folder
5. Review email service logs

### Issue: CORS errors
**Error:** "Access to XMLHttpRequest blocked by CORS"

**Solution:**
1. Verify CORS configuration in Express
2. Check allowed origins in .env
3. Verify credentials flag in frontend
4. Add wildcard domain if needed (dev only!)
5. Review browser console for specific error

### Issue: Rate limiting blocking requests
**Error:** "429 Too Many Requests"

**Solution:**
1. Check current rate limit configuration
2. Increase limit if necessary: \`const limit = rateLimit({ windowMs: 15*60*1000, max: 200 })\`
3. Implement per-user rate limits
4. Use cache to reduce requests
5. Batch multiple requests

### Issue: Database connection pool exhausted
**Error:** "No connection available in pool"

**Solution:**
1. Check connection pool size: \`process.env.DB_POOL_SIZE\`
2. Verify long-running queries
3. Implement connection timeout
4. Monitor active connections: \`db.serverStatus().connections\`
5. Consider increasing pool size

## Debugging Techniques

### Enable Debug Logging
\`\`\`bash
DEBUG=* npm run dev
\`\`\`

### Check Application Logs
\`\`\`bash
tail -f .server.log
grep ERROR .server.log
\`\`\`

### Monitor Database Queries
\`\`\`bash
# In MongoDB shell
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().pretty().limit(5)
\`\`\`

### Profiling with Node Inspector
\`\`\`bash
node --inspect server/index.ts
# Then open chrome://inspect
\`\`\`

## Performance Troubleshooting

### High CPU Usage
\`\`\`bash
# Profile CPU
node --prof server/index.ts
node --prof-process isolate-*.log > cpu-profile.txt
\`\`\`

### Memory Leaks
\`\`\`bash
# Take heap dump
node --inspect server/index.ts
# Open chrome://inspect and take heap snapshot
\`\`\`

### Slow API Responses
1. Add request timing middleware
2. Profile database queries
3. Check network latency
4. Review middleware stack order

## Recovery Procedures

### Database Recovery
\`\`\`bash
# Restore from backup
mongorestore --archive=backup.archive
\`\`\`

### Clear Cache
\`\`\`bash
# Redis
redis-cli FLUSHALL

# Or in code
cache.clear()
\`\`\`

### Reset User Sessions
\`\`\`bash
db.sessions.deleteMany({})
\`\`\`

## Support Contact

For issues not resolved by this guide:
1. Check application logs
2. Search GitHub issues
3. Contact support team
4. Create detailed bug report with steps to reproduce
    `;

    const artifact: DocumentationArtifact = {
      title: 'Troubleshooting Guide',
      content,
      version: '7.0.0',
      lastUpdated: new Date(),
      sections: [
        'Common Issues & Solutions',
        'Debugging Techniques',
        'Performance Troubleshooting',
        'Recovery Procedures',
        'Support Contact',
      ],
    };

    this.artifacts.set('troubleshooting-guide', artifact);
    return artifact;
  }

  /**
   * Get all documentation artifacts
   */
  getAllArtifacts(): Map<string, DocumentationArtifact> {
    return this.artifacts;
  }

  /**
   * Export documentation as markdown files
   */
  exportAllDocumentation(): Record<string, string> {
    const exports: Record<string, string> = {};

    for (const [key, artifact] of this.artifacts) {
      exports[`${key}.md`] = artifact.content;
    }

    return exports;
  }
}

export default new FinalDocumentationService();
