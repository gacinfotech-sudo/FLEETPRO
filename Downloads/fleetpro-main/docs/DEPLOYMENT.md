# Deployment Guide

## Table of Contents
1. [Local Development](#local-development)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Post-Deployment](#post-deployment)
5. [Monitoring](#monitoring)
6. [Rollback](#rollback)

## Local Development

### Prerequisites
- Node.js v18+
- npm v9+
- MongoDB v5+
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/yourorg/fleetpro.git
cd fleetpro

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure .env for local development
# MONGODB_URI=mongodb://localhost:27017/fleetpro
# JWT_SECRET=your_local_secret
# NODE_ENV=development
```

### Running Locally

```bash
# Start MongoDB (if using Docker)
docker run -d -p 27017:27017 mongo

# Start development server
npm run dev

# Server runs on http://localhost:5000

# In another terminal, run tests
npm test
```

### Database Setup

```bash
# Connect to MongoDB
mongosh

# Create database
use fleetpro

# Create collections
db.createCollection('users')
db.createCollection('payments')
db.createCollection('contracts')
db.createCollection('assets')

# Create indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ tenantId: 1 })
db.payments.createIndex({ tenantId: 1, status: 1 })
db.contracts.createIndex({ tenantId: 1, status: 1 })

# Seed initial data
npm run db:seed
```

## Staging Deployment

### Prerequisites
- AWS account (or cloud provider)
- Domain configured
- SSL certificate obtained
- MongoDB Atlas account

### Infrastructure Setup

#### 1. Database

```bash
# Create MongoDB Atlas cluster
# - Cluster name: fleetpro-staging
# - Instance: M10 (shared)
# - Region: us-east-1
# - Backup: enabled
# - Monitoring: enabled

# Create database user
# username: fleetpro_staging
# password: [secure password]

# Whitelist IP ranges
# Add your deployment server IP
```

#### 2. Web Server

```bash
# Option A: AWS EC2
# - Instance type: t3.medium
# - AMI: Ubuntu 22.04 LTS
# - Storage: 20GB EBS
# - Security group: allow ports 22, 80, 443

# Option B: Heroku
# - Buildpacks: Node.js
# - Dyno type: Standard 1x
# - Add-ons: MongoDB Atlas
```

#### 3. Configure Server

```bash
# SSH into server
ssh -i key.pem ubuntu@your-staging-server

# Install dependencies
sudo apt update
sudo apt install -y nodejs npm nginx git

# Clone repository
git clone https://github.com/yourorg/fleetpro.git
cd fleetpro

# Install dependencies
npm install

# Create environment file
cat > .env.staging << EOF
NODE_ENV=staging
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/fleetpro
JWT_SECRET=$(openssl rand -base64 32)
API_URL=https://staging-api.example.com
PORT=5000
EOF

# Build application
npm run build
```

#### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/fleetpro-staging
upstream fleetpro {
  server localhost:5000;
  keepalive 64;
}

server {
  listen 80;
  server_name staging-api.example.com;
  
  # Redirect to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name staging-api.example.com;
  
  ssl_certificate /etc/ssl/certs/your-cert.crt;
  ssl_certificate_key /etc/ssl/private/your-key.key;
  
  # Security headers
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  
  # Proxy to Node.js
  location / {
    proxy_pass http://fleetpro;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

#### 5. Process Manager (PM2)

```bash
# Install PM2
sudo npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'fleetpro-staging',
    script: './dist/server/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'staging'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup hook
pm2 startup
```

#### 6. Deploy Script

```bash
#!/bin/bash
# deploy-staging.sh

set -e

echo "🚀 Deploying to staging..."

# Pull latest code
git pull origin staging

# Install dependencies
npm install

# Run tests
npm test

# Build production bundle
npm run build

# Run migrations
npm run db:migrate

# Restart application
pm2 restart fleetpro-staging

echo "✅ Deployment complete!"
```

## Production Deployment

### Prerequisites
- Production domain
- SSL certificate (Let's Encrypt or commercial)
- MongoDB Atlas production cluster
- CDN (Cloudflare or similar)
- Monitoring solution (New Relic, DataDog)

### High-Availability Setup

#### 1. Load Balancer

```nginx
upstream api_servers {
  least_conn;  # Use least connections algorithm
  server api1.example.com:5000 weight=1 max_fails=3 fail_timeout=30s;
  server api2.example.com:5000 weight=1 max_fails=3 fail_timeout=30s;
  server api3.example.com:5000 weight=1 max_fails=3 fail_timeout=30s;
  keepalive 32;
}

server {
  listen 443 ssl http2;
  server_name api.example.com;
  
  # SSL configuration
  ssl_certificate /etc/ssl/certs/api.example.com.crt;
  ssl_certificate_key /etc/ssl/private/api.example.com.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  
  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
  limit_req zone=api burst=20 nodelay;
  
  # Proxy
  location / {
    proxy_pass http://api_servers;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
```

#### 2. Database Replication

```bash
# MongoDB Atlas: Configure replica set
# - 3 nodes (Primary + 2 Secondaries)
# - Automatic failover enabled
# - Backup: continuous
# - Multi-region for disaster recovery
```

#### 3. Deployment Procedure

```bash
#!/bin/bash
# deploy-production.sh

set -e

ENVIRONMENTS=("prod-server-1" "prod-server-2" "prod-server-3")
VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./deploy-production.sh v1.0.0"
  exit 1
fi

echo "🚀 Deploying version $VERSION to production..."

# Create tag
git tag -a "$VERSION" -m "Production release $VERSION"
git push origin "$VERSION"

# Build Docker image
docker build -t fleetpro:$VERSION .
docker tag fleetpro:$VERSION fleetpro:latest

# Push to registry
docker push fleetpro:$VERSION

# Deploy to each server with rolling update
for SERVER in "${ENVIRONMENTS[@]}"; do
  echo "Deploying to $SERVER..."
  
  ssh ubuntu@$SERVER << EOF
    set -e
    
    # Pull image
    docker pull fleetpro:$VERSION
    
    # Run migrations
    docker run --rm fleetpro:$VERSION npm run db:migrate
    
    # Start new container
    docker stop fleetpro || true
    docker run -d --name fleetpro \
      -p 5000:5000 \
      --env-file .env \
      fleetpro:$VERSION
    
    # Verify health
    sleep 5
    curl -f http://localhost:5000/health || exit 1
    
    echo "✅ $SERVER deployed"
EOF
done

echo "✅ Production deployment complete!"
```

#### 4. Database Migrations

```bash
# Create migration file
cat > db/migrations/001_initial_schema.js << EOF
exports.up = async (db) => {
  // Create collections and indexes
  await db.createCollection('users');
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
};

exports.down = async (db) => {
  await db.dropCollection('users');
};
EOF

# Run migrations
npm run db:migrate

# Verify migrations
npm run db:migrate:status
```

### Post-Deployment

#### Health Checks

```bash
# Check application health
curl -s https://api.example.com/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-08-16T10:00:00Z",
#   "version": "7.0.0"
# }
```

#### Verification Checklist

- [ ] Application responding to requests
- [ ] Database connectivity verified
- [ ] Authentication working
- [ ] Payment processing functional
- [ ] Logs being written correctly
- [ ] Monitoring collecting metrics
- [ ] SSL certificate valid
- [ ] CDN cache cleared

#### Notify Stakeholders

```bash
# Send deployment notification
Subject: ✅ Production Deployment v7.0.0 Complete

The following has been deployed to production:
- SystemIntegrationService
- Comprehensive test suite
- Security audit service
- Complete documentation

Status: ✅ Healthy
Version: 7.0.0
Deployment time: 15 minutes

No issues detected. System operating normally.
```

## Monitoring

### Application Monitoring

```bash
# View logs
pm2 logs fleetpro-staging

# Monitor processes
pm2 monit

# View metrics
curl https://api.example.com/metrics
```

### Infrastructure Monitoring

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Network
iftop

# Process threads
ps aux | grep node
```

### Database Monitoring

```bash
# Connect to MongoDB
mongosh "mongodb+srv://user:pass@cluster.mongodb.net"

# Check replication status
rs.status()

# View slow queries
db.system.profile.find().pretty().limit(5)

# Check database size
db.stats()
```

## Rollback

### Immediate Rollback

```bash
# If deployment fails, rollback to previous version

# Option 1: Nginx fallback
# Point nginx upstream back to previous version server

# Option 2: Docker rollback
docker stop fleetpro
docker run -d --name fleetpro \
  -p 5000:5000 \
  --env-file .env \
  fleetpro:v6.0.0

# Verify health
curl https://api.example.com/health
```

### Database Rollback

```bash
# If migrations fail, rollback
npm run db:migrate:rollback --target v6.0.0

# Verify
npm run db:migrate:status
```

### Communication

```bash
Subject: ⚠️ Production Rollback - v7.0.0

Due to [reason], we have rolled back to v6.0.0.

Rollback initiated: [time]
Rollback completed: [time]
Service restored: Yes

Investigation ongoing. Updates to follow.
```

---

**Deployment Version:** 7.0.0  
**Last Updated:** August 16, 2026  
**Status:** Production Ready
