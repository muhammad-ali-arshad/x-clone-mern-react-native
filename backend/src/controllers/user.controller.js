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
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }

  try {
    // check if user already exists in mongodb
    const existingUser = await User.findOne({ clerkId: userId });
    if (existingUser) {
      return res.status(200).json({ user: existingUser, message: "User already exists" });
    }

    // create new user from Clerk data
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(userId);
    } catch (error) {
      console.error("Error fetching user from Clerk:", error);
      
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

    // Validate email addresses exist
    if (!clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
      return res.status(400).json({ error: "User email address not found" });
    }

    const email = clerkUser.emailAddresses[0].emailAddress;
    if (!email) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const userData = {
      clerkId: userId,
      email: email,
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      username: email.split("@")[0],
      profilePicture: clerkUser.imageUrl || "",
    };

    try {
      const user = await User.create(userData);
      res.status(201).json({ user, message: "User created successfully" });
    } catch (error) {
      console.error("Error creating user:", error);
      // Check if it's a duplicate username error
      if (error.code === 11000) {
        // Try to find existing user with different username format
        const existingByEmail = await User.findOne({ email });
        if (existingByEmail) {
          return res.status(200).json({ 
            user: existingByEmail, 
            message: "User already exists with this email" 
          });
        }
        // Generate unique username
        userData.username = `${email.split("@")[0]}_${Date.now()}`;
        const user = await User.create(userData);
        return res.status(201).json({ user, message: "User created successfully" });
      }
      throw error; // Let asyncHandler handle other errors
    }
  } catch (error) {
    console.error("Unexpected error in syncUser:", error);
    throw error; // Let asyncHandler handle it
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