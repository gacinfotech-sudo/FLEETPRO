# GS Infotech — Troubleshooting Guide

**Version:** 1.0  
**Last Updated:** August 16, 2026  
**Status:** Production Ready

---

## Quick Diagnosis Tree

```
Is the API responding?
├─ YES → Is there a specific error?
│        ├─ High response time → See: Performance Troubleshooting
│        ├─ 5xx errors → See: HTTP 5xx Errors
│        ├─ 4xx errors → See: Client Errors
│        └─ Payment failures → See: Payment Gateway Issues
│
└─ NO → Are containers running?
         ├─ NO → See: Service Down
         └─ YES → Check logs (docker-compose logs api)
              ├─ Database connection error → See: Database Issues
              ├─ Redis connection error → See: Cache Issues
              └─ Other error → See: Common Issues
```

---

## Table of Contents

1. [Common Issues & Solutions](#common-issues--solutions)
2. [Performance Troubleshooting](#performance-troubleshooting)
3. [Database Issues](#database-issues)
4. [Payment Gateway Failures](#payment-gateway-failures)
5. [Email Delivery Failures](#email-delivery-failures)
6. [High CPU/Memory Diagnosis](#high-cpumemory-diagnosis)
7. [Network Connectivity Issues](#network-connectivity-issues)
8. [Storage Issues](#storage-issues)
9. [Security Incident Response](#security-incident-response)
10. [Support Contact Procedures](#support-contact-procedures)

---

## Common Issues & Solutions

### Service Down (All containers)

**Symptoms:**
- `curl localhost:3000/health` returns connection refused
- `docker-compose ps` shows all containers as "Exited"
- Users cannot access application

**Diagnosis:**
```bash
# Step 1: Check if Docker daemon is running
docker ps
# If error: "Cannot connect to Docker daemon"

# Step 2: Check available disk space
df -h /
# If < 10% free space, Docker may have stopped

# Step 3: Check system resources
free -h
top -b -n1 | head -5

# Step 4: Check container logs
docker-compose logs --tail=50
```

**Solution:**

```bash
# If disk is full:
docker system prune --all --force    # Removes unused containers/images
rm -rf /var/log/*.1 /var/log/*.2.gz  # Remove old logs
# Then restart Docker:
systemctl restart docker

# If memory is exhausted:
docker stats                          # Check memory usage
docker-compose down                   # Stop all containers
systemctl restart docker              # Restart daemon
docker-compose up -d                  # Restart services

# If containers exited unexpectedly:
docker-compose logs                   # Check error logs
docker-compose restart                # Restart containers
docker-compose ps                     # Verify running

# Verify recovery:
curl -s http://localhost:3000/health | jq '.'
```

---

### Slow API Response (Response time > 500ms)

**Symptoms:**
- API responds but takes > 1 second
- Web application feels sluggish
- Load balancer health checks pass but requests timeout

**Diagnosis:**
```bash
# Step 1: Check what's slow
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health
# Output shows: time_connect, time_starttransfer, time_total

# Step 2: Check CPU and Memory
docker stats gs-infotech-api
# If CPU > 80% or Memory > 85%, resource issue

# Step 3: Check database performance
psql -d gs_infotech -c "
  SELECT query, calls, mean_time, max_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"

# Step 4: Check active queries
psql -d gs_infotech -c "
  SELECT pid, query, state, query_start
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY query_start;
"

# Step 5: Check slow query log
tail -50 /var/log/postgresql/postgresql.log | grep "duration"
```

**Solutions:**

**If database is slow:**
```bash
# Check if bloated tables/indexes
psql -d gs_infotech -c "
  SELECT schemaname, tablename, 
    round(100*(total-n_live_tup)::numeric/total) as dead_ratio
  FROM pg_stat_user_tables
  WHERE total > 0
  ORDER BY dead_ratio DESC;
"

# Run maintenance
psql -d gs_infotech -c "VACUUM ANALYZE;"

# Kill long-running queries
psql -d gs_infotech -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE query_start < NOW() - INTERVAL '5 minutes'
  AND query NOT LIKE '%pg_dump%';
"
```

**If API CPU is high:**
```bash
# Check for memory leaks
docker stats gs-infotech-api --no-stream

# Restart API to clear memory
docker-compose restart api

# Check Node.js heap
curl http://localhost:3000/metrics | grep nodejs_heap

# If high, increase heap size
# Edit docker-compose.yml and add:
# environment:
#   - NODE_OPTIONS=--max-old-space-size=1024
```

**If not enough database connections:**
```bash
# Check connection count
psql -d gs_infotech -c "SELECT count(*) FROM pg_stat_activity;"

# Increase pool size in api/.env
DATABASE_POOL_SIZE=30  # Increase from 20

# Restart API
docker-compose restart api
```

---

### High Memory Usage (> 85%)

**Symptoms:**
- `docker stats` shows container using > 1.5GB RAM
- System becoming unresponsive
- OOM killer starts terminating processes

**Diagnosis:**
```bash
# Step 1: Identify which container
docker stats

# Step 2: Check if memory leak
watch -n 5 'docker stats --no-stream gs-infotech-api'
# Is memory continuously increasing?

# Step 3: Check Node.js heap
curl http://localhost:3000/metrics | grep -i heap

# Step 4: Check database connections
psql -d gs_infotech -c "SELECT count(*) FROM pg_stat_activity;"

# Step 5: Check Redis memory
redis-cli INFO memory
```

**Solutions:**

**For API (Node.js):**
```bash
# If heap is growing (likely memory leak):
# 1. Check for circular references in code
# 2. Check if event listeners are properly cleaned up
# 3. Restart container (temporary fix)
docker-compose restart api

# Increase heap size temporarily
docker-compose down
# Edit docker-compose.yml:
# environment:
#   - NODE_OPTIONS=--max-old-space-size=2048
docker-compose up -d

# Enable heap snapshots for debugging
curl http://localhost:3000/debug/heapdump > heapdump.heapsnapshot
```

**For Database:**
```bash
# Kill idle connections
psql -d gs_infotech -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '30 minutes';
"

# Check for long-running transactions
psql -d gs_infotech -c "
  SELECT pid, query_start, query
  FROM pg_stat_activity
  WHERE xact_start < NOW() - INTERVAL '30 minutes';
"
```

**For Redis:**
```bash
# Check memory usage by key pattern
redis-cli --scan --pattern "*" | wc -l

# Find largest keys
redis-cli --bigkeys

# Clear unused keys
redis-cli FLUSHDB  # ⚠️ Only if safe

# Enable persistence
# Edit redis.conf:
# save 900 1
# save 300 10
```

---

## Performance Troubleshooting

### Slow Queries

**Identify:**
```bash
# Enable slow query logging
psql -d gs_infotech -c "
  ALTER SYSTEM SET log_min_duration_statement = 1000;
  SELECT pg_reload_conf();
"

# Wait 5 minutes, then check:
tail -100 /var/log/postgresql/postgresql.log | grep "duration" | sort -t= -k2 -rn
```

**Optimize:**
```bash
# Analyze query plan
EXPLAIN ANALYZE SELECT * FROM assets WHERE status = 'active';

# Add index if needed
CREATE INDEX idx_assets_status ON assets(status);

# Verify it's used
EXPLAIN SELECT * FROM assets WHERE status = 'active';
# Should show "Index Scan" instead of "Sequential Scan"

# Run ANALYZE to update statistics
ANALYZE assets;
```

### P95 Response Time High

**Diagnosis:**
```bash
# Get response time percentiles
curl http://localhost:3000/metrics | grep http_request_duration_seconds_bucket

# Check specific endpoint
curl http://localhost:3000/metrics | grep 'http_request_duration_seconds_bucket{.*"/api/assets'
```

**Solution:**

| Metric | Action |
|--------|--------|
| p50 high | Database queries slow, add indexes |
| p95 high | Some outliers, check for occasional slow queries |
| p99 high | Garbage collection pauses, increase heap size |

---

## Database Issues

### Cannot Connect to Database

**Symptoms:**
- API logs: `Error: connect ECONNREFUSED 127.0.0.1:5432`
- `psql: could not connect to server`

**Diagnosis:**
```bash
# Step 1: Check if container is running
docker-compose ps postgres

# Step 2: Check if port is open
netstat -an | grep 5432
# or
ss -an | grep 5432

# Step 3: Check PostgreSQL logs
docker-compose logs postgres | tail -50

# Step 4: Try connecting inside container
docker-compose exec postgres psql -U postgres -d gs_infotech -c "SELECT 1;"

# Step 5: Check network connectivity
docker-compose exec api ping postgres
```

**Solutions:**

**Container not running:**
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Wait for it to be healthy
docker-compose ps
# Should show postgres as "Up (healthy)"

# Then restart API
docker-compose restart api
```

**Port not listening:**
```bash
# Check if port bound elsewhere
lsof -i :5432

# If nothing, check Docker network
docker network inspect gs-infotech

# Recreate network if needed
docker-compose down
docker network rm gs-infotech
docker-compose up -d
```

**Invalid credentials:**
```bash
# Check DATABASE_URL in .env
cat /opt/gs-infotech/.env.production | grep DATABASE_URL

# Should be: postgresql://user:password@postgres:5432/gs_infotech
# Change if needed:
# docker-compose down
# Edit .env
# docker-compose up -d
```

---

### Database Connection Pool Exhausted

**Symptoms:**
- Errors: `too many connections`
- `FATAL: remaining connection slots are reserved`
- New requests hang indefinitely

**Diagnosis:**
```bash
# Check active connections
psql -d gs_infotech -c "
  SELECT usename, count(*) as connection_count
  FROM pg_stat_activity
  GROUP BY usename
  ORDER BY connection_count DESC;
"

# Check max connections
psql -d gs_infotech -c "SHOW max_connections;"

# List current connections with duration
psql -d gs_infotech -c "
  SELECT pid, usename, application_name, state, 
    EXTRACT(EPOCH FROM (NOW() - query_start))::int as duration_seconds
  FROM pg_stat_activity
  ORDER BY duration_seconds DESC;
"
```

**Solutions:**

**Close idle connections:**
```bash
# Kill idle connections
psql -d gs_infotech -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
"
```

**Increase pool size:**
```bash
# Edit docker-compose.yml
# environment:
#   DATABASE_POOL_SIZE=30  # Was 20

docker-compose restart api
```

**Increase max_connections:**
```bash
# Connect to PostgreSQL container
docker-compose exec postgres psql -U postgres

# Inside psql:
ALTER SYSTEM SET max_connections = 300;
SELECT pg_reload_conf();

# Verify
SHOW max_connections;
```

---

### Database Bloat

**Symptoms:**
- Database size keeps growing
- Slow queries without changes
- High disk usage

**Diagnosis:**
```bash
# Check database size
psql -d gs_infotech -c "SELECT pg_size_pretty(pg_database_size('gs_infotech'));"

# Check table sizes
psql -d gs_infotech -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables
  WHERE schemaname != 'pg_catalog'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"

# Check dead tuple percentage
psql -d gs_infotech -c "
  SELECT schemaname, tablename, 
    round(100*(total-n_live_tup)::numeric/total) as dead_percentage
  FROM pg_stat_user_tables
  WHERE total > 0
  ORDER BY dead_percentage DESC;
"
```

**Solutions:**

**Full vacuum (locks table, do during maintenance window):**
```bash
# Stop API to prevent queries
docker-compose stop api

# Run vacuum
docker-compose exec postgres psql -U postgres -d gs_infotech -c "VACUUM FULL ANALYZE;"

# Restart
docker-compose up -d
```

**Partial cleanup (can run while active):**
```bash
# Regular vacuum
docker-compose exec postgres psql -U postgres -d gs_infotech -c "VACUUM ANALYZE;"

# Reindex large indexes
docker-compose exec postgres psql -U postgres -d gs_infotech -c "REINDEX INDEX CONCURRENTLY idx_assets_tenant_id;"
```

---

## Payment Gateway Failures

### Razorpay API Errors

**Symptoms:**
- Payment creation returns 401/403
- Error: `Invalid API key`
- Error: `Authentication failed`

**Diagnosis:**
```bash
# Step 1: Verify API keys are configured
echo $RAZORPAY_KEY_ID
echo $RAZORPAY_KEY_SECRET

# Step 2: Check environment variables
docker-compose exec api env | grep RAZORPAY

# Step 3: Test API connectivity
curl -X GET https://api.razorpay.com/v1/payments \
  -H "Authorization: Basic $(echo -n $RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET | base64)" \
  -s | jq '.'

# Step 4: Check if using test vs. production key
# Test keys start with: rzp_test_
# Production keys start with: rzp_live_
echo $RAZORPAY_KEY_ID | grep -o "rzp_[^_]*"
```

**Solutions:**

**Invalid API key:**
```bash
# 1. Go to Razorpay dashboard
# 2. Copy correct API key from Settings
# 3. Update in .env.production:
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxxx

# 4. Restart API
docker-compose restart api

# 5. Test payment creation
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "currency": "INR"}'
```

**Webhook not validating:**
```bash
# Check webhook secret is correct
echo $RAZORPAY_WEBHOOK_SECRET

# Verify signature validation in code:
// Example Node.js verification
const crypto = require('crypto');
const body = JSON.stringify(req.body);
const signature = req.headers['x-razorpay-signature'];

const generated = crypto
  .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
  .update(body)
  .digest('hex');

if (generated !== signature) {
  return res.status(401).json({ error: 'Invalid signature' });
}

// If still failing, check that webhook secret matches in Razorpay dashboard
```

---

### Payment Timeout

**Symptoms:**
- Payment request hangs > 30 seconds
- Timeout error returned to user
- No payment created in Razorpay dashboard

**Diagnosis:**
```bash
# Check network connectivity
curl -I https://api.razorpay.com/v1/payments

# Check API response time
curl -w "@curl-format.txt" -o /dev/null \
  https://api.razorpay.com/v1/payments \
  -H "Authorization: Basic $(echo -n $RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET | base64)"

# Check if timeout is set correctly
grep -r "timeout" /opt/gs-infotech/apps/api/src/services/
```

**Solutions:**

**Increase timeout:**
```javascript
// In payment service
const axiosInstance = axios.create({
  timeout: 30000,  // 30 seconds (increase if needed to 45000)
  headers: {
    'Authorization': `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
  }
});

// Add retry logic
async function createPaymentWithRetry(data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await razorpayApi.create(data);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

**Check ISP/Network issues:**
```bash
# Check DNS resolution
nslookup api.razorpay.com
dig api.razorpay.com

# Check routing
traceroute api.razorpay.com

# Check firewall rules
sudo iptables -L -n | grep 443
```

---

## Email Delivery Failures

### SendGrid Integration Issues

**Symptoms:**
- Email not delivered to user
- Error: `Invalid API key`
- Error: `Invalid email address`
- Emails sent but marked as spam

**Diagnosis:**
```bash
# Step 1: Verify SendGrid API key
echo $SENDGRID_API_KEY
# Should be: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Step 2: Test API connectivity
curl -X GET https://api.sendgrid.com/v3/mail/settings \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -s | jq '.'

# Step 3: Check sender email
echo $SENDGRID_FROM_EMAIL

# Step 4: Verify sender is whitelisted
curl -X GET https://api.sendgrid.com/v3/senders \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -s | jq '.result[] | .from.email'

# Step 5: Check email logs
curl -X GET "https://api.sendgrid.com/v3/mail_settings/bounce_purge" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -s | jq '.'
```

**Solutions:**

**Invalid API key:**
```bash
# 1. Go to SendGrid > Settings > API Keys
# 2. Create new API key (or use existing one)
# 3. Copy full key (not truncated version)
# 4. Update in .env.production:
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 5. Restart API
docker-compose restart api

# 6. Test email sending
curl -X POST http://localhost:3000/api/emails/test \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

**Sender not whitelisted:**
```bash
# 1. Go to SendGrid dashboard
# 2. Settings > Sender Authentication
# 3. Verify the sender email domain or single sender
# 4. Update SENDGRID_FROM_EMAIL in .env.production

# Alternative: Use SendGrid's dynamic templates which support more flexibility
```

**Emails going to spam:**
```bash
# 1. Add SPF record to DNS:
Type: TXT
Name: yourdomain.com
Value: v=spf1 sendgrid.net ~all

# 2. Add DKIM record:
# SendGrid provides DKIM record values in Settings > Sender Authentication

# 3. Add DMARC record:
Type: TXT
Name: _dmarc.yourdomain.com
Value: v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com

# 4. Test SPF/DKIM/DMARC
mxtoolbox.com (use tool to verify)

# 5. In email headers, add:
List-Unsubscribe: <mailto:unsubscribe@yourdomain.com>
```

---

## High CPU/Memory Diagnosis

### CPU Usage > 80%

**Diagnosis:**
```bash
# Step 1: Identify which process
docker stats

# Step 2: Check top CPU consumers
docker-compose exec api ps aux | sort -k3 -r | head -10

# Step 3: Profile Node.js CPU
# Install clinic.js if needed
npm install -g @clinic/clinic

# Step 4: Get CPU info
top -b -n1 | grep -A 2 "Cpu(s)"

# Step 5: Check for background jobs
docker-compose exec api npm run list:crons
```

**Solutions:**

**Too many Node.js workers:**
```bash
# Check worker count
ps aux | grep node | wc -l

# Reduce if needed (edit docker-compose.yml):
environment:
  - NODE_OPTIONS=--max-old-space-size=1024 --max-http-header-size=16384

# Restart
docker-compose restart api
```

**Background job queue overloaded:**
```bash
# Check queue status
redis-cli LLEN "job:queue:default"

# Check job processing rate
curl http://localhost:3000/metrics | grep job_queue

# Scale up workers (if in Kubernetes):
kubectl scale deployment gs-infotech-worker --replicas=5

# Or restart to clear queue
docker-compose restart api
```

**Inefficient query:**
```bash
# Enable query analysis
psql -d gs_infotech -c "SET log_statement = 'all'; SET log_duration = on;"

# Make request that causes high CPU
curl http://localhost:3000/api/assets?limit=10000

# Check logs
tail -50 /var/log/postgresql/postgresql.log

# Kill the query if running too long
psql -d gs_infotech -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"
```

---

### Memory Usage > 85%

See [High Memory Usage](#high-memory-usage--85) section above.

---

## Network Connectivity Issues

### API Unreachable from Web

**Symptoms:**
- Web app loaded but API calls fail
- Error: `ERR_CONNECTION_REFUSED` or `ERR_NAME_NOT_RESOLVED`
- CORS errors in console

**Diagnosis:**
```bash
# Step 1: Check if API is running
curl http://localhost:3000/health

# Step 2: Check from web container
docker-compose exec web curl http://api:3000/health

# Step 3: Check DNS resolution
docker-compose exec web nslookup api
docker-compose exec web nslookup gs-infotech-api

# Step 4: Check network connectivity
docker-compose exec web ping api

# Step 5: Check CORS configuration
curl -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS http://localhost:3000/api \
  -v
```

**Solutions:**

**API not running:**
```bash
docker-compose restart api
```

**Network issue:**
```bash
# Check if containers are in same network
docker network inspect gs-infotech

# If API not connected, reconnect:
docker network connect gs-infotech gs-infotech-api
```

**CORS misconfigured:**
```bash
# In API .env or code:
CORS_ORIGIN=http://localhost:5173,https://app.gs-infotech.com

# Restart API
docker-compose restart api
```

---

### External API Unreachable (Payment Gateway, Email, etc.)

**Symptoms:**
- Payment creation fails
- Email not sending
- Timeout errors to external services

**Diagnosis:**
```bash
# Step 1: Check DNS resolution
docker-compose exec api nslookup api.razorpay.com
docker-compose exec api nslookup api.sendgrid.com

# Step 2: Check connectivity
docker-compose exec api curl -I https://api.razorpay.com
docker-compose exec api curl -I https://api.sendgrid.com

# Step 3: Check firewall rules
sudo iptables -L -n | grep 443

# Step 4: Check proxy settings (if behind proxy)
env | grep -i proxy
```

**Solutions:**

**DNS resolution failing:**
```bash
# Check container's DNS settings
docker inspect gs-infotech-api | grep -A 5 "ResolvConfPath"

# Use custom DNS (edit docker-compose.yml):
api:
  dns:
    - 8.8.8.8
    - 1.1.1.1

docker-compose restart api
```

**Firewall blocking outbound:**
```bash
# Add firewall rule to allow HTTPS
sudo ufw allow out 443/tcp

# If using iptables:
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
```

---

## Storage Issues

### Disk Space Running Out

**Symptoms:**
- Error: `No space left on device`
- Docker commands fail
- Database stops accepting writes

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check largest directories
du -sh /* | sort -rh | head -10

# Check Docker storage
docker system df

# Check database size
psql -d gs_infotech -c "SELECT pg_size_pretty(pg_database_size('gs_infotech'));"

# Check log files
du -sh /var/log/
du -sh /opt/gs-infotech/logs/
```

**Solutions:**

**Clean Docker**
```bash
# Remove unused images
docker image prune -a --force

# Remove unused volumes
docker volume prune --force

# Remove unused containers
docker container prune --force

# Remove build cache
docker builder prune --all --force
```

**Archive old logs**
```bash
# Gzip old logs
gzip /opt/gs-infotech/logs/*.log.1

# Move to S3
aws s3 sync /opt/gs-infotech/logs/archive s3://gs-infotech-logs/
rm -rf /opt/gs-infotech/logs/archive/
```

**Rotate logs manually**
```bash
# Force log rotation
sudo logrotate -f /etc/logrotate.d/gs-infotech

# Delete old rotated logs
find /var/log -name "*.log.*" -mtime +30 -delete
find /opt/gs-infotech/logs -name "*.log.*" -mtime +30 -delete
```

**Expand disk (if using cloud)**
```bash
# AWS EBS: Create snapshot, create larger volume, attach
# GCP: Resize persistent disk
# Azure: Resize disk in portal

# After expanding, resize filesystem
sudo resize2fs /dev/xvda1
```

---

## Security Incident Response

### Potential Data Breach

**Immediate Actions (First 15 minutes):**

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/incident-security.sh

echo "🚨 SECURITY INCIDENT RESPONSE INITIATED"

# 1. Isolate affected system (don't shut down - collect evidence)
# Take no destructive actions

# 2. Preserve logs
cp -r /var/log /backup/logs-evidence-$(date +%s)
docker-compose logs api > /backup/docker-logs-$(date +%s).txt

# 3. Notify security team immediately
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"🚨 SECURITY INCIDENT: Possible data breach - isolating system"}'

# 4. Check database for unauthorized access
psql -d gs_infotech -c "
  SELECT usename, count(*) as connection_count
  FROM pg_stat_activity
  GROUP BY usename;
"

# 5. Check if unauthorized users created
psql -d gs_infotech -c "\du"

# 6. Check recent queries
psql -d gs_infotech -c "
  SELECT query, query_start
  FROM pg_stat_activity
  WHERE query NOT LIKE '%pg_stat%'
  ORDER BY query_start DESC
  LIMIT 20;
"

# 7. Do NOT reboot or restart services yet (preserve evidence)
```

**Investigation (Within 1 hour):**

```bash
# 1. Check access logs
grep "SELECT.*password\|SELECT.*token\|SELECT.*secret" /var/log/postgresql/postgresql.log

# 2. Check file access
auditctl -l
tail -100 /var/log/audit/audit.log

# 3. Check for privilege escalation
grep "sudo" /var/log/auth.log

# 4. Check for backdoors
# Find suspicious files created recently
find / -type f -newermt "-1 hour" 2>/dev/null | grep -v /proc

# 5. Check network connections
netstat -tulpn | grep ESTABLISHED
```

**Containment (1-2 hours):**

```bash
# 1. Rotate all credentials
# - Database passwords
# - API keys (Razorpay, SendGrid, Twilio)
# - JWT secrets
# - API authentication tokens

# 2. Check if data was exfiltrated
# - Check S3 access logs: aws s3api get-bucket-logging
# - Check database exports: find / -name "*.sql" -newermt "-1 hour"

# 3. Force logout all sessions
# Either:
# a) Rotate JWT secret (all users logged out immediately)
# b) Add session revocation token to database

# 4. Review IAM permissions
aws iam list-users
aws iam get-user-policy --user-name suspected-user

# 5. Disable compromised accounts
aws iam update-login-profile --user-name suspicious-user --no-password-reset-required
```

**Recovery & Notifications (2-24 hours):**

```bash
# 1. Restore from latest clean backup
docker-compose down
# Restore database from backup taken before incident
pg_restore -d gs_infotech /backups/pre-incident-backup.dump

# 2. Redeploy code from known-good commit
docker pull gs-infotech/api:v1.0.0
docker-compose up -d

# 3. Notify affected users
# - Which data was affected
# - What actions users should take (change passwords, etc.)
# - Timeline of incident

# 4. Post-incident forensics (within 24 hours)
# Document:
# - Timeline of incident
# - How attacker gained access
# - What data was accessed
# - Root cause
# - Preventive measures
```

---

## Support Contact Procedures

### Escalation Path

1. **Level 1 (On-Call Engineer):** Initial incident response
   - Phone: +1-XXX-XXX-XXXX
   - Slack: @on-call
   - Response time: 15 minutes

2. **Level 2 (Tech Lead):** P1/P2 escalation
   - Phone: +1-XXX-XXX-XXXX
   - Slack: @tech-lead
   - Response time: 30 minutes

3. **Level 3 (CTO):** Critical incidents
   - Phone: +1-XXX-XXX-XXXX
   - Slack: @cto
   - Response time: 15 minutes

### Support Request Template

```markdown
# Support Request

**Date:** 2026-08-16  
**Severity:** P1 / P2 / P3 / P4  
**Reported By:** [Name]

## Issue Summary
[Concise description of issue]

## Symptoms
- [Symptom 1]
- [Symptom 2]

## Affected Users/Systems
- [Service 1]
- [Service 2]

## Steps Taken
- [Action 1]
- [Action 2]

## Logs/Evidence
[Paste relevant error messages or logs]

## Business Impact
[What is broken, how many users affected, revenue impact]
```

---

**Document Version:** 1.0  
**Last Reviewed:** August 16, 2026  
**Next Review:** November 16, 2026  
**Owner:** DevOps Team  
**Approver:** CTO
