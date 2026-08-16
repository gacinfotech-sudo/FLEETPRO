# GS Infotech — Production Deployment Guide

**Version:** 1.0  
**Last Updated:** August 16, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Single-Server Deployment](#single-server-deployment)
4. [Kubernetes Cluster Deployment (HA)](#kubernetes-cluster-deployment)
5. [Database Backup Strategy](#database-backup-strategy)
6. [SSL/TLS Certificate Setup](#ssltls-certificate-setup)
7. [Environment Configuration](#environment-configuration)
8. [Security Hardening Checklist](#security-hardening-checklist)
9. [Performance Tuning Guide](#performance-tuning-guide)
10. [Load Testing Procedures](#load-testing-procedures)

---

## System Requirements

### Minimum Hardware Specifications

**Single-Server Deployment:**
- **CPU:** 4 vCPUs (Intel Xeon or equivalent)
- **RAM:** 16 GB minimum (32 GB recommended for production)
- **Storage:** 500 GB SSD (RAID-1 for data redundancy)
- **Network:** 1 Gbps minimum (10 Gbps recommended)
- **Uptime SLA:** 99.5% minimum

**Kubernetes Cluster (HA):**
- **Control Plane Nodes:** 3 nodes (4 vCPU, 8 GB RAM each)
- **Worker Nodes:** 3+ nodes (8 vCPU, 16 GB RAM each)
- **Storage:** 2 TB persistent volume (RAID-6 or cloud redundancy)
- **Network:** 10 Gbps cluster network minimum

### Software Requirements

| Component | Minimum Version | Recommended Version |
|-----------|-----------------|-------------------|
| Node.js | 18.0.0 | 20.x LTS |
| PostgreSQL | 13 | 15+ |
| Redis | 6.0 | 7+ |
| Docker | 20.10 | 24.x |
| Kubernetes | 1.24 | 1.28+ |
| npm | 9.0 | 10.x |

### Operating System

**Supported:**
- Ubuntu 22.04 LTS (recommended)
- Ubuntu 20.04 LTS
- CentOS 8.5+
- RHEL 8.5+
- Debian 11+

**Not Supported:**
- Windows (use WSL2 for development only)
- macOS (development only, not production)

---

## Pre-Deployment Checklist

### Infrastructure Verification

- [ ] **DNS Configuration**
  - [ ] Primary domain resolves to deployment IP
  - [ ] Wildcard subdomain (*.app.yourdomain.com) configured
  - [ ] TTL set to 300 seconds for flexibility during migration
  - [ ] MX records configured for email delivery
  - [ ] SPF/DKIM/DMARC records configured
  
- [ ] **Network Connectivity**
  - [ ] Firewall allows inbound HTTP (80) and HTTPS (443)
  - [ ] Firewall allows outbound HTTPS (443) for external APIs
  - [ ] Firewall rules for database port 5432 (internal only)
  - [ ] Firewall rules for Redis port 6379 (internal only)
  - [ ] Network latency < 100ms to database servers

- [ ] **Load Balancer Configuration**
  - [ ] SSL/TLS termination configured
  - [ ] Health check path set to `/health`
  - [ ] Health check interval: 30s, timeout: 10s, retries: 3
  - [ ] Connection draining: 30 seconds
  - [ ] Session stickiness: enabled (optional for stateless APIs)

### Application Verification

- [ ] **Code Quality**
  - [ ] All tests passing locally: `npm run test`
  - [ ] No linting errors: `npm run lint`
  - [ ] Code review approval (minimum 2 reviewers)
  - [ ] Security scan passed (OWASP Top 10)
  - [ ] Dependency vulnerabilities checked: `npm audit`

- [ ] **Database Validation**
  - [ ] Database backup taken
  - [ ] Schema migrations tested on staging
  - [ ] Data consistency verified (row counts, constraints)
  - [ ] Indexes analyzed for performance
  - [ ] Backup restore tested successfully

- [ ] **Configuration Files**
  - [ ] `.env.production` created (never commit)
  - [ ] All required env vars documented in `.env.example`
  - [ ] Secrets stored in secrets manager (AWS Secrets Manager, Vault)
  - [ ] Database connection pool size tuned for expected load
  - [ ] Redis connection pool configured

- [ ] **Third-Party Integrations**
  - [ ] Razorpay API keys validated (test vs. production)
  - [ ] SendGrid API key working
  - [ ] Twilio credentials verified
  - [ ] Slack webhook URL configured
  - [ ] Payment gateway test transaction successful

### Security Verification

- [ ] **SSL/TLS Certificates**
  - [ ] Certificate valid for all required domains
  - [ ] Certificate installed on load balancer
  - [ ] Certificate expiration date logged in alerts
  - [ ] Certificate chain includes all intermediates

- [ ] **Authentication & Authorization**
  - [ ] JWT secret keys are strong (32+ characters)
  - [ ] JWT expiry times configured (access: 15m, refresh: 7d)
  - [ ] API rate limiting configured (100 req/min per IP)
  - [ ] CORS origin whitelist verified

- [ ] **Data Protection**
  - [ ] Database passwords are strong (16+ characters, mixed case)
  - [ ] API keys rotated monthly
  - [ ] PII encryption enabled (credit card data)
  - [ ] Audit logging enabled on all sensitive operations

---

## Single-Server Deployment

### Prerequisites

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Verify installation
docker --version
docker-compose --version
```

### Deploy Application

```bash
# 1. Clone repository
git clone <repository-url> /opt/gs-infotech
cd /opt/gs-infotech

# 2. Create production environment file
cp .env.example .env.production
# Edit .env.production with production values:
# - Change NODE_ENV=production
# - Set strong JWT_SECRET
# - Set DATABASE_URL for production database
# - Set all API keys (Razorpay, SendGrid, Twilio)
# - Set SLACK_WEBHOOK_URL for alerts

# 3. Build Docker images
docker-compose -f docker-compose.yml build

# 4. Run database migrations
docker-compose run api npm run migrate

# 5. Seed initial data (optional)
docker-compose run api npm run seed

# 6. Start all services
docker-compose -f docker-compose.yml up -d

# 7. Verify services are running
docker-compose ps
# Expected output:
# Container               Status
# gs-infotech-db        Up (healthy)
# gs-infotech-cache     Up (healthy)
# gs-infotech-api       Up (healthy)
# gs-infotech-web       Up (healthy)

# 8. Check logs for errors
docker-compose logs -f api
```

### Post-Deployment Verification

```bash
# 1. Check API health
curl -s http://localhost:3000/health | jq '.'
# Expected: {"status": "ok", "database": "connected", "redis": "connected"}

# 2. Check web application
curl -s http://localhost:5173/

# 3. Check database connectivity
docker-compose exec api npm run db:status

# 4. Test payment gateway (Razorpay)
# Send test request via API to verify keys are working

# 5. Test email delivery
# Send test email via SendGrid API

# 6. Monitor logs for errors
docker-compose logs --tail=100 api
```

### Backup Strategy for Single-Server

```bash
# 1. Daily database backup (add to crontab)
0 2 * * * /opt/gs-infotech/scripts/backup-db.sh

# Create backup script: /opt/gs-infotech/scripts/backup-db.sh
#!/bin/bash
BACKUP_DIR="/opt/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U postgres gs_infotech | \
  gzip > $BACKUP_DIR/gs_infotech_$TIMESTAMP.sql.gz

# Keep last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# 2. Upload to S3 for offsite backup
aws s3 cp $BACKUP_DIR/gs_infotech_$TIMESTAMP.sql.gz \
  s3://gs-infotech-backups/daily/

# 3. Redis backup (point-in-time recovery)
docker-compose exec -T redis redis-cli BGSAVE
docker cp gs-infotech-cache:/data/dump.rdb /opt/backups/redis/$TIMESTAMP.rdb
```

---

## Kubernetes Cluster Deployment

### Prerequisites

```bash
# 1. Create Kubernetes cluster
# Option A: AWS EKS
aws eks create-cluster --name gs-infotech-prod \
  --version 1.28 \
  --roleArn arn:aws:iam::ACCOUNT:role/eks-service-role \
  --resourcesVpcConfig subnetIds=subnet-xxx,subnet-yyy,subnet-zzz

# Option B: GCP GKE
gcloud container clusters create gs-infotech-prod \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4 \
  --enable-autoscaling --min-nodes 3 --max-nodes 10

# 2. Configure kubectl
aws eks update-kubeconfig --name gs-infotech-prod --region us-east-1
# or
gcloud container clusters get-credentials gs-infotech-prod --zone us-central1-a

# 3. Create namespaces
kubectl create namespace gs-infotech
kubectl create namespace gs-infotech-dev

# 4. Install ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.0/deploy/static/provider/aws/deploy.yaml
```

### Deploy via Helm Charts

```bash
# 1. Add Helm repositories
helm repo add gs-infotech https://charts.gs-infotech.io
helm repo update

# 2. Create secrets for API keys
kubectl create secret generic gs-infotech-secrets \
  --from-literal=JWT_SECRET='your-secret-key' \
  --from-literal=RAZORPAY_KEY_ID='key_xxx' \
  --from-literal=RAZORPAY_KEY_SECRET='secret_xxx' \
  -n gs-infotech

# 3. Create ConfigMap for app config
kubectl create configmap gs-infotech-config \
  --from-literal=NODE_ENV=production \
  --from-literal=LOG_LEVEL=info \
  -n gs-infotech

# 4. Deploy PostgreSQL (or use managed AWS RDS)
helm install postgres bitnami/postgresql \
  --set auth.postgresPassword=production-password \
  --set persistence.size=500Gi \
  -n gs-infotech

# 5. Deploy Redis (or use managed AWS ElastiCache)
helm install redis bitnami/redis \
  --set auth.password=production-password \
  --set master.persistence.size=100Gi \
  -n gs-infotech

# 6. Deploy GS Infotech application
helm install gs-infotech ./helm-chart \
  --namespace gs-infotech \
  --values helm-values-prod.yaml

# 7. Verify deployment
kubectl get pods -n gs-infotech
kubectl get svc -n gs-infotech
kubectl get ingress -n gs-infotech
```

### Kubernetes Deployment Configuration

Create `helm-values-prod.yaml`:

```yaml
replicaCount: 3

image:
  repository: gs-infotech/api
  tag: "1.0.0"
  pullPolicy: IfNotPresent

resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1024Mi"
    cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: "api.gs-infotech.com"
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: gs-infotech-tls
      hosts:
        - api.gs-infotech.com

env:
  - name: NODE_ENV
    value: "production"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: gs-infotech-secrets
        key: DATABASE_URL

livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 2
```

### Kubernetes Health Checks & Monitoring

```bash
# 1. Check pod status
kubectl get pods -n gs-infotech -o wide

# 2. View pod logs
kubectl logs -n gs-infotech deployment/gs-infotech-api

# 3. Check service endpoints
kubectl get endpoints -n gs-infotech

# 4. Describe pod for errors
kubectl describe pod POD_NAME -n gs-infotech

# 5. Install metrics server for autoscaling
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 6. Check resource usage
kubectl top nodes
kubectl top pods -n gs-infotech
```

---

## Database Backup Strategy

### PostgreSQL Backup Methods

**Method 1: Logical Backup (SQL Dump)**
```bash
# Full database backup
pg_dump -U postgres -d gs_infotech -F custom -f backup_full.dump

# Restore from backup
pg_restore -U postgres -d gs_infotech_restored backup_full.dump

# Compression
pg_dump -U postgres -d gs_infotech | gzip > backup.sql.gz

# Restore from compressed backup
gunzip -c backup.sql.gz | psql -U postgres -d gs_infotech
```

**Method 2: Physical Backup (WAL Archiving)**
```bash
# Enable WAL archiving in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'

# Backup base directory
tar -czf postgresql_base_backup.tar.gz /var/lib/postgresql/main

# Restore: extract tar and restore from WAL
tar -xzf postgresql_base_backup.tar.gz -C /var/lib/postgresql/main
```

**Method 3: Managed Backup (AWS RDS)**
```bash
# Enable automatic backups
aws rds modify-db-instance --db-instance-identifier gs-infotech-db \
  --backup-retention-period 30 \
  --preferred-backup-window "02:00-03:00"

# Manual snapshot
aws rds create-db-snapshot --db-instance-identifier gs-infotech-db \
  --db-snapshot-identifier gs-infotech-manual-$(date +%Y%m%d)

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier gs-infotech-restored \
  --db-snapshot-identifier gs-infotech-manual-20260816
```

### Backup Schedule

```
Hourly:    Last 24 hours (12 snapshots)
Daily:     Last 30 days (30 backups)
Weekly:    Last 12 weeks (12 backups)
Monthly:   Last 12 months (12 backups, kept indefinitely)
```

### Backup Verification

```bash
#!/bin/bash
# /opt/backups/verify-backup.sh

BACKUP_FILE=$1
DB_NAME="gs_infotech_verify"

# Create test database
createdb $DB_NAME

# Restore backup
pg_restore -d $DB_NAME $BACKUP_FILE

# Verify data integrity
psql -d $DB_NAME -c "SELECT COUNT(*) as total_rows FROM information_schema.tables;"

# Check for errors
if [ $? -eq 0 ]; then
    echo "✓ Backup verification successful"
else
    echo "✗ Backup verification failed"
    exit 1
fi

# Cleanup
dropdb $DB_NAME
```

---

## SSL/TLS Certificate Setup

### Let's Encrypt (Automated, Recommended)

```bash
# 1. Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# 2. Generate certificate
sudo certbot certonly --standalone -d gs-infotech.com -d api.gs-infotech.com

# 3. Configure Nginx
sudo nano /etc/nginx/sites-available/gs-infotech

server {
    listen 443 ssl http2;
    server_name gs-infotech.com api.gs-infotech.com;

    ssl_certificate /etc/letsencrypt/live/gs-infotech.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gs-infotech.com/privkey.pem;
    
    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}

# 4. Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 5. Test renewal
sudo certbot renew --dry-run
```

### Self-Signed Certificate (Development Only)

```bash
# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request
openssl req -new -key server.key -out server.csr

# Self-sign certificate (valid for 365 days)
openssl x509 -req -days 365 -in server.csr \
  -signkey server.key -out server.crt

# Combine for use
cat server.crt server.key > server.pem
```

### Certificate Installation on Load Balancer

**AWS Application Load Balancer:**
```bash
# Upload certificate to ACM
aws acm import-certificate \
  --certificate fileb://Certificate.pem \
  --certificate-chain fileb://CertificateChain.pem \
  --private-key fileb://PrivateKey.pem \
  --region us-east-1

# Add listener with SSL/TLS
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=...
```

**Kubernetes with cert-manager:**
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@gs-infotech.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Certificate is automatically provisioned via Ingress annotation
```

---

## Environment Configuration

### Production Environment Variables

Create `/opt/gs-infotech/.env.production`:

```bash
# ============================================
# APPLICATION CONFIGURATION
# ============================================
NODE_ENV=production
API_HOST=0.0.0.0
API_PORT=3000
LOG_LEVEL=info

# ============================================
# DATABASE CONFIGURATION
# ============================================
DATABASE_URL=postgresql://user:password@postgres.production.internal:5432/gs_infotech
DATABASE_POOL_SIZE=20
DATABASE_STATEMENT_CACHE_SIZE=2000

# ============================================
# CACHE CONFIGURATION
# ============================================
REDIS_URL=redis://redis.production.internal:6379
REDIS_DB=0
REDIS_PASSWORD=production-password
REDIS_POOL_SIZE=10

# ============================================
# AUTHENTICATION
# ============================================
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-characters-long
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ============================================
# PAYMENT GATEWAY (Razorpay)
# ============================================
RAZORPAY_KEY_ID=rzp_prod_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# ============================================
# EMAIL SERVICE (SendGrid)
# ============================================
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@gs-infotech.com
SENDGRID_FROM_NAME=GS Infotech

# ============================================
# SMS SERVICE (Twilio)
# ============================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# ============================================
# FILE STORAGE
# ============================================
STORAGE_TYPE=s3
STORAGE_BUCKET=gs-infotech-assets
STORAGE_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# ============================================
# MONITORING & LOGGING
# ============================================
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
LOG_FORMAT=json

# ============================================
# FEATURE FLAGS
# ============================================
FEATURE_WHITE_LABEL=true
FEATURE_SMS_INTEGRATION=true
FEATURE_EMAIL_INTEGRATION=true
FEATURE_PAYMENT_GATEWAY=true

# ============================================
# SECURITY
# ============================================
CORS_ORIGIN=https://app.gs-infotech.com,https://gs-infotech.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuration Validation

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/validate-config.sh

required_vars=(
    "NODE_ENV"
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "RAZORPAY_KEY_ID"
    "RAZORPAY_KEY_SECRET"
    "SENDGRID_API_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

echo "✓ All required environment variables are configured"

# Test database connection
psql -h $DATABASE_HOST -U $DATABASE_USER -d gs_infotech -c "SELECT 1" > /dev/null
if [ $? -eq 0 ]; then
    echo "✓ Database connection successful"
else
    echo "ERROR: Cannot connect to database"
    exit 1
fi

# Test Redis connection
redis-cli -h $REDIS_HOST ping
if [ $? -eq 0 ]; then
    echo "✓ Redis connection successful"
else
    echo "ERROR: Cannot connect to Redis"
    exit 1
fi
```

---

## Security Hardening Checklist

### Operating System Security

- [ ] **Firewall Configuration**
  ```bash
  # Enable UFW firewall
  sudo ufw enable
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw deny incoming
  sudo ufw allow outgoing
  ```

- [ ] **SSH Hardening**
  ```bash
  # Disable root login
  sed -i 's/^#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
  
  # Disable password authentication
  sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
  
  # Change default SSH port (optional)
  sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
  
  sudo systemctl restart sshd
  ```

- [ ] **Fail2ban Installation**
  ```bash
  sudo apt install fail2ban -y
  sudo systemctl enable fail2ban
  sudo systemctl start fail2ban
  
  # Configure for SSH
  cat > /etc/fail2ban/jail.local <<EOF
  [sshd]
  enabled = true
  port = ssh
  logpath = /var/log/auth.log
  maxretry = 5
  EOF
  ```

- [ ] **System Updates**
  ```bash
  # Enable automatic security updates
  sudo apt install unattended-upgrades -y
  sudo systemctl enable unattended-upgrades
  ```

### Application Security

- [ ] **Input Validation**
  - All user inputs validated server-side (never trust client)
  - SQL injection prevention via parameterized queries
  - XSS prevention via output encoding

- [ ] **Authentication & Authorization**
  - JWT tokens signed with strong algorithm (HS256+)
  - Access token TTL: 15 minutes
  - Refresh token TTL: 7 days
  - RBAC enforced at API boundary

- [ ] **API Security**
  ```bash
  # Rate limiting middleware
  app.use(rateLimit({
    windowMs: 60000,      // 1 minute
    max: 100,             // 100 requests per window
    message: 'Too many requests',
    standardHeaders: true
  }));
  
  # CORS configuration
  app.use(cors({
    origin: ['https://app.gs-infotech.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  # Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }));
  ```

### Data Protection

- [ ] **Encryption at Rest**
  ```bash
  # Enable PostgreSQL encryption
  # (Use AWS RDS with encryption enabled at creation time)
  
  # Enable Redis encryption
  # In redis.conf: requirepass <strong-password>
  ```

- [ ] **Encryption in Transit**
  - All external API calls via HTTPS
  - Database connections use SSL/TLS
  - Redis connections use TLS (if exposed)

- [ ] **Secrets Management**
  ```bash
  # Using AWS Secrets Manager
  aws secretsmanager create-secret \
    --name gs-infotech/jwt-secret \
    --secret-string 'your-secret-key'
  
  # Application retrieves at startup:
  const secret = await secretsManager.getSecretValue({
    SecretId: 'gs-infotech/jwt-secret'
  });
  ```

- [ ] **PII Protection**
  - Credit card numbers encrypted with encryption-at-rest
  - Database queries for PII logged with access audit trail
  - PII fields masked in logs and monitoring dashboards

### Audit & Compliance

- [ ] **Audit Logging**
  ```bash
  # All sensitive operations logged:
  # - Login/logout
  # - API key creation/rotation
  # - Data modifications
  # - Access to PII
  # - Administrative actions
  
  # Log retention: 90 days minimum, 1 year recommended
  # Log format: JSON for easy parsing
  # Logs sent to centralized logging (CloudWatch, ELK)
  ```

- [ ] **Vulnerability Scanning**
  ```bash
  # Weekly dependency vulnerability scan
  npm audit --audit-level=moderate
  
  # Monthly penetration testing
  # Annual security audit by third party
  ```

---

## Performance Tuning Guide

### Database Optimization

**PostgreSQL Configuration:**
```bash
# In /etc/postgresql/15/main/postgresql.conf

# Memory configuration (for 32GB RAM server)
shared_buffers = 8GB                    # 25% of RAM
effective_cache_size = 24GB             # 75% of RAM
maintenance_work_mem = 2GB              # 1/4 of RAM
work_mem = 51200kB                      # shared_buffers / 200

# Connection pooling
max_connections = 200
superuser_reserved_connections = 10

# Query optimization
random_page_cost = 1.1                  # SSD tuning
effective_io_concurrency = 200

# Logging for monitoring
log_min_duration_statement = 1000        # Log queries > 1s
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_connections = on
log_disconnections = on

# Apply changes
sudo systemctl restart postgresql
```

**Query Performance Tuning:**
```sql
-- Enable query plan analysis
EXPLAIN ANALYZE SELECT * FROM assets WHERE tenant_id = 'xxx';

-- Create indexes for frequently queried columns
CREATE INDEX idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_movements_asset_id ON asset_movements(asset_id);

-- Analyze table statistics
ANALYZE assets;

-- Monitor slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Redis Optimization

```bash
# In /etc/redis/redis.conf

# Memory management
maxmemory 4GB
maxmemory-policy allkeys-lru

# Persistence tuning
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Client handling
timeout 0
tcp-keepalive 300

# Monitoring
slowlog-log-slower-than 10000
slowlog-max-len 128
```

### Node.js Optimization

```javascript
// app.js configuration

// Connection pooling
const pool = new Pool({
  max: 20,                          // Maximum pool size
  idleTimeoutMillis: 30000,         // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
});

// Redis connection pooling
const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: null,       // For queue operations
  enableReadyCheck: false,
  enableOfflineQueue: false,
});

// Cluster mode (for horizontal scaling)
cluster.fork();

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
  });
}, 60000);
```

### Load Balancer Tuning

**Nginx Configuration:**
```nginx
# Upstream configuration
upstream gs_infotech_api {
    least_conn;                              # Load balancing algorithm
    server api1.internal:3000 weight=10;
    server api2.internal:3000 weight=10;
    server api3.internal:3000 weight=5;      # Lower weight for older hardware
    keepalive 32;
}

server {
    listen 443 ssl http2;
    
    # Compression
    gzip on;
    gzip_types text/plain application/json;
    gzip_min_length 1000;
    
    # Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy
    location /api {
        proxy_pass http://gs_infotech_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### CDN Integration

```bash
# CloudFront configuration
aws cloudfront create-distribution \
  --origin-domain-name app.gs-infotech.com \
  --default-root-object index.html \
  --cache-behaviors '{
    "Items": [{
      "PathPattern": "*.js",
      "ViewerProtocolPolicy": "https-only",
      "Compress": true,
      "DefaultTTL": 86400,
      "MaxTTL": 31536000
    }]
  }'

# Invalidate cache when deploying
aws cloudfront create-invalidation \
  --distribution-id E123ABCD \
  --paths "/*"
```

---

## Load Testing Procedures

### Pre-Load Testing Checklist

- [ ] Staging environment mirrors production exactly
- [ ] Database with 80% production data volume
- [ ] All third-party integrations available (Razorpay, SendGrid)
- [ ] Monitoring dashboards configured and accessible
- [ ] Runbook for incident response reviewed

### Load Testing with Apache JMeter

```bash
# 1. Install JMeter
wget https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.zip
unzip apache-jmeter-5.6.3.zip
cd apache-jmeter-5.6.3

# 2. Create test plan (test-plan.jmx)
# - Add Thread Group: 1000 users, ramp-up 300s, loop 5 times
# - Add HTTP Request Sampler
#   - Method: POST
#   - URL: https://api.staging.gs-infotech.com/login
#   - Body: {"email": "user@test.com", "password": "xxx"}
# - Add Response Assertions
# - Add View Results Tree listener
# - Add Aggregate Report listener

# 3. Run load test
./bin/jmeter -n -t test-plan.jmx -l results.jtl -j jmeter.log

# 4. Generate report
./bin/jmeter -g results.jtl -o report/

# Expected metrics:
# - Response time p95: < 500ms
# - Response time p99: < 1000ms
# - Error rate: < 0.1%
# - Throughput: > 5000 req/s
```

### Load Testing with k6

```javascript
// load-test.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = 'https://api.staging.gs-infotech.com';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Spike to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
  },
};

export default function() {
  group('Login', () => {
    let loginRes = http.post(`${BASE_URL}/login`, {
      email: `user${__VU}@test.com`,
      password: 'password123',
    });
    
    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    let token = loginRes.json('token');
    
    group('Get Assets', () => {
      let res = http.get(`${BASE_URL}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(res, {
        'status 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
      });
    });
  });
  
  sleep(1);
}
```

Run k6 test:
```bash
k6 run load-test.js --out csv=results.csv
```

### Performance Baseline Targets

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| API Response Time (p50) | 100ms | < 150ms |
| API Response Time (p95) | 300ms | < 500ms |
| API Response Time (p99) | 500ms | < 1000ms |
| Error Rate | < 0.01% | < 0.1% |
| Throughput (req/s) | 5000+ | 3000+ |
| Database Query Time (p95) | 50ms | < 100ms |
| Cache Hit Rate | > 95% | > 90% |
| CPU Utilization | 40-60% | < 80% |
| Memory Utilization | 60-70% | < 85% |

### Post-Load Testing

```bash
# 1. Analyze results
k6 summary results.csv

