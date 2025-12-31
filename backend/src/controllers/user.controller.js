import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";

export const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }
  
  // Validate req.body exists
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: "Request body is required" });
  }
  
  // Only allow specific fields to be updated
  const allowedFields = ['firstName', 'lastName', 'username', 'bio', 'location', 'profilePicture', 'bannerImage'];
  const updateData = {};
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const user = await User.findOneAndUpdate({ clerkId: userId }, updateData, { new: true });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const syncUser = asyncHandler(async (req, res) => {
  // CRITICAL: Ensure MongoDB connection is established before any DB operations
  try {
    const { connectDB } = await import("../config/db.js");
    await connectDB();
  } catch (dbError) {
    console.error("syncUser: MongoDB connection failed:", dbError.message);
    return res.status(500).json({
      error: "Database connection failed",
      message: "Unable to connect to database. Please try again later.",
    });
  }

  try {
    // Validate request has auth context
    const { userId } = getAuth(req);

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error("syncUser: Invalid or missing userId");
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "User ID not found or invalid" 
      });
    }

    // Validate request body if present (should be empty for sync, but check anyway)
    if (req.body && Object.keys(req.body).length > 0) {
      console.warn("syncUser: Unexpected request body received");
      // Don't fail, just log - sync doesn't need body
    }

    // Check if user already exists in MongoDB (prevent duplicate creation)
    let existingUser;
    try {
      existingUser = await User.findOne({ clerkId: userId }).lean();
      if (existingUser) {
        console.log(`✅ User already exists: ${existingUser.username || existingUser.email}`);
        return res.status(200).json({ 
          user: existingUser, 
          message: "User already exists" 
        });
      }
    } catch (dbError) {
      console.error("Error checking existing user:", dbError);
      return res.status(500).json({ 
        error: "Database error",
        message: "Failed to check existing user. Please try again later." 
      });
    }

    // Fetch user data from Clerk
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(userId);
    } catch (error) {
      console.error("Error fetching user from Clerk:", error.message);
      
      // Handle specific Clerk error types
      if (error.statusCode === 401 || error.statusCode === 403) {
        return res.status(401).json({ 
          error: "Authentication failed",
          message: "Invalid Clerk credentials. Check CLERK_SECRET_KEY configuration.",
        });
      }
      
      if (error.statusCode === 404) {
        return res.status(404).json({ 
          error: "User not found in Clerk",
          message: "The authenticated user does not exist in Clerk.",
        });
      }
      
      // Network/timeout errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return res.status(503).json({ 
          error: "Clerk service unavailable",
          message: "Unable to reach Clerk authentication service. Please try again later.",
        });
      }
      
      // Generic error
      return res.status(500).json({ 
        error: "Failed to fetch user data from Clerk",
        message: error.message || "Unknown error occurred while fetching user data",
      });
    }

    // Validate Clerk user data
    if (!clerkUser || typeof clerkUser !== 'object') {
      console.error("syncUser: Invalid Clerk user data received");
      return res.status(500).json({ 
        error: "Invalid user data",
        message: "Received invalid data from Clerk. Please try again." 
      });
    }

    // Validate email addresses exist
    if (!clerkUser.emailAddresses || !Array.isArray(clerkUser.emailAddresses) || clerkUser.emailAddresses.length === 0) {
      return res.status(400).json({ 
        error: "Invalid user data",
        message: "User email address not found" 
      });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ 
        error: "Invalid email address",
        message: "User email address is invalid or missing" 
      });
    }

    // Prepare user data
    const userData = {
      clerkId: userId,
      email: email.trim().toLowerCase(),
      firstName: (clerkUser.firstName || "").trim(),
      lastName: (clerkUser.lastName || "").trim(),
      username: email.split("@")[0].toLowerCase(),
      profilePicture: (clerkUser.imageUrl || "").trim(),
    };

    // Validate username is not empty
    if (!userData.username || userData.username.length === 0) {
      return res.status(400).json({ 
        error: "Invalid username",
        message: "Unable to generate username from email" 
      });
    }

    // Create user with duplicate handling
    try {
      const user = await User.create(userData);
      console.log(`✅ User created successfully: ${user.username}`);
      return res.status(201).json({ 
        user, 
        message: "User created successfully" 
      });
    } catch (error) {
      console.error("Error creating user:", error.message);
      
      // Check if it's a duplicate key error (username or email)
      if (error.code === 11000) {
        // Try to find existing user by email (race condition - user created between checks)
        try {
          const existingByEmail = await User.findOne({ email: userData.email }).lean();
          if (existingByEmail) {
            console.log(`✅ User already exists (race condition): ${existingByEmail.username}`);
            return res.status(200).json({ 
              user: existingByEmail, 
              message: "User already exists with this email" 
            });
          }
        } catch (findError) {
          console.error("Error finding user by email:", findError.message);
        }

        // Generate unique username if duplicate username error
        try {
          userData.username = `${email.split("@")[0]}_${Date.now()}`;
          const user = await User.create(userData);
          console.log(`✅ User created with unique username: ${user.username}`);
          return res.status(201).json({ 
            user, 
            message: "User created successfully" 
          });
        } catch (retryError) {
          console.error("Error creating user with unique username:", retryError.message);
          return res.status(500).json({ 
            error: "Failed to create user",
            message: "Unable to create user. Please try again later." 
          });
        }
      }
      
      // Other database errors
      return res.status(500).json({ 
        error: "Database error",
        message: "Failed to create user. Please try again later." 
      });
    }
  } catch (error) {
    // This should never be reached due to asyncHandler, but defensive coding
    console.error("Unexpected error in syncUser (outer catch):", error?.message || error);
    
    // CRITICAL: Always return a response - never let request hang
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: "Internal server error",
        message: "An unexpected error occurred. Please try again later." 
      });
    }
  }
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  
  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }

  const user = await User.findOne({ clerkId: userId });

  if (!user) {
    // User doesn't exist yet - suggest syncing instead of 404
    return res.status(404).json({ 
      error: "User not found",
      message: "User not synced. Please sync your user first.",
      needsSync: true
    });
  }

  res.status(200).json({ user });
});

export const followUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { targetUserId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }

  if (!targetUserId) {
    return res.status(400).json({ error: "Target user ID is required" });
  }

  if (userId === targetUserId) return res.status(400).json({ error: "You cannot follow yourself" });

  const currentUser = await User.findOne({ clerkId: userId });
  const targetUser = await User.findById(targetUserId);

  if (!currentUser || !targetUser) return res.status(404).json({ error: "User not found" });

  const isFollowing = currentUser.following.includes(targetUserId);

  if (isFollowing) {
    // unfollow
    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { following: targetUserId },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: currentUser._id },
    });
  } else {
    // follow
    await User.findByIdAndUpdate(currentUser._id, {
      $push: { following: targetUserId },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $push: { followers: currentUser._id },
    });

    // create notification
    await Notification.create({
      from: currentUser._id,
      to: targetUserId,
      type: "follow",
    });
  }

  res.status(200).json({
    message: isFollowing ? "User unfollowed successfully" : "User followed successfully",
  });
});