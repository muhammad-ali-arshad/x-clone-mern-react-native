import mongoose from "mongoose";
import { ENV } from "./env.js";

// Cache the connection for serverless environments (Vercel-safe pattern)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  // Validate MONGODB_URI before attempting connection
  if (!ENV.MONGO_URI) {
    const error = new Error("MONGO_URI is not defined in environment variables");
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }

  // Validate MONGODB_URI format (basic check)
  if (!ENV.MONGO_URI.startsWith("mongodb://") && !ENV.MONGO_URI.startsWith("mongodb+srv://")) {
    const error = new Error("Invalid MONGODB_URI format");
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }

  // Extract database name for logging (without exposing credentials)
  try {
    const url = new URL(ENV.MONGO_URI);
    const dbName = url.pathname?.slice(1) || "default";
    console.log(`🔌 Attempting MongoDB connection to database: ${dbName}`);
  } catch (urlError) {
    // If URL parsing fails, log but continue (might be a valid connection string format)
    console.log("🔌 Attempting MongoDB connection...");
  }

  // If already connected and ready, return the existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection exists but is not ready, reset it
  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.log("🔄 Resetting stale MongoDB connection...");
    cached.conn = null;
    cached.promise = null;
  }

  // If connection is in progress, wait for it (prevents multiple simultaneous connections)
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering for serverless
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 1, // Maintain up to 1 socket connection for serverless
      minPoolSize: 0, // Allow no connections when idle
      connectTimeoutMS: 10000, // 10s connection timeout
    };

    cached.promise = mongoose.connect(ENV.MONGO_URI, opts).then((mongoose) => {
      const dbName = mongoose.connection.db?.databaseName || "unknown";
      console.log(`✅ Connected to MongoDB database: ${dbName}`);
      return mongoose;
    }).catch((error) => {
      cached.promise = null;
      console.error("❌ Error connecting to MongoDB:", error.message);
      // Don't log full error object in production (might contain sensitive info)
      if (ENV.NODE_ENV !== "production") {
        console.error("Full error:", error);
      }
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    
    // Verify connection is actually ready
    if (mongoose.connection.readyState !== 1) {
      cached.conn = null;
      cached.promise = null;
      throw new Error("Database connection not ready after connect attempt");
    }
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error("❌ Error connecting to MongoDB:", e.message);
    if (ENV.NODE_ENV !== "production") {
      console.error("Full error:", e);
    }
    throw e;
  }

  return cached.conn;
};