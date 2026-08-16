// Suppress Rollup bundle size warnings during development
if (process.env.NODE_ENV === 'development') {
  // Override process.emitWarning to filter out Rollup warnings
  const originalEmitWarning = process.emitWarning;
  (process as any).emitWarning = function(this: NodeJS.Process, warning: Error | string, type?: string, code?: string) {
    if (typeof warning === 'string') {
      // Filter out Rollup bundle size warnings
      if (warning.includes('build.rollupOptions.output.manualChunks') ||
          warning.includes('improve chunking') ||
          warning.includes('Bundle is larger than recommended limit') ||
          warning.includes('chunkSizeWarningLimit')) {
        return;
      }
    }
    return (originalEmitWarning as any).call(this, warning, type, code);
  };

  // Override console.warn to filter out Rollup warnings
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    const message = args.join(' ');
    
    // Filter out Rollup bundle size warnings
    if (message.includes('build.rollupOptions.output.manualChunks') ||
        message.includes('improve chunking') ||
        message.includes('https://rollupjs.org/configuration-options/#output-manualchunks') ||
        message.includes('Adjust chunk size limit for this warning via build.chunkSizeWarningLimit')) {
      return;
    }
    
    // Show other warnings
    originalConsoleWarn.apply(console, args);
  };
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import connectDB from "./connectDB";
import { storage } from "./storage-mongodb";
import mongoose from "mongoose";
import { logger } from "./utils/logger.js";
import { setupSecurityMiddleware } from "./middleware/securityMiddleware.js";

const app = express();
// Trust proxy for rate limiting and security middleware
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Setup security middleware
setupSecurityMiddleware(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);

      // Also log to persistent logger
      logger.logApiRequest(req.method, path, res.statusCode, duration, (req as any).userId);
    }
  });

  next();
});

(async () => {
  // Connect to MongoDB Atlas
  await connectDB();
  
  // Skip default admin user creation - secure admin already exists
  console.log('✅ Using existing secure admin credentials');

  // Check for emergency admin creation from environment variables
  try {
    const { createEmergencyAdmin } = await import("./admin-recovery");
    await createEmergencyAdmin();
  } catch (error) {
    // Silently continue if emergency admin creation fails
  }
  
  const server = await registerRoutes(app);
  
  // Store server instance globally for notifications
  (global as any).notificationServer = server;

  // Lightweight health endpoint for production deployment checks. Keeping this
  // independent from tenant/session state makes it safe for load balancers.
  const healthHandler = (_req: any, res: Response) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({
      ok: dbConnected,
      service: 'fleetpro',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Unhandled request error:', err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    // Do not rethrow after sending the response. A single request error must
    // never crash the production CRM process.
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5050 (production)
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5050;
  const host = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging' ? '0.0.0.0' : 'localhost';
  server.listen({
    port,
    host,
  }, () => {
    log(`serving on ${host}:${port}`);
  });

  // Start background job to automatically mark expired bookings as completed
  // Check every 5 minutes (300000 ms) and only if database is connected
  let backgroundJobInterval: NodeJS.Timeout;
  
  // Only start background job if MongoDB connects successfully
  mongoose.connection.on('connected', () => {
    if (backgroundJobInterval) {
      clearInterval(backgroundJobInterval);
    }
    log('MongoDB connected - starting background job');
    backgroundJobInterval = setInterval(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          const completedCount = await storage.markExpiredBookingsAsCompleted();
          if (completedCount > 0) {
            log(`Marked ${completedCount} expired booking(s) as completed`);
          }
        }
      } catch (error) {
        console.error(`Error in background job:`, error);
      }
    }, 300000); // 5 minutes
  });
  
  // Stop background job if MongoDB disconnects
  mongoose.connection.on('disconnected', () => {
    if (backgroundJobInterval) {
      clearInterval(backgroundJobInterval);
      log('MongoDB disconnected - stopped background job');
    }
  });

  // Cleanup on process termination
  process.on('SIGINT', () => {
    clearInterval(backgroundJobInterval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(backgroundJobInterval);
    process.exit(0);
  });
})();
