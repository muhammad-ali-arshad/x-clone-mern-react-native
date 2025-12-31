import { connectDB } from "../config/db.js";
import mongoose from "mongoose";

// Middleware to ensure DB connection before handling requests
export const ensureDBConnection = async (req, res, next) => {
  try {
    // Check if already connected and ready
    if (mongoose.connection.readyState === 1) {
      return next();
    }
    
    // Connect if not already connected
    await connectDB();
    
    // Verify connection is actually ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database connection not ready after connect attempt");
    }
    
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    
    // Provide more helpful error message
    const errorMessage = error.message || "Unknown database error";
    
    return res.status(500).json({
      error: "Database connection failed",
      message: "Unable to connect to the database. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
};

