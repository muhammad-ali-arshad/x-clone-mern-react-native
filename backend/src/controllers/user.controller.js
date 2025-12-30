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

  const user = await User.findOneAndUpdate({ clerkId: userId }, req.body, { new: true });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const syncUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }

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
    return res.status(500).json({ error: "Failed to fetch user data from Clerk" });
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
      return res.status(409).json({ error: "Username already exists" });
    }
    throw error; // Let asyncHandler handle other errors
  }
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  
  if (!userId) {
    return res.status(401).json({ error: "User ID not found" });
  }

  const user = await User.findOne({ clerkId: userId });

  if (!user) return res.status(404).json({ error: "User not found" });

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