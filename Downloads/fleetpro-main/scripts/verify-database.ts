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

const verificationReport = {
  timestamp: new Date().toISOString(),
  status: 'pending',
  connection: {} as any,
  collections: [] as any[],
  indexes: [] as any[],
  validators: [] as any[],
  errors: [] as any[],
  warnings: [] as any[],
};

async function verifyDatabase() {
  try {

    // Connect to MongoDB
    const conn = await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });


    verificationReport.connection = {
      host: conn.connection.host,
      port: conn.connection.port,
      database: conn.connection.name,
      state: conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    };

    // Define all models for verification
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


    let totalDocuments = 0;
    for (const { name, model } of models) {
      try {
        const count = await model.countDocuments();
        totalDocuments += count;

        const schema = model.schema;
        const fieldCount = Object.keys(schema.paths).length;


        verificationReport.collections.push({
          name,
          status: 'verified',
          documentCount: count,
          fieldCount
        });
      } catch (err) {
        console.error(`❌ ${name.padEnd(25)} | Error:`, err instanceof Error ? err.message : err);
        verificationReport.errors.push({
          collection: name,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }


    let totalIndexes = 0;
    for (const { name, model } of models) {
      try {
        const indexInfo = await model.collection.getIndexes();
        const indexCount = Object.keys(indexInfo).length;
        totalIndexes += indexCount;

        // Get index details
        const indexNames = Object.keys(indexInfo);
        const indexDetails = indexNames.map(idx => {
          const spec = indexInfo[idx];
          if (spec.name === '_id_') return null;
          return `${idx}(${Object.keys(spec.key).join(',')})`;
        }).filter(Boolean);


        verificationReport.indexes.push({
          name,
          indexCount,
          indexes: indexNames
        });
      } catch (err) {
        console.error(`⚠️  ${name.padEnd(25)} | Error:`, err instanceof Error ? err.message : err);
      }
    }


    for (const { name, model } of models) {
      try {
        const schema = model.schema;
        const requiredFields = Object.entries(schema.paths)
          .filter(([_, path]: any) => path.isRequired)
          .map(([field]) => field);


        verificationReport.validators.push({
          name,
          requiredFieldCount: requiredFields.length,
          requiredFields: requiredFields.slice(0, 5) // Show first 5
        });
      } catch (err) {
        console.error(`⚠️  ${name.padEnd(25)} | Error:`, err instanceof Error ? err.message : err);
      }
    }


    // Get database stats
    const db = conn.connection.db;
    if (db) {
      const dbStats = await db.stats();
    }


    const keyCollections = ['User', 'Tenant', 'Vehicle', 'Driver', 'Booking', 'ServiceTicket', 'Plan', 'Subscription'];
    for (const collName of keyCollections) {
      const info = verificationReport.collections.find(c => c.name === collName);
      if (info) {
        const status = info.documentCount > 0 ? '✅' : '⚠️ ';
      }
    }


    // Check foreign key relationships
    const relationshipChecks = [
      { from: 'Vehicle', field: 'tenantId', to: 'Tenant', count: 0 },
      { from: 'Driver', field: 'tenantId', to: 'Tenant', count: 0 },
      { from: 'Booking', field: 'vehicleId', to: 'Vehicle', count: 0 },
      { from: 'DriverSalary', field: 'driverId', to: 'Driver', count: 0 }
    ];

    for (const check of relationshipChecks) {
      try {
        const samples = await (mongoose.model(check.from) as any)
          .find({ [check.field]: { $ne: null } })
          .limit(5)
          .lean();

        const status = samples.length > 0 ? '✅' : '⚠️ ';
      } catch (err) {
      }
    }

    if (verificationReport.errors.length === 0) {
      verificationReport.status = 'success';
    } else {
      verificationReport.status = 'partial_success';
    }


    // Save verification report
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(
      path.join(process.cwd(), 'verification-report.json'),
      JSON.stringify(verificationReport, null, 2)
    );

    // Disconnect
    await mongoose.disconnect();

    process.exit(verificationReport.errors.length === 0 ? 0 : 1);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    verificationReport.status = 'failed';
    verificationReport.errors.push({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(
      path.join(process.cwd(), 'verification-report.json'),
      JSON.stringify(verificationReport, null, 2)
    );

    process.exit(1);
  }
}

// Run verification
verifyDatabase();