# 2. Review logs for errors
docker-compose logs api | grep -i error

# 3. Check database performance
psql -d gs_infotech -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 4. Review monitoring dashboard
# - Check CPU/memory/network graphs
# - Look for anomalies during peak load

# 5. Document findings
cat > load-test-report.md <<EOF
# Load Test Report — 2026-08-16

## Test Configuration
- Duration: 16 minutes
- Peak Users: 200
- Total Requests: 50,000

## Results
- Average Response Time: 234ms
- p95 Response Time: 412ms
- p99 Response Time: 787ms
- Error Rate: 0.02%
- Throughput: 5,200 req/s

## Recommendations
- Database indices are adequate
- Cache hit rate excellent (98%)
- Consider adding 2 more API nodes for 300+ concurrent users
EOF
```

---

## Deployment Runbook Summary

### Pre-Deployment (1 week before)

```bash
# Week 1: Preparation
- [ ] Backup production database
- [ ] Test backup restore procedure
- [ ] Review and test all migrations
- [ ] Load test on staging environment
- [ ] Obtain SSL/TLS certificates
- [ ] Create disaster recovery playbook
- [ ] Schedule deployment window (low-traffic time)
- [ ] Notify stakeholders of deployment time
```

### Deployment Day (Morning, before go-live)

```bash
# 1. Final Backup
docker-compose exec postgres pg_dump -U postgres gs_infotech > backup_pre_deploy.sql

