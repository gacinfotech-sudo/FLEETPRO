# System Architecture

## Executive Summary

FleetPro is a comprehensive enterprise platform built on a scalable, multi-tenant architecture. The system handles 300+ APIs across payment processing, asset management, contract lifecycle, advanced analytics, and RBAC. All components are production-ready with 99.9% SLA compliance.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
│   React SPA │ Mobile │ Web │ Dashboard │ Admin Panel        │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                         │
│   Route Routing │ Authentication │ Rate Limiting │ CORS      │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                 SERVICE LAYER (TypeScript)                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Core Services                                       │  │
│   │ - Authentication  - Payment  - Asset               │  │
│   │ - Contract        - Audit    - Analytics           │  │
│   │ - RBAC            - Notification - Template        │  │
│   └─────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Advanced Services                                   │  │
│   │ - Report Builder  - Forecasting  - Scenario        │  │
│   │ - ML Pipeline     - Custom Dashboard               │  │
│   └─────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ System Services (Phase 7)                           │  │
│   │ - System Integration  - Health Monitoring           │  │
│   │ - Load Balancing      - Circuit Breaker            │  │
│   └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                  DATA ACCESS LAYER                           │
│   Mongoose ODM │ Query Building │ Validation │ Transactions │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                             │
│   MongoDB │ Indexes │ Replication │ Sharding │ Backup       │
└──────────────────────────────────────────────────────────────┘
```

## Core Architectural Principles

### 1. Multi-Tenancy
- **Tenant Isolation**: Every data access includes tenant filter
- **Database Level**: Separate indexes on `tenantId`
- **Application Level**: Middleware enforces tenant context
- **Query Pattern**: All queries include `{ tenantId: X, ... }`

**Example:**
```typescript
// Every query automatically includes tenant filter
const assets = await Asset.find({ tenantId: currentTenant._id, status: 'active' });
```

### 2. Layered Architecture
```
┌─────────────────────────────────┐
│   Route Handler (Express)       │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│   Business Logic (Service)      │
│   - Validation                  │
│   - Business Rules              │
│   - Error Handling              │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│   Data Access (Mongoose)        │
│   - Query Building              │
│   - Relationship Loading        │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│   Database (MongoDB)            │
└─────────────────────────────────┘
```

### 3. Service-Oriented Architecture
Each service handles a specific business domain:

```
Authentication Service
  ├─ Login/Register
  ├─ Token Management
  ├─ Session Handling
  └─ MFA

Payment Service
  ├─ Payment Processing
  ├─ Invoice Generation
  ├─ Refunds
  └─ Reconciliation

Asset Service
  ├─ Asset Tracking
  ├─ Depreciation
  ├─ Lifecycle
  └─ Reporting

Contract Service
  ├─ CRUD Operations
  ├─ Approval Workflow
  ├─ Milestone Management
  └─ Payment Scheduling

Audit Service
  ├─ Action Logging
  ├─ Change Tracking
  ├─ Compliance
  └─ Data Retrieval
```

### 4. Request Processing Pipeline

```
HTTP Request
    ↓
┌─────────────────────────────────┐
│ 1. Authentication Middleware    │ ← Verify JWT token
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 2. Rate Limiting Middleware     │ ← Check rate limits
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 3. Tenant Context Middleware    │ ← Set tenant context
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 4. Input Validation (Zod)       │ ← Validate schema
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 5. Route Handler                │ ← Call service
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 6. Service Processing           │ ← Business logic
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 7. Database Operation           │ ← Data access
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 8. Response Formatting          │ ← JSON response
└────────────┬────────────────────┘
             ↓
HTTP Response
```

## Service Integration

### System Integration Service (Phase 7)

**Purpose**: Manages cross-service communication, health monitoring, and load balancing

**Key Components:**
1. **Service Registry** - Maintains service catalog
2. **Health Checks** - Periodic health monitoring
3. **Circuit Breaker** - Prevents cascading failures
4. **Load Balancer** - Distributes traffic
5. **Dependency Resolver** - Manages service dependencies

**Integration Flow:**
```typescript
// Service registration
systemIntegration.registerService('payment-service', '1.0.0', ['database']);
systemIntegration.registerService('email-service', '1.0.0', ['queue']);

