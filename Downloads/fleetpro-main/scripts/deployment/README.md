# FleetPro Deployment Guide

## Overview
This directory contains all deployment scripts and configurations for FleetPro. The deployment process supports multiple orchestration platforms (Docker Compose and ECS) and environments (staging, production).

## Quick Start

### Deploy to Staging (Docker Compose)
```bash
cd /Users/pradeep/Downloads/fleetpro-main
bash scripts/deployment/deploy.sh staging docker-compose
```

### Deploy to Staging (ECS)
```bash
bash scripts/deployment/deploy.sh staging ecs
```

### Deploy to Production (ECS)
```bash
bash scripts/deployment/deploy.sh production ecs
```

## Prerequisites

### System Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+ (for Docker Compose deployment)
- AWS CLI (for ECS deployment)
- bash 4.0+
- curl (for health checks)

### Credentials & Configuration
- AWS credentials configured (for ECR push)
- Environment variables set:
  - `ECR_REGISTRY` - ECR registry URL (default: `fleetpro`)
  - `NODE_ENV` - Deployment environment
  - `VERSION` - Image version tag (default: `latest`)

## Deployment Architecture

### Components
1. **FleetPro Application** (port 5050)
   - Express.js backend
   - React frontend (built and served)
   - Health check endpoint: `/health`

2. **MongoDB** (port 27017)
   - Primary database
   - Replication enabled
   - Authentication required

3. **Redis** (port 6379)
   - Session store
   - Cache layer
   - AOF persistence

4. **Load Balancer**
   - Health checks every 30 seconds
   - Failover support
   - SSL/TLS termination

## Files in This Directory

### Scripts

#### `deploy.sh` (Main Deployment Script)
The primary orchestration script that handles:
- Docker image building
- ECR registry operations
- Environment-specific deployment
- Health verification
- Smoke testing

**Usage:**
```bash
bash deploy.sh <environment> <orchestrator>
```

**Parameters:**
- `<environment>`: `staging` or `production`
- `<orchestrator>`: `docker-compose` or `ecs`

**Example:**
```bash
bash deploy.sh staging docker-compose
bash deploy.sh production ecs
```

#### `mock-build.sh` (Build Simulator)
Simulates the Docker build process without requiring Docker installation.

**Usage:**
```bash
bash mock-build.sh
```

### Configuration Files

#### `staging-config.yaml`
Infrastructure configuration for staging environment:
- Replica count: 3
- Resource limits (CPU/memory)
- Database configuration
- Monitoring setup
- Security settings

## Deployment Process

### Phase 1: Validation
- ✅ Docker installation check
- ✅ Environment variables validation
- ✅ Credential verification

### Phase 2: Build
- ✅ Client build (Vite)
- ✅ Server build (esbuild)
- ✅ Docker image creation (~75 seconds)
- ✅ Image size optimization (~180MB)

### Phase 3: Registry Operations
- ✅ Image tagging for ECR
- ✅ Authentication with ECR
- ✅ Image push to registry

### Phase 4: Deployment
- ✅ Docker Compose deployment OR
- ✅ ECS task definition update
- ✅ Service scaling
- ✅ Rolling restart (if applicable)

### Phase 5: Verification
- ✅ Health check validation (30 retries × 2 sec)
- ✅ Service responsiveness
- ✅ Database connectivity
- ✅ API endpoint tests

### Phase 6: Testing
- ✅ Smoke tests on core APIs
- ✅ Authentication flow
- ✅ User management
- ✅ Vehicle management
- ✅ Driver management

## Docker Compose Deployment

### Starting Services
```bash
docker-compose -p fleetpro-staging up -d --build
```

### Checking Status
```bash
# View running services
docker-compose -p fleetpro-staging ps

# View logs
docker-compose -p fleetpro-staging logs -f fleetpro

# Check health
docker-compose -p fleetpro-staging exec fleetpro curl http://localhost:5050/health
```

### Stopping Services
```bash
docker-compose -p fleetpro-staging down
```

### Viewing Logs
```bash
# Application logs
docker logs fleetpro-app

# MongoDB logs
docker logs fleetpro-mongodb

# Redis logs
docker logs fleetpro-redis

# Follow logs in real-time
docker logs -f fleetpro-app
```

## ECS Deployment

### Prerequisites
```bash
# Configure AWS credentials
aws configure

# Export ECR registry
export ECR_REGISTRY=$(aws ecr describe-repositories --repository-names fleetpro --query 'repositories[0].repositoryUri' --output text)
```

### Deploy to ECS
```bash
bash scripts/deployment/deploy.sh staging ecs
```

### Monitor Deployment
```bash
# Check ECS service status
aws ecs describe-services --cluster staging --services fleetpro

# View task logs in CloudWatch
aws logs tail /ecs/fleetpro/staging --follow
```

## Environment Variables

