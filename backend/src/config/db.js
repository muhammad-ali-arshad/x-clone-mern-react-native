import mongoose from "mongoose";
import { ENV } from "./env.js";

// Cache the connection for serverless environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  // If already connected and ready, return the existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection exists but is not ready, reset it
  if (cached.conn && mongoose.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  // If connection is in progress, wait for it
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering for serverless
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 1, // Maintain up to 1 socket connection for serverless
      minPoolSize: 0, // Allow no connections when idle
    };

    if (!ENV.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    cached.promise = mongoose.connect(ENV.MONGO_URI, opts).then((mongoose) => {
      console.log("Connected to DB SUCCESSFULLY ✅");
      return mongoose;
    }).catch((error) => {
      cached.promise = null;
      console.error("Error connecting to MONGODB:", error);
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    
    // Verify connection is actually ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database connection not ready");
    }
  } catch (e) {
    cached.promise = null;
    console.error("Error connecting to MONGODB:", e);
    throw e;
  }

  return cached.conn;
};