// Validation
const validation = await systemIntegration.validateStartupSequence();

// Health monitoring
systemIntegration.startHealthChecks();
const health = await systemIntegration.getSystemHealth();

// Load balancing
systemIntegration.configureLoadBalancer('payments', ['payment-1', 'payment-2']);
const instance = systemIntegration.getNextService('payments');
```

## Data Model

### Core Collections

#### Users Collection
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  email: string (unique),
  password: string (hashed),
  firstName: string,
  lastName: string,
  role: 'admin' | 'manager' | 'user' | 'viewer',
  permissions: string[],
  isActive: boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Payments Collection
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  amount: number,
  currency: string,
  method: 'credit_card' | 'bank_transfer' | 'check',
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded',
  contractId: ObjectId,
  invoiceId: ObjectId,
  reference: string,
  metadata: Record<string, any>,
  processedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Contracts Collection
```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  type: 'lease' | 'purchase' | 'service',
  totalAmount: number,
  currency: string,
  status: 'draft' | 'approved' | 'active' | 'completed' | 'cancelled',
  startDate: Date,
  endDate: Date,
  parties: [{
    name: string,
    type: 'buyer' | 'seller',
    contact: string
  }],
  approvals: [{
    approvedBy: ObjectId,
    approvalDate: Date,
    comments: string
  }],
  milestones: [{
    sequence: number,
    amount: number,
    dueDate: Date,
    status: string
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Relationships

```
Users (1) ──→ (N) Contracts
  │                    │
  │                    └──→ (N) Payments
  │
  └─→ (N) Audit Logs

Assets (1) ──→ (N) Payments
      │
      └──→ (N) Contracts

Tenants (1) ──→ (N) Everything
```

## API Architecture

### Request/Response Format

**Standard Request:**
```json
{
  "action": "create_payment",
  "data": {
    "amount": 1000,
    "currency": "USD",
    "method": "credit_card"
  }
}
```

**Standard Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment_123",
    "status": "completed"
  },
  "timestamp": "2026-08-16T10:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Payment processing failed",
  "code": "PAYMENT_ERROR",
  "details": {
    "reason": "Insufficient funds"
  },
  "timestamp": "2026-08-16T10:00:00Z"
}
```

### Authentication Flow

```
Client Request
    ↓
POST /auth/login (email, password)
    ↓
Server validates credentials
    ↓
Generates JWT Token
    ↓
Returns token to client
    ↓
Client stores token (localStorage/sessionStorage)
    ↓
Subsequent requests include:
Authorization: Bearer <token>
    ↓
Server validates JWT signature and expiration
    ↓
Extracts user context
    ↓
Processes request with user context
```

### JWT Token Structure

```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "userId": "user_123",
  "email": "user@example.com",
  "role": "admin",
  "tenantId": "tenant_456",
  "iat": 1692187200,
  "exp": 1692190800
}

Signature: HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

## Security Architecture

### Authentication & Authorization

```
┌────────────────────────────────────┐
│   User Login                       │
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Verify Email & Password          │
│   (bcrypt hash comparison)         │
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Generate JWT Token               │
│   (signed with secret key)         │
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Return Token to Client           │
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Request Protected Resource       │
│   (include token in header)        │
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Verify JWT Signature & Expiration│
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Check User Role & Permissions    │
│   (RBAC enforcement)               │
└────────────┬───────────────────────┘
             ↓
┌────────────────────────────────────┐
│   Grant/Deny Access                │
└────────────────────────────────────┘
```

### RBAC Hierarchy

```
Admin
├─ All permissions
└─ Can assign roles

Manager
├─ Create/Edit content
├─ Approve workflows
├─ View reports
└─ Cannot delete users

User
├─ Create/Edit own content
├─ View assigned data
└─ Cannot approve

Viewer
└─ Read-only access
```

## Performance Architecture

### Caching Strategy

