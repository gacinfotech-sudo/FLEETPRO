import mongoose from 'mongoose';

async function checkDeployment() {
  try {
    const conn = await mongoose.connect('mongodb://localhost:27017/fleetpro');
    const db = mongoose.connection;

    // Count all important collections
    const stats = {
      tenants: await db.collection('tenants').countDocuments(),
      users: await db.collection('users').countDocuments(),
      drivers: await db.collection('drivers').countDocuments(),
      vehicles: await db.collection('vehicles').countDocuments(),
      bookings: await db.collection('bookings').countDocuments(),
      subscriptions: await db.collection('subscriptions').countDocuments(),
      invoices: await db.collection('invoices').countDocuments(),
      plans: await db.collection('plans').countDocuments(),
    };


    // Get sample admin user
    const adminUser = await db.collection('users').findOne({ role: 'SUPERADMIN' });
    if (adminUser) {
    }

    // Check Redis
    const redis = await import('redis');
    const client = redis.createClient({ host: 'localhost', port: 6379 });
    client.on('error', (err) => console.error('Redis Client Error', err));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDeployment();
