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

app.use(cors());
app.use(express.json());

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
  console.error("Unhandled error:", err);
  console.error("Error stack:", err.stack);
  
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