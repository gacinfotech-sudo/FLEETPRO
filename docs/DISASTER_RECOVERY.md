# GS Infotech — Disaster Recovery Guide

**Version:** 1.0  
**Last Updated:** August 16, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [RTO/RPO Definitions](#rtorpo-definitions)
2. [Backup Strategy](#backup-strategy)
3. [Restore Procedures](#restore-procedures)
4. [Data Recovery from Corruption](#data-recovery-from-corruption)
5. [Geographic Failover](#geographic-failover)
6. [Testing Backup Recovery](#testing-backup-recovery)
7. [Incident Post-Mortems](#incident-post-mortems)
8. [Lessons Learned Tracking](#lessons-learned-tracking)

---

## RTO/RPO Definitions

### Service Level Objectives

| Metric | Target | Definition |
|--------|--------|-----------|
| **RTO** | 4 hours | Recovery Time Objective - Time to restore service |
| **RPO** | 15 minutes | Recovery Point Objective - Max acceptable data loss |
| **MTBF** | 6 months | Mean Time Between Failures |
| **MTTR** | 2 hours | Mean Time To Repair |
| **Availability** | 99.9% | Three-nines uptime SLA |

### Backup Retention Policy

| Backup Type | Retention | Frequency | Storage |
|------------|-----------|-----------|---------|
| Hourly | 24 hours | Every hour | Local SSD |
| Daily | 30 days | Every midnight | AWS S3 |
| Weekly | 12 weeks | Every Sunday 3 AM | AWS S3 Glacier |
| Monthly | 12 months | 1st of month | AWS S3 Glacier Deep Archive |

---

## Backup Strategy

### Database Backup (PostgreSQL)

**Backup Components:**
1. Schema (DDL)
2. Data (all tables)
3. Indexes
4. Triggers and functions
5. User roles and permissions

**Backup Methods:**

**Method 1: Daily Automated Backup**
```bash
#!/bin/bash
# /opt/gs-infotech/scripts/backup-database-daily.sh
# Runs daily at 2 AM via cron

BACKUP_DIR="/backups/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/gs_infotech_$TIMESTAMP.dump"

# Create directory
mkdir -p $BACKUP_DIR

# Backup using custom format (allows selective restore)
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d gs_infotech \
  -F custom \
  -b \
  -v \
  -f /backups/$TIMESTAMP.dump

if [ $? -eq 0 ]; then
    echo "✓ Database backup successful: $BACKUP_FILE"
    
    # Compress for storage
    gzip $BACKUP_FILE
    
    # Upload to S3
    aws s3 cp "$BACKUP_FILE.gz" s3://gs-infotech-backups/daily/
    
    # Keep only last 30 days locally
    find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete
    
    # Log backup
    echo "$(date): Backup $BACKUP_FILE.gz completed" >> /var/log/backups.log
else
    echo "✗ Database backup failed"
    exit 1
fi
```

**Method 2: Streaming Backup (WAL Archiving)**
```bash
# For point-in-time recovery (PITR)
# Configure in postgresql.conf:

wal_level = replica
archive_mode = on
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
archive_timeout = 300

# Backup base directory
tar -czf /backups/pg_base_backup_$(date +%Y%m%d).tar.gz /var/lib/postgresql/main

# Restore from base backup + WAL
# 1. Stop PostgreSQL
# 2. Extract base backup to data directory
# 3. Create recovery.conf pointing to archive location
# 4. Start PostgreSQL (it will replay WAL until specified time)
```

**Method 3: AWS RDS Snapshots**
```bash
# If using managed AWS RDS instead of Docker

# Automatic snapshots (set retention)
aws rds modify-db-instance \
  --db-instance-identifier gs-infotech-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "02:00-03:00"

# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier gs-infotech-prod \
  --db-snapshot-identifier gs-infotech-manual-$(date +%Y%m%d-%H%M%S)

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier gs-infotech-restored \
  --db-snapshot-identifier gs-infotech-manual-20260816
```

### Application Data Backup

**Files to Backup:**
- Application source code
- Configuration files (.env production)
- SSL certificates
- SSH keys
- Database migrations

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/backup-application.sh

BACKUP_DIR="/backups/application"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup application code
tar -czf $BACKUP_DIR/app-code-$TIMESTAMP.tar.gz \
  --exclude node_modules \
  --exclude .git \
  /opt/gs-infotech

# Backup configuration
tar -czf $BACKUP_DIR/app-config-$TIMESTAMP.tar.gz \
  /opt/gs-infotech/.env.production \
  /opt/gs-infotech/docker-compose.yml

# Backup SSL certificates
tar -czf $BACKUP_DIR/ssl-certs-$TIMESTAMP.tar.gz \
  /etc/letsencrypt/live/

# Upload to S3
aws s3 cp $BACKUP_DIR/app-code-$TIMESTAMP.tar.gz s3://gs-infotech-backups/application/
aws s3 cp $BACKUP_DIR/app-config-$TIMESTAMP.tar.gz s3://gs-infotech-backups/application/
aws s3 cp $BACKUP_DIR/ssl-certs-$TIMESTAMP.tar.gz s3://gs-infotech-backups/application/
```

### Redis Backup (Cache)

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/backup-redis.sh

# Trigger RDB snapshot
docker-compose exec -T redis redis-cli BGSAVE

# Wait for completion
sleep 5

# Copy to backup directory
docker cp gs-infotech-cache:/data/dump.rdb /backups/redis/dump_$(date +%Y%m%d_%H%M%S).rdb

# Compress
gzip /backups/redis/dump_*.rdb

# Upload to S3
aws s3 sync /backups/redis s3://gs-infotech-backups/redis/ --delete
```

### Backup Verification

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/verify-backup.sh
# Run weekly to ensure backups are restorable

BACKUP_FILE=$1
TEST_DB="gs_infotech_restore_test"

echo "Verifying backup: $BACKUP_FILE"

# Step 1: Create test database
createdb $TEST_DB || { echo "Failed to create test DB"; exit 1; }

# Step 2: Restore backup
pg_restore -d $TEST_DB $BACKUP_FILE 2>&1 | head -20
if [ $? -ne 0 ]; then
    echo "✗ Restore failed"
    dropdb $TEST_DB
    exit 1
fi

# Step 3: Verify data integrity
ASSET_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM assets;")
MOVEMENT_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM asset_movements;")

echo "Restored data:"
echo "  Assets: $ASSET_COUNT"
echo "  Movements: $MOVEMENT_COUNT"

# Step 4: Check for corruption
psql -d $TEST_DB -c "
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname != 'pg_catalog'
  ORDER BY tablename;
" | wc -l > /tmp/table_count

if [ $(cat /tmp/table_count) -lt 5 ]; then
    echo "✗ Too few tables restored (possible corruption)"
    dropdb $TEST_DB
    exit 1
fi

# Step 5: Cleanup
dropdb $TEST_DB

echo "✓ Backup verification successful"
```

---

## Restore Procedures

### Full Database Restore (Complete Data Loss)

**Scenario:** Database corrupted, all data lost, need to restore from backup

**Steps:**

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/restore-full-database.sh

BACKUP_FILE=$1  # e.g., /backups/daily/gs_infotech_20260816_020000.dump

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -lah /backups/daily/*.dump* 2>/dev/null || echo "No backups found"
    exit 1
fi

echo "🔄 FULL DATABASE RESTORE INITIATED"
echo "Backup file: $BACKUP_FILE"

# Step 1: Stop application
echo "Stopping application..."
docker-compose stop api web

# Step 2: Backup current database (for forensics)
echo "Backing up current database (for evidence)..."
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d gs_infotech \
  -F custom \
  -f /backups/corrupted_$(date +%Y%m%d_%H%M%S).dump

# Step 3: Drop current database
echo "Dropping corrupted database..."
docker-compose exec -T postgres dropdb -U postgres gs_infotech

# Step 4: Restore from backup
echo "Restoring from backup..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | \
    docker-compose exec -T postgres pg_restore \
      -U postgres \
      -d postgres \
      --create
else
    docker-compose exec -T postgres pg_restore \
      -U postgres \
      -d postgres \
      --create \
      -f - < "$BACKUP_FILE"
fi

if [ $? -ne 0 ]; then
    echo "✗ Restore failed"
    exit 1
fi

# Step 5: Verify restore
echo "Verifying restore..."
docker-compose exec -T postgres psql -U postgres -d gs_infotech -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Step 6: Start application
echo "Starting application..."
docker-compose up -d api web

# Step 7: Run smoke tests
sleep 10
curl http://localhost:3000/health
if [ $? -eq 0 ]; then
    echo "✓ Full database restore completed successfully"
else
    echo "✗ Post-restore validation failed"
    exit 1
fi
```

**Time Required:** 30-60 minutes (depending on database size)

**Verification Checklist:**
- [ ] Database is accessible
- [ ] All tables present (COUNT(*) tables = X)
- [ ] All data present (row counts match)
- [ ] API health check passing
- [ ] Web application loading
- [ ] Login functionality working
- [ ] Asset queries returning data

---

### Point-in-Time Recovery (PITR)

**Scenario:** Need to recover to specific point in time (e.g., 2 hours ago before accidental delete)

**Prerequisites:** WAL archiving enabled

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/pitr-restore.sh

TARGET_TIME=$1  # Format: "2026-08-16 10:00:00"

if [ -z "$TARGET_TIME" ]; then
    echo "Usage: $0 '2026-08-16 10:00:00'"
    exit 1
fi

echo "🔄 POINT-IN-TIME RECOVERY INITIATED"
echo "Target time: $TARGET_TIME"

# Step 1: Stop PostgreSQL
docker-compose stop postgres

# Step 2: Rename current data directory
mv /var/lib/postgresql/data /var/lib/postgresql/data.corrupted

# Step 3: Extract base backup
tar -xzf /archive/pg_base_backup_latest.tar.gz -C /var/lib/postgresql/

# Step 4: Create recovery.conf
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'cp /archive/%f %p'
recovery_target_time = '${TARGET_TIME}'
recovery_target_timeline = 'latest'
EOF

# Step 5: Start PostgreSQL
docker-compose up -d postgres

# Step 6: Monitor recovery progress
# PostgreSQL will replay WAL files until target time
docker-compose logs -f postgres | grep "recovery"

# Once recovery completes, verify
docker-compose exec postgres psql -U postgres -d gs_infotech -c "SELECT NOW();"

echo "✓ PITR completed to: $TARGET_TIME"
```

---

### Selective Table Restore

**Scenario:** Single table corrupted, restore only that table

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/restore-table.sh

BACKUP_FILE=$1
TABLE_NAME=$2

if [ -z "$BACKUP_FILE" ] || [ -z "$TABLE_NAME" ]; then
    echo "Usage: $0 <backup_file> <table_name>"
    echo "Example: $0 /backups/daily/gs_infotech_20260816_020000.dump assets"
    exit 1
fi

echo "Restoring table: $TABLE_NAME from $BACKUP_FILE"

# Extract only specific table from backup
pg_restore -d gs_infotech \
  -t $TABLE_NAME \
  $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✓ Table $TABLE_NAME restored successfully"
else
    echo "✗ Table restore failed"
    exit 1
fi
```

---

## Data Recovery from Corruption

### Detecting Corruption

```bash
# PostgreSQL built-in integrity check
docker-compose exec postgres psql -U postgres -d gs_infotech -c "
  CREATE EXTENSION IF NOT EXISTS amcheck;
  SELECT bt_index_check(index_oid::regclass)
  FROM (
    SELECT indexrelid FROM pg_index
    WHERE indrelname = 'assets'
  ) t(index_oid);
"

# Check for NULL constraint violations
psql -d gs_infotech -c "
  SELECT * FROM assets WHERE id IS NULL OR tenant_id IS NULL;
"

# Check for orphaned records
psql -d gs_infotech -c "
  SELECT a.id FROM assets a
  LEFT JOIN tenants t ON a.tenant_id = t.id
  WHERE t.id IS NULL;
"
```

### Recovery from Corruption

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/recover-corruption.sh

echo "🔧 CORRUPTION RECOVERY INITIATED"

# Step 1: Identify corruption
psql -d gs_infotech -c "
  SELECT schemaname, tablename
  FROM pg_stat_user_tables
  WHERE schemaname != 'pg_catalog'
  ORDER BY tablename;
" > /tmp/tables.txt

# Step 2: Backup corrupted data for forensics
pg_dump -d gs_infotech -F custom -f /backups/corrupted-$(date +%s).dump

# Step 3: Restore from backup
# See "Full Database Restore" section above

# Step 4: Verify no corruption after restore
docker-compose exec postgres psql -U postgres -d gs_infotech -c "
  SELECT COUNT(*) as orphaned_records FROM assets a
  LEFT JOIN tenants t ON a.tenant_id = t.id
  WHERE t.id IS NULL;
"

# If count > 0, there's still data integrity issues
```

---

## Geographic Failover

### Multi-Region Setup

**Architecture:**
```
Primary Region (us-east-1)
├── API Servers (EC2)
├── RDS Primary (PostgreSQL)
└── RDS Read Replica (us-west-2)

Secondary Region (us-west-2)
├── Standby API Servers
├── RDS Read Replica
└── Route53 health check → failover
```

### Failover Procedure

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/failover-to-secondary.sh

echo "🚨 INITIATING GEOGRAPHIC FAILOVER"

# Step 1: Verify primary is down
curl -s http://api.gs-infotech.com/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✗ Primary is still responding, aborting failover"
    exit 1
fi

# Step 2: Promote read replica to primary
aws rds promote-read-replica \
  --db-instance-identifier gs-infotech-us-west-2 \
  --backup-retention-period 7

# Wait for promotion (may take 5-10 minutes)
echo "Waiting for replica promotion..."
sleep 60

# Step 3: Update Route53 to point to secondary
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.gs-infotech.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "54.123.45.67"}]
      }
    }]
  }'

# Step 4: Verify secondary is responding
sleep 30
for i in {1..10}; do
    curl -s http://api.gs-infotech.com/health && echo "✓ Secondary responding" && break
    echo "Waiting for secondary... attempt $i/10"
    sleep 10
done

# Step 5: Notify team
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"✓ Geographic failover to us-west-2 completed"}'

# Step 6: Begin investigation of primary region
echo "Begin investigation of primary region failure"
```

### Failback to Primary

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/failback-to-primary.sh

echo "🔄 FAILBACK TO PRIMARY INITIATED"

# Step 1: Verify primary is recovered
curl -s http://54.123.45.67/health > /dev/null  # Primary IP
if [ $? -ne 0 ]; then
    echo "✗ Primary is not responding, aborting failback"
    exit 1
fi

# Step 2: Create new read replica in secondary region
aws rds create-db-instance-read-replica \
  --db-instance-identifier gs-infotech-us-west-2-new \
  --source-db-instance-identifier gs-infotech-us-east-1

# Wait for replica creation
echo "Creating new read replica... (15-20 minutes)"
sleep 900

# Step 3: Verify replica is in sync
aws rds describe-db-instances \
  --db-instance-identifier gs-infotech-us-west-2-new \
  --query 'DBInstances[0].DBInstanceStatus'

# Step 4: Update Route53 to point back to primary
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.gs-infotech.com",
        "Type": "A",
        "TTL": 300,
        "SetIdentifier": "primary",
        "FailoverRoutingPolicy": {"Type": "PRIMARY"},
        "ResourceRecords": [{"Value": "54.123.45.67"}]
      }
    }]
  }'

# Step 5: Verify traffic routing to primary
sleep 30
curl -I http://api.gs-infotech.com/health

echo "✓ Failback to primary completed"
```

---

## Testing Backup Recovery

### Monthly Backup Test

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/test-backup-recovery.sh
# Run 1st Sunday of month at 6 AM

BACKUP_FILE=$(ls -t /backups/daily/*.dump.gz | head -1)
TEST_DB="gs_infotech_recovery_test_$(date +%s)"

echo "🧪 BACKUP RECOVERY TEST INITIATED"
echo "Test database: $TEST_DB"
echo "Backup file: $BACKUP_FILE"

# Step 1: Create test database
createdb $TEST_DB

# Step 2: Restore backup
echo "Restoring backup..."
gunzip -c $BACKUP_FILE | pg_restore -d $TEST_DB 2>&1

if [ $? -ne 0 ]; then
    echo "✗ Restore failed"
    dropdb $TEST_DB
    exit 1
fi

# Step 3: Run recovery tests
echo "Running recovery tests..."

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: All tables present
TABLE_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
if [ "$TABLE_COUNT" -gt 5 ]; then
    echo "✓ Table count verified: $TABLE_COUNT"
    ((TESTS_PASSED++))
else
    echo "✗ Too few tables: $TABLE_COUNT"
    ((TESTS_FAILED++))
fi

# Test 2: Data integrity
ASSET_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM assets;")
echo "✓ Asset count: $ASSET_COUNT"
((TESTS_PASSED++))

# Test 3: Check for NULL constraints
NULL_IDS=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM assets WHERE id IS NULL;")
if [ "$NULL_IDS" -eq 0 ]; then
    echo "✓ No NULL primary keys"
    ((TESTS_PASSED++))
else
    echo "✗ Found $NULL_IDS NULL primary keys"
    ((TESTS_FAILED++))
fi

# Test 4: Verify indexes
INDEX_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")
echo "✓ Index count: $INDEX_COUNT"
((TESTS_PASSED++))

# Test 5: Run sample queries
QUERY_RESULT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM asset_movements;")
if [ $? -eq 0 ]; then
    echo "✓ Sample queries working"
    ((TESTS_PASSED++))
else
    echo "✗ Sample query failed"
    ((TESTS_FAILED++))
fi

# Step 4: Generate report
cat > /reports/backup-recovery-test-$(date +%Y%m%d).txt <<EOF
Backup Recovery Test Report
Date: $(date)
Backup File: $BACKUP_FILE

Results:
  Tests Passed: $TESTS_PASSED
  Tests Failed: $TESTS_FAILED
  Status: $([ $TESTS_FAILED -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL")

Details:
  Tables: $TABLE_COUNT
  Assets: $ASSET_COUNT
  Movements: $QUERY_RESULT
  Indexes: $INDEX_COUNT
EOF

# Step 5: Cleanup
dropdb $TEST_DB

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✓ Backup recovery test passed"
    exit 0
else
    echo "✗ Backup recovery test failed"
    # Send alert
    curl -X POST $SLACK_WEBHOOK_URL \
      -d '{"text":"🚨 Monthly backup recovery test FAILED - investigation needed"}'
    exit 1
fi
```

Schedule via cron:
```bash
# First Sunday of month at 6 AM
0 6 * * 0 if [ $(date +\%d) -le 07 ]; then /opt/gs-infotech/scripts/test-backup-recovery.sh; fi
```

---

## Incident Post-Mortems

### Post-Mortem Template

```markdown
# Incident Post-Mortem

**Incident ID:** INC-2026-08-16-0001  
**Date of Incident:** 2026-08-16  
**Post-Mortem Date:** 2026-08-17  
**Participants:** [List attendees]

## Executive Summary
[1-2 sentence summary of incident impact]

## Timeline

| Time | Event |
|------|-------|
| 10:05 | Incident detected via monitoring alert |
| 10:15 | Incident response team assembled |
| 10:30 | Root cause identified: database connection pool exhausted |
| 11:00 | Temporary mitigation: restarted API service |
| 11:15 | Permanent fix: increased connection pool size |
| 11:30 | Service fully recovered |

**Total Downtime:** 25 minutes

## Impact Assessment

- **Users Affected:** 500+ concurrent users
- **Revenue Impact:** $X,XXX
- **Data Loss:** None
- **Customer Complaints:** 15 support tickets

## Root Cause Analysis

### Primary Cause
Database connection pool limit reached (200 connections)

### Contributing Factors
1. Long-running query (took 5 minutes instead of normal 100ms)
2. New report feature added that opened connection per user
3. No monitoring on connection pool utilization
4. Database pool size not reviewed in 6 months

### Why It Wasn't Caught Earlier
- No alerting on connection pool usage
- No automated capacity planning
- Missing performance review process

## Resolution

### Temporary Fix (Applied within 1 hour)
- Restarted API to clear hung connections
- This provided 25 minutes of uptime until problem recurred

### Permanent Fix (Applied same day)
- Increased max_connections from 200 to 300
- Increased application pool size from 20 to 30
- Added query timeout of 10 minutes
- Optimized slow report query with index

### Verification
- Ran load test simulating 1000 concurrent users: ✓ Pass
- Verified no connection pool exhaustion: ✓ Pass
- Confirmed query now completes in <100ms: ✓ Pass

## Preventive Measures

### Immediate (This week)
- [ ] Deploy connection pool monitoring dashboard
- [ ] Set alert if pool usage > 80%
- [ ] Update runbook with connection pool troubleshooting
- [ ] Train team on new monitoring tools

### Short-term (Within 1 month)
- [ ] Implement automatic query logging for duration > 1 second
- [ ] Add query optimizer to code review checklist
- [ ] Schedule quarterly database capacity review
- [ ] Add connection pooling to pre-deployment checklist

### Long-term (Within 3 months)
- [ ] Implement connection pooling proxy (PgBouncer) for better management
- [ ] Add application performance monitoring (APM) tool
- [ ] Establish automated capacity planning process
- [ ] Document connection pooling best practices for engineers

## Action Items

| Owner | Action | Due Date | Priority |
|-------|--------|----------|----------|
| DevOps | Deploy Prometheus connection pool monitoring | 2026-08-18 | P0 |
| Backend Lead | Optimize report query | 2026-08-19 | P0 |
| DevOps | Update alert thresholds | 2026-08-20 | P1 |
| Team Lead | Schedule post-incident training | 2026-08-25 | P2 |

## Lessons Learned

### What Went Well
- Rapid response (10 minutes detection to action)
- Good communication throughout incident
- Clear escalation path enabled quick decision-making

### What Could Improve
- Earlier detection with proper monitoring would have prevented incident
- Query performance profiling as part of deployment would catch slow queries
- Capacity planning should be ongoing, not reactive

### Knowledge Sharing
- [ ] Incident presentation to all engineering team
- [ ] Add to troubleshooting playbook
- [ ] Create training video on connection pool monitoring
- [ ] Share findings in engineering wiki

## Sign-off

- [ ] CTO: ___________________  Date: ______
- [ ] Team Lead: ___________________  Date: ______
- [ ] On-call Engineer: ___________________  Date: ______
```

---

## Lessons Learned Tracking

### Lessons Learned Database

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/track-lessons-learned.sh

cat >> /var/log/lessons-learned.txt <<EOF
Date: $(date)
Incident: $1
Lesson: $2
Category: [Performance|Security|Reliability|Process]
Action Items: $3
Status: Open

---
EOF
```

### Quarterly Review

```bash
#!/bin/bash
# /opt/gs-infotech/scripts/quarterly-lessons-review.sh
# Run Q1, Q2, Q3, Q4

echo "=== Quarterly Lessons Learned Review ==="
echo "Quarter: $(date +%q) $(date +%Y)"

# Step 1: Aggregate lessons
grep "Status: Open" /var/log/lessons-learned.txt | wc -l > /tmp/open_items
OPEN_ITEMS=$(cat /tmp/open_items)
echo "Open action items: $OPEN_ITEMS"

# Step 2: Identify trends
echo "Top incident categories:"
awk -F: '/Category:/ {print $2}' /var/log/lessons-learned.txt | sort | uniq -c | sort -rn | head -5

# Step 3: Review completion rate
echo "Action items completed this quarter:"
grep -c "Status: Closed" /var/log/lessons-learned.txt

# Step 4: Generate report for team
cat > /reports/lessons-learned-q$(date +%q)-$(date +%Y).md <<EOF
# Quarterly Lessons Learned Report

**Period:** Q$(date +%q) $(date +%Y)

## Summary
Total incidents: X
Open action items: $OPEN_ITEMS
Completion rate: XX%

## Top Root Causes
1. [Category with most incidents]
2. [Category with second most]
3. [Category with third most]

## Top Preventive Measures Implemented
1. [Measure 1]
2. [Measure 2]
3. [Measure 3]

## Recommendations for Next Quarter
1. Focus on [top category] incidents
2. Implement [monitoring/process]
3. Training on [topic]
EOF

# Step 5: Present to team
echo "✓ Quarterly review complete - see /reports/lessons-learned-q$(date +%q)-$(date +%Y).md"
```

---

## Emergency Contacts

**Save these in your phone:**

| Role | Name | Phone | Email | Notes |
|------|------|-------|-------|-------|
| CTO | [Name] | +1-XXX-XXX-XXXX | email@example.com | Primary escalation |
| On-Call Engineer | [Name] | +1-XXX-XXX-XXCK | email@example.com | Rotating weekly |
| Database Admin | [Name] | +1-XXX-XXX-XXXX | email@example.com | Database recovery specialist |
| Infrastructure Lead | [Name] | +1-XXX-XXX-XXXX | email@example.com | Failover/infrastructure issues |

---

## Quick Reference Checklist

### P1 Incident Response (First 30 minutes)

- [ ] Declare incident in Slack #incidents channel
- [ ] Start bridge call: zoom.us/j/[id]
- [ ] Gather team (CTO, Tech Lead, On-Call Engineer)
- [ ] Assess impact: users affected, revenue impact
- [ ] Implement temporary fix (if exists) or document mitigation
- [ ] Begin root cause investigation
- [ ] Send customer notification if SLA violated
- [ ] Assign owner for each recovery step

### Backup Restore (First check)

1. **Is backup file accessible?**
   - `ls -lah /backups/daily/gs_infotech_*.dump* | head -5`

2. **Is backup valid?**
   - `pg_restore --list /backups/daily/gs_infotech_*.dump | wc -l`

3. **Do we have space for restore?**
   - `df -h /var/lib/postgresql`

4. **How long will restore take?**
   - ~5 minutes per 1GB of backup
   - Larger database = longer restore

---

**Document Version:** 1.0  
**Last Reviewed:** August 16, 2026  
**Next Review:** November 16, 2026  
**Owner:** DevOps Team  
**Approver:** CTO

**Emergency Contact:** [CTO Phone]  
**Update Frequency:** As needed when incidents occur  
**Backup Test Schedule:** 1st Sunday of month @ 6 AM
