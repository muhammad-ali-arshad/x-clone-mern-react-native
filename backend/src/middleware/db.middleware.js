import { connectDB } from "../config/db.js";
import mongoose from "mongoose";

// Middleware to ensure DB connection before handling requests
export const ensureDBConnection = async (req, res, next) => {
  // Ensure response is always sent (timeout safety)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: "Database connection timeout",
        message: "Database connection attempt timed out. Please try again later.",
      });
    }
  }, 8000); // 8 second timeout for DB connection

  try {
    // Check if already connected and ready
    if (mongoose.connection.readyState === 1) {
      clearTimeout(timeout);
      return next();
    }
    
    // Connect if not already connected (with timeout)
    await Promise.race([
      connectDB(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 8000)
      )
    ]);
    
    // Verify connection is actually ready
    if (mongoose.connection.readyState !== 1) {
      clearTimeout(timeout);
      throw new Error("Database connection not ready after connect attempt");
    }
    
    clearTimeout(timeout);
    next();
  } catch (error) {
    clearTimeout(timeout);
    
    // Ensure response hasn't been sent
    if (res.headersSent) {
      return next(error);
    }
    
    console.error("Database connection error:", error.message || error);
    
    // Provide more helpful error message
    const errorMessage = error.message || "Unknown database error";
    
    return res.status(500).json({
      error: "Database connection failed",
      message: "Unable to connect to the database. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
};

