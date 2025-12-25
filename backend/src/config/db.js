import mongoose from "mongoose";
import { ENV } from "./env.js";

// Cache the connection for serverless environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  // If already connected, return the existing connection
  if (cached.conn) {
    return cached.conn;
  }

  // If connection is in progress, wait for it
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering for serverless
    };

    cached.promise = mongoose.connect(ENV.MONGO_URI, opts).then((mongoose) => {
      console.log("Connected to DB SUCCESSFULLY ✅");
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error("Error connecting to MONGODB:", e);
    throw e;
  }

  return cached.conn;
};