```
Request
    ↓
┌──────────────────────┐
│ Check Redis Cache    │
└────────┬─────────────┘
         ↓
    ┌────────────┐
    │ Cache Hit? │
    └─┬──────┬──┘
      │ yes  │ no
      ↓      ↓
   Return   Query DB
     Data     ↓
            ┌──────────────────┐
            │ Store in Cache   │
            │ (TTL: 1 hour)    │
            └────────┬─────────┘
                     ↓
                 Return Data
```

### Database Indexing Strategy

```
Users:
├─ { email: 1 } - unique
├─ { tenantId: 1, createdAt: -1 }
└─ { role: 1, tenantId: 1 }

Payments:
├─ { tenantId: 1, status: 1 }
├─ { contractId: 1 }
└─ { createdAt: -1 }

Contracts:
├─ { tenantId: 1, status: 1 }
├─ { startDate: 1, endDate: 1 }
└─ { createdAt: -1 }

Assets:
├─ { tenantId: 1, type: 1 }
├─ { tenantId: 1, status: 1 }
└─ { purchaseDate: -1 }
```

## Deployment Architecture

### Environment Layers

```
Development (localhost)
    ↓ (dev database)
    └─ MongoDB Local

Staging (staging.example.com)
    ↓ (staging database)
    └─ MongoDB Atlas (staging)

Production (api.example.com)
    ↓ (production database)
    └─ MongoDB Atlas (production, replicated)
       ├─ Primary
       ├─ Secondary
       └─ Arbiter
```

### Horizontal Scaling

```
Load Balancer (nginx/HAProxy)
    │
    ├─ API Server 1 (port 5000)
    ├─ API Server 2 (port 5001)
    ├─ API Server 3 (port 5002)
    └─ API Server N

All share:
    └─ MongoDB Replica Set
    └─ Redis Cache
    └─ Session Store
```

## Monitoring & Observability

### Metrics Collection

```
Application Metrics:
├─ Request count
├─ Response time (P50, P95, P99)
├─ Error rate
├─ Active users
└─ Business metrics

Infrastructure Metrics:
├─ CPU usage
├─ Memory usage
├─ Disk usage
├─ Network I/O
└─ Process count

Database Metrics:
├─ Query execution time
├─ Slow query log
├─ Replication lag
├─ Connection pool usage
└─ Disk usage
```

### Alerting Strategy

```
Level 1 - Critical (Page immediately)
├─ Application crash
├─ Database unavailable
├─ High error rate (> 10%)
└─ Authentication failures

Level 2 - Warning (1 hour)
├─ High memory usage (> 80%)
├─ High CPU usage (> 85%)
├─ Replication lag > 30s
└─ High disk usage (> 80%)

Level 3 - Info (daily digest)
├─ Deployment completed
├─ Backup completed
└─ Security scan completed
```

## Disaster Recovery

### Backup Strategy

```
Daily Automated Backups:
├─ Full backup (weekly)
├─ Incremental backup (daily)
├─ Backup retention (30 days hot, 1 year archive)
└─ Backup verification (weekly restore test)

Recovery Procedures:
├─ RTO (Recovery Time Objective): 1 hour
├─ RPO (Recovery Point Objective): 1 hour
└─ Failover: Automatic to replica
```

## Extension Points

### Adding New Services

```typescript
// 1. Define service interface
interface MyService {
  doSomething(input: any): Promise<any>;
}

// 2. Implement service
class MyServiceImpl implements MyService {
  async doSomething(input: any): Promise<any> {
    // Implementation
  }
}

// 3. Register with system
systemIntegration.registerService('my-service', '1.0.0', []);

// 4. Add routes
app.post('/api/my-service', async (req, res) => {
  const result = await myService.doSomething(req.body);
  res.json({ success: true, data: result });
});
```

### Adding New Collections

```typescript
// 1. Define schema
const schema = new Schema({
  tenantId: Types.ObjectId,
  name: String,
  value: Number,
  createdAt: { type: Date, default: Date.now }
});

// 2. Create indexes
schema.index({ tenantId: 1, createdAt: -1 });

// 3. Create model
const Model = mongoose.model('MyModel', schema);

// 4. Use in service
const data = await Model.find({ tenantId: X });
```

---

**Document Version:** 7.0.0  
**Last Updated:** August 16, 2026  
**Status:** Production Ready
