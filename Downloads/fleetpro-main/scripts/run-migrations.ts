import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import all models
import {
  Tenant,
  User,
  Vehicle,
  Driver,
  Booking,
  Expense,
  DriverSalary,
  SalaryHistory,
  SalaryAuditTrail,
  Attendance,
  LeaveType,
  DriverLeave,
  LeaveAccrual,
  OnboardingChecklist,
  ServiceTicket,
  FieldVisit,
  SLAMetrics,
  Plan,
  Subscription,
  SaaSInvoice,
  SaaSPayment,
  UsageLog,
  EntitlementLog
} from '../server/models/index.js';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/fleetpro';

const migrationReport = {
  timestamp: new Date().toISOString(),
  status: 'pending',
  collections: [] as any[],
  indexes: [] as any[],
  errors: [] as any[],
};

async function runMigrations() {
  try {

    // Connect to MongoDB
    const conn = await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });


    // Initialize collections and indexes
    const models = [
      { name: 'Tenant', model: Tenant },
      { name: 'User', model: User },
      { name: 'Vehicle', model: Vehicle },
      { name: 'Driver', model: Driver },
      { name: 'Booking', model: Booking },
      { name: 'Expense', model: Expense },
      { name: 'DriverSalary', model: DriverSalary },
      { name: 'SalaryHistory', model: SalaryHistory },
      { name: 'SalaryAuditTrail', model: SalaryAuditTrail },
      { name: 'Attendance', model: Attendance },
      { name: 'LeaveType', model: LeaveType },
      { name: 'DriverLeave', model: DriverLeave },
      { name: 'LeaveAccrual', model: LeaveAccrual },
      { name: 'OnboardingChecklist', model: OnboardingChecklist },
      { name: 'ServiceTicket', model: ServiceTicket },
      { name: 'FieldVisit', model: FieldVisit },
      { name: 'SLAMetrics', model: SLAMetrics },
      { name: 'Plan', model: Plan },
      { name: 'Subscription', model: Subscription },
      { name: 'SaaSInvoice', model: SaaSInvoice },
      { name: 'SaaSPayment', model: SaaSPayment },
      { name: 'UsageLog', model: UsageLog },
      { name: 'EntitlementLog', model: EntitlementLog }
    ];


    for (const { name, model } of models) {
      try {
        // Ensure collection exists
        const collectionInfo = await model.collection.getStats();

        migrationReport.collections.push({
          name,
          status: 'exists',
          documentCount: collectionInfo.count
        });
      } catch (err) {
        // Collection doesn't exist, create it
        try {
          await model.collection.createIndex({ _id: 1 });

          migrationReport.collections.push({
            name,
            status: 'created',
            documentCount: 0
          });
        } catch (createError) {
          console.error(`❌ ${name.padEnd(25)} | Error:`, createError instanceof Error ? createError.message : createError);
          migrationReport.errors.push({
            collection: name,
            error: createError instanceof Error ? createError.message : String(createError)
          });
        }
      }
    }


    // Build indexes for all models
    for (const { name, model } of models) {
      try {
        const indexInfo = await model.collection.getIndexes();
        const indexCount = Object.keys(indexInfo).length;

        migrationReport.indexes.push({
          name,
          indexCount,
          indexes: Object.keys(indexInfo)
        });
      } catch (err) {
        console.error(`⚠️  ${name.padEnd(25)} | Index creation issue:`, err instanceof Error ? err.message : err);
      }
    }


    // Check schema validators
    const schemaInfo = {
      totalCollections: models.length,
      collectionsWithData: migrationReport.collections.filter(c => c.documentCount > 0).length,
      collectionsEmpty: migrationReport.collections.filter(c => c.documentCount === 0).length,
      totalIndexes: migrationReport.indexes.reduce((sum, idx) => sum + idx.indexCount, 0)
    };


    // Verify specific collections

    const keyCollections = ['User', 'Tenant', 'Vehicle', 'Driver', 'Booking'];
    for (const collName of keyCollections) {
      const info = migrationReport.collections.find(c => c.name === collName);
      if (info) {
        const status = info.status === 'exists' ? '✅' : '✨';
      }
    }


    // List all collections
    const collections = await conn.connection.db?.listCollections().toArray();
    if (collections && collections.length > 0) {
      for (const coll of collections) {
      }
    }

    migrationReport.status = migrationReport.errors.length === 0 ? 'success' : 'partial_success';

    if (migrationReport.errors.length === 0) {
    } else {
    }

    // Save migration report
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(
      path.join(process.cwd(), 'migration-report.json'),
      JSON.stringify(migrationReport, null, 2)
    );

    // Disconnect
    await mongoose.disconnect();

    process.exit(migrationReport.errors.length === 0 ? 0 : 1);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    migrationReport.status = 'failed';
    migrationReport.errors.push({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(
      path.join(process.cwd(), 'migration-report.json'),
      JSON.stringify(migrationReport, null, 2)
    );

    process.exit(1);
  }
}

// Run migrations
runMigrations();