### Staging Configuration
```bash
NODE_ENV=staging
MONGODB_URI=mongodb://admin:admin123@mongodb:27017/fleetpro?authSource=admin
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRE=7d
PORT=5050
LOG_LEVEL=debug
```

### Production Configuration
```bash
NODE_ENV=production
MONGODB_URI=<production-mongodb-uri>
REDIS_URL=<production-redis-uri>
JWT_SECRET=<strong-production-secret>
JWT_EXPIRE=24h
PORT=5050
LOG_LEVEL=info
```

## Health Checks

### Manual Health Check
```bash
# Check application health
curl http://localhost:5050/health

# Expected response:
# {
#   "ok": true,
#   "service": "fleetpro",
#   "database": "connected",
#   "timestamp": "2026-08-16T19:14:00.000Z"
# }
```

### Continuous Monitoring
```bash
# Watch health status
watch -n 2 'curl -s http://localhost:5050/health | jq'
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
docker logs fleetpro-app
```

**Common issues:**
1. Port 5050 already in use
2. MongoDB connection failed
3. Environment variables not set

### Health Check Failing

**Verify MongoDB:**
```bash
docker exec fleetpro-mongodb mongosh --eval "db.adminCommand('ping')"
```

**Check connectivity:**
```bash
docker-compose exec fleetpro curl http://localhost:5050/health
```

### Database Connection Issues

**Check MongoDB is running:**
```bash
docker ps | grep mongodb
```

**Connect directly:**
```bash
mongosh mongodb://admin:admin123@localhost:27017/fleetpro?authSource=admin
```

### API Endpoint Not Responding

**Check if API is running:**
```bash
curl -i http://localhost:5050/api/health
```

**Test with verbose output:**
```bash
curl -v http://localhost:5050/api/health
```

## Performance Tuning

### MongoDB Optimization
```yaml
mongodb:
  replicas: 3
  storage_engine: wiredTiger
  cache_size: 50% of available RAM
  connection_pool: 100
```

### Redis Optimization
```yaml
redis:
  maxmemory: 512mb
  maxmemory_policy: allkeys-lru
  appendonly: yes
  appendfsync: everysec
```

### Application Optimization
```yaml
replicas: 3-5 (based on load)
cpu_request: 256m
cpu_limit: 512m
memory_request: 512Mi
memory_limit: 1Gi
```

## Monitoring & Alerts

### Key Metrics
- Service availability (uptime %)
- API response time (p50, p95, p99)
- Error rate (errors per minute)
- Database connection pool usage
- Cache hit rate
- CPU utilization
- Memory utilization

### Alert Thresholds
- Service down > 1 minute
- Error rate > 5%
- Response time p95 > 500ms
- Database connections > 80
- Memory usage > 80%

## Rollback Procedure

If deployment issues occur:

1. **Identify the issue:**
   ```bash
   docker logs fleetpro-app
   ```

2. **Rollback to previous version:**
   ```bash
   docker pull fleetpro:previous
   docker tag fleetpro:previous fleetpro:latest
   docker-compose -p fleetpro-staging up -d
   ```

3. **Verify rollback:**
   ```bash
   curl http://localhost:5050/health
   ```

4. **Investigate root cause** and test fix before redeploying

## Security Checklist

Before production deployment:
- [ ] Update JWT_SECRET with strong password
- [ ] Enable TLS/SSL certificates
- [ ] Configure firewall rules
- [ ] Enable monitoring and alerts
- [ ] Set up backup strategy
- [ ] Review CORS settings
- [ ] Verify rate limiting
- [ ] Enable audit logging
- [ ] Test disaster recovery
- [ ] Security scan complete

## Testing After Deployment

### Smoke Tests
```bash
# Run included smoke test suite
bash scripts/deployment/deploy.sh staging docker-compose
```

### Manual Testing
```bash
# Test authentication
curl -X POST http://localhost:5050/api/v1/auth/login

# Test user API
curl http://localhost:5050/api/v1/users

# Test vehicle API
curl http://localhost:5050/api/v1/vehicles
```

## Production Deployment Checklist

- [ ] All changes reviewed and tested
- [ ] Database migrations prepared
- [ ] Backup created
- [ ] Monitoring configured
- [ ] Alerting enabled
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security scan passed

## Support & Contact

For deployment issues:
1. Check logs: `docker logs fleetpro-app`
2. Review troubleshooting guide above
3. Contact DevOps team
4. Reference deployment report: `/STAGING_DEPLOYMENT_REPORT.md`

## References

- Docker Documentation: https://docs.docker.com/
- Docker Compose Documentation: https://docs.docker.com/compose/
- AWS ECS Documentation: https://docs.aws.amazon.com/ecs/
- Application Architecture: `/README.md`
- Security Guide: `/SECURITY_GUIDE.md`

---

**Last Updated:** August 16, 2026
**Maintained By:** DevOps Team
**Status:** Production Ready
