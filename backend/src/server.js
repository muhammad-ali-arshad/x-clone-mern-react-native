import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";

import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import commentRoutes from "./routes/comment.route.js";
import notificationRoutes from "./routes/notification.route.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { arcjetMiddleware } from "./middleware/arcjet.middleware.js";
import { ensureDBConnection } from "./middleware/db.middleware.js";

const app = express();

// Production safety: Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, log but don't crash (Vercel serverless)
  if (ENV.NODE_ENV === 'production') {
    console.error('⚠️  Unhandled rejection logged. Serverless function will continue.');
  }
});

// Production safety: Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // In production, log but don't crash (Vercel serverless)
  if (ENV.NODE_ENV === 'production') {
    console.error('⚠️  Uncaught exception logged. Serverless function will continue.');
  } else {
    // In development, exit to prevent undefined behavior
    process.exit(1);
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware (Vercel has 10s timeout for Hobby, 60s for Pro)
// Set a safety timeout slightly below Vercel's limit
const REQUEST_TIMEOUT = 50000; // 50 seconds (safety margin for Vercel's 60s limit)
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT, () => {
    if (!res.headersSent) {
      res.status(504).json({
        error: "Request timeout",
        message: "The request took too long to process. Please try again.",
      });
    }
  });
  next();
});

// Clerk middleware - handles authentication
try {
  if (!ENV.CLERK_SECRET_KEY) {
    console.error("❌ CLERK_SECRET_KEY is not set. Protected routes will fail.");
    // In production, this is critical - but don't exit in serverless
    if (ENV.NODE_ENV === "production") {
      console.error("⚠️  Running without Clerk authentication. Protected routes will return 500 errors.");
    }
  } else {
    app.use(clerkMiddleware());
    console.log("✅ Clerk middleware initialized");
  }
} catch (error) {
  console.error("❌ Clerk middleware initialization error:", error);
  // In production, log but continue (serverless functions can't exit)
  if (ENV.NODE_ENV === "production") {
    console.error("⚠️  Server will continue but protected routes may fail.");
  }
}

// Arcjet middleware - rate limiting and security
app.use(arcjetMiddleware);

// Health check route (no DB needed)
app.get("/", (req, res) => res.send("Hello from server"));
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV || "development",
  });
});

// MongoDB health check route
app.get("/api/health/db", async (req, res) => {
  // Ensure response is always sent (timeout safety)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        status: "timeout",
        message: "Health check timed out",
        timestamp: new Date().toISOString(),
      });
    }
  }, 10000); // 10 second timeout for health check

  try {
    const mongoose = (await import("mongoose")).default;
    const readyState = mongoose.connection.readyState;
    
    // readyState values: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (readyState === 1) {
      // Verify connection is actually working with a ping
      try {
        await Promise.race([
          mongoose.connection.db.admin().ping(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Ping timeout")), 5000)
          )
        ]);
        
        clearTimeout(timeout);
        return res.status(200).json({
          status: "connected",
          readyState: readyState,
          database: mongoose.connection.db?.databaseName || "unknown",
          timestamp: new Date().toISOString(),
        });
      } catch (pingError) {
        clearTimeout(timeout);
        console.error("MongoDB ping failed:", pingError.message);
        return res.status(503).json({
          status: "not_connected",
          readyState: readyState,
          error: "Connection ping failed",
          timestamp: new Date().toISOString(),
        });
      }
    } else if (readyState === 2) {
      clearTimeout(timeout);
      return res.status(503).json({
        status: "connecting",
        readyState: readyState,
        message: "Database connection in progress",
        timestamp: new Date().toISOString(),
      });
    } else {
      clearTimeout(timeout);
      return res.status(503).json({
        status: "not_connected",
        readyState: readyState,
        message: "Database not connected",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    clearTimeout(timeout);
    console.error("MongoDB health check error:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        status: "error",
        error: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// All API routes require DB connection
app.use("/api/users", ensureDBConnection, userRoutes);
app.use("/api/posts", ensureDBConnection, postRoutes);
app.use("/api/comments", ensureDBConnection, commentRoutes);
app.use("/api/notifications", ensureDBConnection, notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// error handling middleware (must be last)
app.use((err, req, res, next) => {
  // Ensure response is always sent
  if (res.headersSent) {
    return next(err); // Let Express default handler deal with it
  }

  console.error("Unhandled error:", err.message || err);
  if (ENV.NODE_ENV !== "production") {
    console.error("Error stack:", err.stack);
  }
  
  // Don't leak error details in production
  const message = ENV.NODE_ENV === "production" 
    ? "Internal server error" 
    : err.message || "Internal server error";
  
  // Provide more context in development
  const response = ENV.NODE_ENV === "production"
    ? { error: message }
    : { 
        error: message,
        details: err.message,
        stack: err.stack
      };
  
  res.status(err.status || 500).json(response);
});

// Only start server in local development
if (ENV.NODE_ENV !== "production") {
  const startServer = async () => {
    try {
      await connectDB();
      app.listen(ENV.PORT || 3000, () => {
        console.log("Server is up and running on PORT:", ENV.PORT || 3000);
      });
    } catch (error) {
      console.error("Failed to start server:", error.message);
      process.exit(1);
    }
  };
  startServer();
}

// Export for Vercel serverless
export default app;