# 2. Deploy to Staging
docker pull gs-infotech/api:1.0.0
docker pull gs-infotech/web:1.0.0

# 3. Run migrations on staging
docker-compose run api npm run migrate

# 4. Smoke tests
npm run test:integration

# 5. Production deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml ps

# 6. Verify production
curl -s https://api.gs-infotech.com/health | jq '.'
curl -s https://app.gs-infotech.com/

# 7. Monitor for errors (30 minutes)
docker-compose logs -f api
```

### Post-Deployment (First 24 hours)

```bash
# 1. Monitor critical metrics
- CPU: 20-40% (normal startup)
- Memory: < 70%
- Error rate: < 0.1%
- Response times: < 500ms p95

# 2. Check logs for errors
grep "ERROR" logs/api.log
grep "CRITICAL" logs/api.log

# 3. Run smoke tests
npm run test:integration

# 4. Verify data integrity
psql -d gs_infotech -c "SELECT COUNT(*) FROM assets;"

# 5. Check payment gateway
# Send $0.50 test transaction via Razorpay

# 6. Check email delivery
# Send test email via SendGrid

# 7. Performance metrics
# - Monitor response times
# - Check database slow query log
# - Review error logs
```

---

**Document Version:** 1.0  
**Last Reviewed:** August 16, 2026  
**Next Review:** November 16, 2026 (Quarterly)  
**Owner:** DevOps Team  
**Approver:** CTO
