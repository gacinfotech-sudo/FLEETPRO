import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/fleetpro';

    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
    });
    
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    
    // Provide specific help for IP whitelist issues
    if (error instanceof Error && error.message.includes('IP')) {
      console.error('\n🔧 QUICK FIX: MongoDB Atlas IP Access Configuration');
      console.error('1. Go to https://cloud.mongodb.com');
      console.error('2. Select your project → Network Access');
      console.error('3. Click "Add IP Address"');
      console.error('4. Choose "Allow Access from Anywhere" (0.0.0.0/0) for development');
      console.error('5. Wait 1-2 minutes for changes to apply\n');
    }
    
    console.error('Falling back to in-memory storage for development...');
    // Don't exit, let the app continue with issues logged
  }
};

export default connectDB;