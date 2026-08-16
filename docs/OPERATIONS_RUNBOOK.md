# GS Infotech — Operations Runbook

**Version:** 1.0  
**Last Updated:** August 16, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Daily Operational Procedures](#daily-operational-procedures)
2. [Health Monitoring Checklist](#health-monitoring-checklist)
3. [Database Maintenance](#database-maintenance)
4. [Log Rotation and Archival](#log-rotation-and-archival)
5. [Certificate Renewal](#certificate-renewal)
6. [Security Patching Procedures](#security-patching-procedures)
7. [Performance Optimization](#performance-optimization)
8. [Cost Optimization](#cost-optimization)
9. [Incident Response Procedures](#incident-response-procedures)

---

## Daily Operational Procedures

### Morning Health Check (7:00 AM)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/daily-health-check.sh

echo "=== GS Infotech Daily Health Check ===" && \
echo "Started: $(date)" && \
echo "" && \

# 1. Check all services running
echo "1. Service Status:"
docker-compose -f /opt/gs-infotech/docker-compose.yml ps

# 2. Check database connectivity
echo "" && echo "2. Database Status:"
docker-compose -f /opt/gs-infotech/docker-compose.yml exec -T postgres \
  pg_isready -U postgres -d gs_infotech
echo "Status: $?"

# 3. Check Redis connectivity
echo "" && echo "3. Redis Status:"
docker-compose -f /opt/gs-infotech/docker-compose.yml exec -T redis \
  redis-cli ping

# 4. Check API health endpoint
echo "" && echo "4. API Health:"
curl -s http://localhost:3000/health | jq '.status'

# 5. Check web application
echo "" && echo "5. Web Application Status:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
echo ""

# 6. Check disk space
echo "" && echo "6. Disk Space:"
df -h | grep -E "^/dev|Used%"

# 7. Check memory usage
echo "" && echo "7. Memory Usage:"
free -h

# 8. Check recent errors
echo "" && echo "8. Recent Errors (last 10 minutes):"
docker-compose -f /opt/gs-infotech/docker-compose.yml logs --since 10m api 2>/dev/null | \
  grep -i "error\|critical\|exception" | tail -5

# 9. Alert on issues
if [ $? -ne 0 ]; then
    echo "ERROR: Found errors in logs"
    # Send Slack alert
    curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"🚨 GS Infotech Daily Health Check: FAILURES DETECTED"}'
    exit 1
fi

echo "" && echo "✓ All systems operational"
exit 0
```

Run daily via cron:
```bash
0 7 * * * /opt/gs-infotech/scripts/daily-health-check.sh >> /opt/gs-infotech/logs/health-check.log 2>&1
```

### Hourly Monitoring (Automated)

```javascript
// /opt/gs-infotech/scripts/monitor.js
// Run via: node monitor.js (in background/Docker)

const http = require('http');
const redis = require('redis');

const metrics = {
  health_checks: 0,
  failures: 0,
  last_check: null,
};

async function checkHealth() {
  try {
    // 1. Check API health
    const apiHealth = await fetch('http://localhost:3000/health');
    if (apiHealth.status !== 200) {
      console.error('API health check failed');
      metrics.failures++;
      return;
    }

    // 2. Check database
    const dbHealth = await fetch('http://localhost:3000/api/health/db');
    if (dbHealth.status !== 200) {
      console.error('Database health check failed');
      metrics.failures++;
      return;
    }

    // 3. Check Redis
    const client = redis.createClient();
    await client.ping();
    await client.quit();

    metrics.health_checks++;
    metrics.last_check = new Date();

    // Log metrics every 60 checks (1 hour)
    if (metrics.health_checks % 60 === 0) {
      console.log('Hourly metrics:', {
        checks: metrics.health_checks,
        failures: metrics.failures,
        failure_rate: (metrics.failures / metrics.health_checks * 100).toFixed(2) + '%',
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    metrics.failures++;
  }
}

// Run every minute
setInterval(checkHealth, 60000);
checkHealth(); // Run immediately
```

### Performance Baseline Recording (Daily)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/record-baseline.sh

BASELINE_FILE="/opt/gs-infotech/metrics/baseline-$(date +%Y%m%d).json"
mkdir -p /opt/gs-infotech/metrics

cat > $BASELINE_FILE <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "cpu_usage": "$(top -b -n1 | grep "Cpu(s)" | awk '{print $2}')",
  "memory_usage": "$(free | grep Mem | awk '{printf("%.2f", $3/$2 * 100)}')",
  "disk_usage": "$(df -h / | tail -1 | awk '{print $5}')",
  "db_connections": "$(psql -d gs_infotech -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")",
  "redis_memory": "$(redis-cli info memory | grep used_memory_human | cut -d: -f2)",
  "api_response_time": "$(curl -s -w '%{time_total}' -o /dev/null http://localhost:3000/health)"
}
EOF

echo "Baseline recorded: $BASELINE_FILE"
```

---

## Health Monitoring Checklist

### Real-Time Monitoring Dashboard

**Metrics to Monitor (via Prometheus/Grafana):**

| Metric | Alert Threshold | Check Frequency |
|--------|-----------------|-----------------|
| API CPU Usage | > 80% | Every 5 min |
| API Memory Usage | > 85% | Every 5 min |
| Database CPU Usage | > 75% | Every 5 min |
| Database Connections | > 150 (of 200) | Every 5 min |
| Disk Usage | > 85% | Every 15 min |
| API Response Time (p95) | > 1000ms | Every 1 min |
| Error Rate | > 1% | Every 1 min |
| Database Query Time (p95) | > 500ms | Every 5 min |
| Redis Memory Usage | > 80% | Every 5 min |
| HTTP 5xx Errors | > 5 per minute | Every 1 min |

### Prometheus Scrape Configuration

```yaml
# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'gs-infotech-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgresql'
    static_configs:
      - targets: ['localhost:9187']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
    scrape_interval: 30s

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 30s
```

### Alert Rules Configuration

```yaml
# /etc/prometheus/rules.yml
groups:
  - name: gs_infotech_alerts
    rules:
      - alert: HighAPIResponseTime
        expr: api_response_time_seconds{quantile="0.95"} > 1
        for: 5m
        annotations:
          summary: "API response time is high"
          description: "p95 response time is {{ $value }}s"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}"

      - alert: HighDatabaseConnections
        expr: pg_stat_activity_count > 150
        for: 5m
        annotations:
          summary: "Database connections near limit"
          description: "Active connections: {{ $value }}"

      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes / 1024 / 1024 / 1024) > 28
        for: 5m
        annotations:
          summary: "High memory usage"
          description: "Memory usage: {{ $value }}GB"

      - alert: DiskSpaceRunningOut
        expr: (disk_free_bytes / disk_total_bytes) < 0.15
        for: 10m
        annotations:
          summary: "Disk space running low"
          description: "Free space: {{ $value | humanize }}%"
```

### Manual Health Check Commands

```bash
# 1. Check all container status
docker-compose ps
# Expected: All containers "Up"

# 2. Check database size
psql -d gs_infotech -c "SELECT pg_size_pretty(pg_database_size('gs_infotech'));"

# 3. Check number of database connections
psql -d gs_infotech -c "SELECT sum(numbackends) FROM pg_stat_database;"

# 4. Check slow queries
psql -d gs_infotech -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 5. Check Redis memory usage
redis-cli INFO memory | grep used_memory

# 6. Check Redis key count
redis-cli DBSIZE

# 7. Check API request rate
curl -s http://localhost:3000/metrics | grep http_requests_total | head -5

# 8. Check API error rate
curl -s http://localhost:3000/metrics | grep http_requests_total | grep "5[0-9][0-9]"

# 9. Check SSL certificate expiration
echo | openssl s_client -servername api.gs-infotech.com -connect api.gs-infotech.com:443 2>/dev/null | \
  openssl x509 -noout -dates
```

---

## Database Maintenance

### Daily Maintenance (Morning)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/db-maintenance-daily.sh

echo "Starting daily database maintenance..."

# 1. Vacuum analyze (reclaims space, updates statistics)
psql -d gs_infotech -c "VACUUM ANALYZE;" 2>&1
echo "✓ Vacuum analyze complete"

# 2. Check for bloated tables
psql -d gs_infotech -c "
SELECT
  schemaname,
  tablename,
  round(100 * (total - n_live_tup) / total) AS dead_ratio
FROM pg_stat_user_tables
WHERE round(100 * (total - n_live_tup) / total) > 20
ORDER BY dead_ratio DESC;
"

# 3. Reindex if needed
psql -d gs_infotech -c "REINDEX INDEX CONCURRENTLY idx_assets_tenant_id;" 2>&1
echo "✓ Reindex complete"

# 4. Check for missing indexes
psql -d gs_infotech -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND n_distinct > 100
  AND correlation IS NOT NULL
ORDER BY ABS(correlation) DESC;
"

# 5. Monitor checkpoint activity
psql -d gs_infotech -c "SELECT * FROM pg_stat_bgwriter;" | \
  grep -E "checkpoints_timed|checkpoints_req"

# 6. Archive old WAL files (if using physical backup)
# This is handled by postgres.conf archive_command

# 7. Database statistics
psql -d gs_infotech -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datname = 'gs_infotech';"

echo "✓ Daily database maintenance complete"
```

Schedule via cron:
```bash
0 2 * * * /opt/gs-infotech/scripts/db-maintenance-daily.sh >> /var/log/db-maintenance.log 2>&1
```

### Weekly Maintenance (Sunday 3:00 AM)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/db-maintenance-weekly.sh

echo "Starting weekly database maintenance..."

# 1. Full backup (if daily automated backup failed)
pg_dump -d gs_infotech -F custom -f /backups/weekly/gs_infotech_$(date +%Y%m%d).dump

# 2. Check index bloat
psql -d gs_infotech -c "
SELECT schemaname, tablename, indexname, 
  round(100.0 * (pg_relation_size(indexrelid) - pg_relation_size(relfilenode)) / pg_relation_size(indexrelid)) AS waste_percent
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1000000
  AND round(100.0 * (pg_relation_size(indexrelid) - pg_relation_size(relfilenode)) / pg_relation_size(indexrelid)) > 20
ORDER BY waste_percent DESC;
"

# 3. Reindex bloated indexes
psql -d gs_infotech -c "REINDEX INDEX CONCURRENTLY idx_assets_status;" 2>&1

# 4. Cluster heavily accessed table (if supported)
# psql -d gs_infotech -c "CLUSTER assets USING idx_assets_tenant_id;" 2>&1

# 5. Update statistics
psql -d gs_infotech -c "ANALYZE;" 2>&1

# 6. Check constraint violations (should be zero)
psql -d gs_infotech -c "
SELECT constraint_name, COUNT(*) as violations
FROM pg_constraint
WHERE constraint_type = 'f'
GROUP BY constraint_name
HAVING COUNT(*) > 0;
"

# 7. Generate weekly report
psql -d gs_infotech -c "
SELECT
  'Database Statistics' as metric,
  to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') as timestamp,
  (SELECT COUNT(*) FROM assets) as total_assets,
  (SELECT COUNT(*) FROM asset_movements) as total_movements,
  (SELECT COUNT(*) FROM audit_logs) as total_audit_logs,
  pg_size_pretty(pg_database_size('gs_infotech')) as total_size;
"

echo "✓ Weekly database maintenance complete"
```

Schedule via cron:
```bash
0 3 * * 0 /opt/gs-infotech/scripts/db-maintenance-weekly.sh >> /var/log/db-maintenance-weekly.log 2>&1
```

### Monthly Maintenance (First Sunday of Month, 1:00 AM)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/db-maintenance-monthly.sh

echo "Starting monthly database maintenance..."

# 1. Full database optimization
psql -d gs_infotech -c "VACUUM FULL ANALYZE;" 2>&1
echo "✓ Full vacuum complete (may take 30+ minutes)"

# 2. Rebuild all indexes
psql -d gs_infotech -c "REINDEX DATABASE gs_infotech;" 2>&1
echo "✓ Database reindex complete"

# 3. Generate performance report
psql -d gs_infotech -c "
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
" > /reports/db-performance-monthly-$(date +%Y%m%d).txt

# 4. Check for unused indexes
psql -d gs_infotech -c "
SELECT indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;
" > /reports/unused-indexes-$(date +%Y%m%d).txt

# 5. Database integrity check
psql -d gs_infotech -c "
CREATE EXTENSION IF NOT EXISTS amcheck;
SELECT bt_index_check(index_oid)
FROM (
  SELECT pg_index.indexrelid::regclass::oid FROM pg_index
) t(index_oid);
" 2>&1 | tee /reports/integrity-check-$(date +%Y%m%d).txt

# 6. Verify backup integrity
echo "Testing backup restoration..."
createdb gs_infotech_restore_test 2>/dev/null
pg_restore -d gs_infotech_restore_test /backups/weekly/gs_infotech_$(date +%Y%m%d).dump 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Backup integrity verified"
  dropdb gs_infotech_restore_test
else
  echo "✗ Backup restoration failed!"
  # Send alert
fi

echo "✓ Monthly database maintenance complete"
```

---

## Log Rotation and Archival

### Logrotate Configuration

```bash
# /etc/logrotate.d/gs-infotech

/opt/gs-infotech/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 gs-infotech gs-infotech
    sharedscripts
    postrotate
        systemctl reload gs-infotech > /dev/null 2>&1 || true
    endscript
}

/var/log/postgresql/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}

/var/log/nginx/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        if [ -f /var/run/nginx.pid ]; then \
            kill -USR1 `cat /var/run/nginx.pid`; \
        fi
    endscript
}
```

Test logrotate:
```bash
logrotate -f /etc/logrotate.d/gs-infotech
logrotate -v /etc/logrotate.d/gs-infotech
```

### Log Archival to S3

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/archive-logs.sh

# Run weekly to archive old logs
ARCHIVE_DIR="/opt/gs-infotech/logs"
ARCHIVE_AGE=7  # Archive logs older than 7 days

echo "Archiving logs older than $ARCHIVE_AGE days..."

find $ARCHIVE_DIR -name "*.log.*.gz" -mtime +$ARCHIVE_AGE | while read file; do
    echo "Archiving: $file"
    aws s3 cp "$file" s3://gs-infotech-logs/archive/
    rm "$file"
done

echo "✓ Log archival complete"
```

### Centralized Logging Setup (ELK Stack)

```bash
# Docker Compose addition for logging
# Add to docker-compose.yml

elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
  ports:
    - "9200:9200"
  volumes:
    - elasticsearch_data:/usr/share/elasticsearch/data
  networks:
    - gs-infotech

logstash:
  image: docker.elastic.co/logstash/logstash:8.10.0
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
  ports:
    - "5000:5000"
  depends_on:
    - elasticsearch
  networks:
    - gs-infotech

kibana:
  image: docker.elastic.co/kibana/kibana:8.10.0
  ports:
    - "5601:5601"
  environment:
    - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
  depends_on:
    - elasticsearch
  networks:
    - gs-infotech

volumes:
  elasticsearch_data:
```

Configure Logstash:
```
# /opt/gs-infotech/logstash.conf
input {
  file {
    path => "/opt/gs-infotech/logs/api.log"
    start_position => "beginning"
    codec => json
  }
  file {
    path => "/var/log/postgresql/*.log"
    start_position => "beginning"
  }
}

filter {
  if [type] == "json" {
    json {
      source => "message"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "gs-infotech-%{+YYYY.MM.dd}"
  }
}
```

---

## Certificate Renewal

### Automated Certificate Renewal

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/renew-certificates.sh
# Run via cron: 0 3 15 * * (monthly check)

CERT_DIR="/etc/letsencrypt/live/gs-infotech.com"
ALERT_DAYS=30

# 1. Check certificate expiration
EXPIRY=$(openssl x509 -enddate -noout -in $CERT_DIR/cert.pem | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

echo "Certificate expires in $DAYS_LEFT days"

# 2. Renew if less than 30 days left
if [ $DAYS_LEFT -lt $ALERT_DAYS ]; then
    echo "Renewing certificate..."
    
    # Stop nginx (if using standalone renewal)
    systemctl stop nginx
    
    # Renew
    certbot renew --force-renewal
    RENEW_STATUS=$?
    
    # Start nginx
    systemctl start nginx
    
    if [ $RENEW_STATUS -eq 0 ]; then
        echo "✓ Certificate renewed successfully"
        
        # Send success notification
        curl -X POST $SLACK_WEBHOOK_URL \
          -d '{"text":"✓ SSL certificate renewed successfully"}'
    else
        echo "✗ Certificate renewal failed"
        
        # Send alert
        curl -X POST $SLACK_WEBHOOK_URL \
          -d '{"text":"🚨 SSL certificate renewal failed - manual intervention needed"}'
        exit 1
    fi
fi

# 3. Verify renewal
systemctl reload nginx
curl -s https://api.gs-infotech.com/health > /dev/null && \
  echo "✓ API accessible via HTTPS" || \
  echo "✗ API not accessible via HTTPS"
```

Schedule renewal check:
```bash
# Monthly check (15th of each month at 3 AM)
0 3 15 * * /opt/gs-infotech/scripts/renew-certificates.sh >> /var/log/cert-renewal.log 2>&1
```

### Manual Certificate Renewal (if automation fails)

```bash
# 1. Stop services using certificate
docker-compose stop api web nginx

# 2. Renew using certbot
certbot certonly --standalone -d gs-infotech.com -d api.gs-infotech.com

# 3. Verify renewal
ls -la /etc/letsencrypt/live/gs-infotech.com/

# 4. Install on load balancer
# If using AWS ALB:
aws acm import-certificate \
  --certificate fileb://cert.pem \
  --certificate-chain fileb://chain.pem \
  --private-key fileb://key.pem

# 5. Restart services
docker-compose up -d

# 6. Verify HTTPS
curl -s https://api.gs-infotech.com/health
```

---

## Security Patching Procedures

### Monthly Security Update Process

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/security-patch.sh

echo "Starting monthly security patch process..."

# 1. Update system packages
echo "Updating system packages..."
apt update
apt upgrade -y 2>&1 | tee /var/log/patch-system.log

# 2. Update Docker images
echo "Updating Docker base images..."
docker pull postgres:13-alpine
docker pull redis:7-alpine
docker pull node:18-alpine
echo "✓ Base images updated"

# 3. Update application dependencies
echo "Checking for vulnerable dependencies..."
cd /opt/gs-infotech
npm audit fix --audit-level=moderate 2>&1 | tee /var/log/patch-npm.log

# 4. Rebuild Docker images
echo "Rebuilding application images..."
docker-compose build --no-cache 2>&1 | tee /var/log/patch-build.log

# 5. Test on staging
echo "Testing on staging..."
docker-compose -f docker-compose.staging.yml pull
docker-compose -f docker-compose.staging.yml up -d
npm run test:integration

STAGING_TEST=$?

if [ $STAGING_TEST -ne 0 ]; then
    echo "✗ Staging tests failed - aborting patch"
    docker-compose -f docker-compose.staging.yml down
    exit 1
fi

# 6. Deploy to production during maintenance window
echo "Staging tests passed - ready for production deployment"
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# 7. Run smoke tests
echo "Running production smoke tests..."
npm run test:smoke

if [ $? -eq 0 ]; then
    echo "✓ Security patches applied successfully"
    
    # Send notification
    curl -X POST $SLACK_WEBHOOK_URL \
      -d '{"text":"✓ Monthly security patches applied successfully"}'
else
    echo "✗ Production smoke tests failed"
    
    # Rollback
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml pull <PREVIOUS_VERSION>
    docker-compose -f docker-compose.prod.yml up -d
    
    # Send alert
    curl -X POST $SLACK_WEBHOOK_URL \
      -d '{"text":"🚨 Security patch failed - rolled back to previous version"}'
    exit 1
fi

echo "✓ Security patching complete"
```

Schedule monthly patches (First Tuesday at 2 AM):
```bash
0 2 * * 2 if [ $(date +\%d) -le 07 ]; then /opt/gs-infotech/scripts/security-patch.sh; fi
```

### Critical Security Patch (Urgent)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/emergency-security-patch.sh
# Used for critical CVEs that need immediate patching

echo "🚨 EMERGENCY SECURITY PATCH INITIATED"

# 1. Immediate notification
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"🚨 EMERGENCY SECURITY PATCH starting for: $1"}'

# 2. Backup current state
docker-compose exec api tar -czf /backups/emergency-backup-$(date +%s).tar.gz /app
docker-compose exec postgres pg_dump gs_infotech > /backups/emergency-db-$(date +%s).sql

# 3. Apply patch
case "$1" in
    "CVE-2024-XXXX")
        docker pull node:18-alpine
        docker-compose build --no-cache api
        ;;
    "CVE-2024-YYYY")
        npm audit fix --force
        docker-compose build --no-cache api
        ;;
esac

# 4. Restart with new image
docker-compose restart api

# 5. Verify
sleep 10
curl -s http://localhost:3000/health
if [ $? -eq 0 ]; then
    echo "✓ Emergency patch applied successfully"
else
    echo "✗ Emergency patch failed - rolling back"
    # Restore from backup
fi

# 6. Notification
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"✓ Emergency security patch $1 applied successfully"}'
```

---

## Performance Optimization

### Query Optimization Review (Weekly)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/optimize-queries.sh

echo "Analyzing query performance..."

# 1. Identify slow queries
psql -d gs_infotech -c "
SELECT query, calls, mean_time, max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;
" > /reports/slow-queries-$(date +%Y%m%d).txt

# 2. Check index effectiveness
psql -d gs_infotech -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
" > /reports/unused-indexes-$(date +%Y%m%d).txt

# 3. Suggest missing indexes
psql -d gs_infotech -c "
SELECT schemaname, tablename, attname, n_distinct
FROM pg_stats
WHERE n_distinct > 1000
  AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n_distinct DESC
LIMIT 10;
" > /reports/missing-indexes-$(date +%Y%m%d).txt

# 4. Analyze table bloat
psql -d gs_infotech -c "
SELECT schemaname, tablename, 
  round(100*(total-n_live_tup)::numeric/total) as dead_ratio
FROM pg_stat_user_tables
WHERE total > 0
ORDER BY dead_ratio DESC
LIMIT 20;
" > /reports/table-bloat-$(date +%Y%m%d).txt

echo "✓ Performance analysis complete - see /reports/"
```

### Cache Hit Ratio Monitoring

```bash
# Monitor Redis hit ratio
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Calculate hit ratio
redis-cli INFO stats | awk '
  /keyspace_hits/ { hits = $2; split($2, a, ":"); hits = a[2] }
  /keyspace_misses/ { misses = $2; split($2, a, ":"); misses = a[2] }
  END { hit_ratio = hits / (hits + misses) * 100; printf "Hit Ratio: %.2f%%\n", hit_ratio }
'

# Expected: > 95% cache hit ratio
```

### Database Connection Pool Monitoring

```bash
# Check current connections
psql -d gs_infotech -c "
SELECT
  usename,
  count(*) as connection_count,
  MAX(EXTRACT(EPOCH FROM (NOW() - query_start))) as max_query_duration
FROM pg_stat_activity
GROUP BY usename
ORDER BY connection_count DESC;
"

# Alert if approaching limit
# Max is 200 connections (configured in postgresql.conf)
```

---

## Cost Optimization

### Monthly Cost Review (1st of month)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/cost-review.sh

echo "=== GS Infotech Monthly Cost Review ==="

# 1. AWS Costs (if using cloud)
aws ce get-cost-and-usage \
  --time-period Start=2026-08-01,End=2026-08-31 \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --filter file://cost-filter.json | jq '.ResultsByTime[] | {TimePeriod: .TimePeriod, Total: .Total.BlendedCost.Amount}'

# 2. Storage costs
echo "Data Storage:"
du -sh /backups/
du -sh /opt/gs-infotech/

# 3. Bandwidth analysis
echo "Network Traffic (last 24h):"
vnstat -d

# 4. Identify optimization opportunities
echo "Optimization Recommendations:"
echo "- Old backups: $(find /backups -mtime +90 | wc -l) files older than 90 days"
echo "- Unused Docker images: $(docker images --filter dangling=true | wc -l)"
echo "- Unused volumes: $(docker volume ls --filter dangling=true | wc -l)"

# 5. Generate report
cat > /reports/cost-review-$(date +%Y%m%d).txt <<EOF
GS Infotech Cost Review - $(date)

1. Infrastructure Costs
   - Compute: EC2 instances, RDS, ElastiCache
   - Storage: S3, backups, logs
   - Network: Data transfer, CDN

2. Optimization Actions
   - Delete backups > 90 days
   - Clean up unused Docker resources
   - Review and adjust instance sizing
   - Consider reserved instances for stable workloads

3. Projected Monthly Cost
   - Current burn rate: \$X,XXX
   - Last month: \$X,XXX
   - Trend: (Up/Down)
EOF
```

### Optimization Actions

```bash
# 1. Clean up old backups
find /backups -name "*.dump" -mtime +90 -delete
find /backups -name "*.sql.gz" -mtime +90 -delete

# 2. Clean up Docker resources
docker image prune -a --force
docker volume prune --force
docker container prune --force

# 3. Archive old logs to S3 and delete
aws s3 sync /opt/gs-infotech/logs/archive s3://gs-infotech-logs/
rm -rf /opt/gs-infotech/logs/archive/*.log.*

# 4. Review instance sizes
aws ec2 describe-instances --query 'Reservations[].Instances[].{Instance: InstanceId, Size: InstanceType, CPUUsage: CpuOptions.CoreCount}'

# 5. Set data retention policies
aws s3api put-bucket-lifecycle-configuration \
  --bucket gs-infotech-backups \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "ExpirationInDays": 90,
      "NoncurrentVersionExpirationInDays": 30
    }]
  }'
```

---

## Incident Response Procedures

### Incident Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|-----------|---------------|------------|
| P1 | Production down, users affected, revenue impact | 15 min | VP, CTO |
| P2 | Feature degraded, users impacted, workaround available | 30 min | Tech Lead, Manager |
| P3 | Minor issue, no user impact, low priority | 4 hours | Team |
| P4 | Cosmetic issue, no impact | 24 hours | Backlog |

### Incident Response Workflow

```
1. DETECT (< 5 min)
   ↓
2. ALERT (send notification)
   ↓
3. TRIAGE (determine severity)
   ↓
4. INVESTIGATE (root cause)
   ↓
5. MITIGATE (temporary fix)
   ↓
6. RESOLVE (permanent fix)
   ↓
7. DOCUMENT (post-mortem)
   ↓
8. PREVENT (process improvement)
```

### P1: Production Down

```bash
#!/bin/bash
# Incident Script: /opt/gs-infotech/scripts/incident-p1.sh

echo "🚨 P1 INCIDENT DETECTED"
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"

# 1. Alert team immediately
curl -X POST $SLACK_WEBHOOK_URL \
  -d "{\"text\":\"🚨 P1 INCIDENT $INCIDENT_ID: Service Down - Response initiated\"}"

# 2. Check what failed
echo "Checking service status..."
docker-compose ps
docker-compose logs --tail=20 api web postgres redis

# 3. Basic diagnostics
echo "Checking connectivity..."
curl -v http://localhost:3000/health
curl -v http://localhost:5173/

psql -d gs_infotech -c "SELECT 1;" || echo "Database down"
redis-cli ping || echo "Redis down"

# 4. Check disk space
df -h / | tail -1

# 5. Check memory
free -h | grep Mem

# 6. Attempt automatic recovery
echo "Attempting automatic recovery..."

# Check if services are in bad state
if docker-compose ps | grep -i "exited"; then
    echo "Restarting failed containers..."
    docker-compose restart
    sleep 10
    
    # Check if recovered
    curl -s http://localhost:3000/health > /dev/null
    if [ $? -eq 0 ]; then
        echo "✓ Service recovered"
        curl -X POST $SLACK_WEBHOOK_URL \
          -d "{\"text\":\"✓ Service recovered - $INCIDENT_ID\"}";
        exit 0
    fi
fi

# 7. If automatic recovery failed, escalate
echo "✗ Automatic recovery failed - manual intervention needed"
curl -X POST $SLACK_WEBHOOK_URL \
  -d "{\"text\":\"🚨 P1 INCIDENT $INCIDENT_ID: Automatic recovery failed - escalating to on-call engineer\"}"

# 8. Enable maintenance page
cp /opt/gs-infotech/www/maintenance.html /var/www/html/index.html
systemctl reload nginx

exit 1
```

### P2: Feature Degraded

```bash
# 1. Identify affected feature
echo "Identifying affected feature..."

# 2. Check logs for errors
docker-compose logs api | grep -i "error\|exception"

# 3. Check database performance
psql -d gs_infotech -c "
SELECT query, mean_time, max_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 5;
"

# 4. Check if rate limiting activated
curl -s http://localhost:3000/metrics | grep http_requests | grep "rate_limited"

# 5. Possible mitigations
# - Clear cache (if applicable): redis-cli FLUSHALL
# - Restart specific service: docker-compose restart api
# - Scale up: docker-compose up -d --scale api=2
# - Enable feature flag to disable problematic feature
```

### P3: Minor Issue

```bash
# 1. Document issue
cat > /incidents/incident-p3-$(date +%Y%m%d-%H%M%S).txt <<EOF
Issue: [Description]
Impact: [User impact]
Detected: $(date)
Status: Investigating
EOF

# 2. Investigate at normal priority
# - Check logs
# - Check metrics
# - Test locally if possible

# 3. Schedule fix during next deployment window
```

### Incident Post-Mortem (Within 24 hours)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/post-mortem.sh

INCIDENT_ID=$1

cat > /incidents/post-mortem-$INCIDENT_ID.md <<EOF
# Incident Post-Mortem: $INCIDENT_ID

## Incident Summary
- Date: $(date)
- Duration: 
- Severity: P1
- Systems Affected: 

## Timeline
- **HH:MM** - Issue detected
- **HH:MM** - Alert sent
- **HH:MM** - Investigation started
- **HH:MM** - Root cause identified
- **HH:MM** - Mitigation applied
- **HH:MM** - Resolved

## Root Cause Analysis
[What actually went wrong and why]

## Impact Assessment
- Users affected: 
- Data lost: Yes/No
- Revenue impact: 

## Resolution
[What was done to fix it]

## Preventive Measures
[What will we do to prevent this in the future]

## Action Items
- [ ] Implement preventive measure 1
- [ ] Add monitoring for issue 2
- [ ] Update runbook for issue 3

## Attendees
- Engineer: [Name]
- Manager: [Name]
- CTO: [Name]
EOF

echo "Post-mortem documented: /incidents/post-mortem-$INCIDENT_ID.md"
```

---

## Daily Task Checklist

Print and complete daily:

```
[ ] 7:00 AM  - Run daily health check
[ ] 12:00 PM - Check monitoring dashboard for alerts
[ ] 3:00 PM  - Verify no backup failures
[ ] 5:00 PM  - Review error logs
[ ] 6:00 PM  - Check certificate expiration (15th of month)
[ ] EOD      - Archive logs (if needed)
```

---

**Document Version:** 1.0  
**Last Reviewed:** August 16, 2026  
**Next Review:** November 16, 2026  
**Owner:** Operations Team  
**Approver:** CTO
