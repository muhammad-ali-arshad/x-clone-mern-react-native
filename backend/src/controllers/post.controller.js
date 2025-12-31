import asyncHandler from "express-async-handler";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";
import cloudinary from "../config/cloudinary.js";
import { ENV } from "../config/env.js";

import Notification from "../models/notification.model.js";
import Comment from "../models/comment.model.js";

export const getPosts = asyncHandler(async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "username firstName lastName profilePicture")
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username firstName lastName profilePicture",
        },
      })
      .lean(); // Use lean() for better performance

    // Filter out posts with deleted users
    const validPosts = posts.filter(post => post.user !== null);

    res.status(200).json({ posts: validPosts });
  } catch (error) {
    console.error("Error fetching posts:", error);
    // Return empty array instead of crashing
    res.status(200).json({ posts: [] });
  }
});

export const getPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findById(postId)
    .populate("user", "username firstName lastName profilePicture")
    .populate({
      path: "comments",
      populate: {
        path: "user",
        select: "username firstName lastName profilePicture",
      },
    });

  if (!post) return res.status(404).json({ error: "Post not found" });

  res.status(200).json({ post });
});

export const getUserPosts = asyncHandler(async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate("user", "username firstName lastName profilePicture")
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username firstName lastName profilePicture",
        },
      })
      .lean(); // Use lean() for better performance

    // Filter out posts with deleted users
    const validPosts = posts.filter(post => post.user !== null);

    res.status(200).json({ posts: validPosts });
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(200).json({ posts: [] });
  }
});

export const createPost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  
  // Validate req.body exists
  if (!req.body) {
    return res.status(400).json({ error: "Request body is required" });
  }
  
  const { content } = req.body || {};
  const imageFile = req.file;

  if (!content && !imageFile) {
    return res.status(400).json({ error: "Post must contain either text or image" });
  }

  const user = await User.findOne({ clerkId: userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  let imageUrl = "";

  // upload image to Cloudinary if provided
  if (imageFile) {
    // Check file size before processing
    if (imageFile.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Image size exceeds 5MB limit" });
    }
    
    // Check if Cloudinary is configured
    if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ 
        error: "Image upload service not configured",
        message: "Cloudinary credentials are missing. Please contact administrator."
      });
    }
    
    try {
      // convert buffer to base64 for cloudinary
      const base64Image = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString(
        "base64"
      )}`;

      const uploadResponse = await cloudinary.uploader.upload(base64Image, {
        folder: "social_media_posts",
        resource_type: "image",
        transformation: [
          { width: 800, height: 600, crop: "limit" },
          { quality: "auto" },
          { format: "auto" },
        ],
      });
      imageUrl = uploadResponse.secure_url;
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(400).json({ 
        error: "Failed to upload image",
        message: uploadError.message || "Image upload failed. Please try again."
      });
    }
  }

  const post = await Post.create({
    user: user._id,
    content: content || "",
    image: imageUrl,
  });

  res.status(201).json({ post });
});

export const likePost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;

  const user = await User.findOne({ clerkId: userId });
  const post = await Post.findById(postId);

  if (!user || !post) return res.status(404).json({ error: "User or post not found" });

  const isLiked = post.likes.includes(user._id);

  if (isLiked) {
    // unlike
    await Post.findByIdAndUpdate(postId, {
      $pull: { likes: user._id },
    });
  } else {
    // like
    await Post.findByIdAndUpdate(postId, {
      $push: { likes: user._id },
    });

    // create notification if not liking own post
    if (post.user.toString() !== user._id.toString()) {
      await Notification.create({
        from: user._id,
        to: post.user,
        type: "like",
        post: postId,
      });
    }
  }

  res.status(200).json({
    message: isLiked ? "Post unliked successfully" : "Post liked successfully",
  });
});

export const deletePost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;

  const user = await User.findOne({ clerkId: userId });
  const post = await Post.findById(postId);

  if (!user || !post) return res.status(404).json({ error: "User or post not found" });

  if (post.user.toString() !== user._id.toString()) {
    return res.status(403).json({ error: "You can only delete your own posts" });
  }

  // delete all comments on this post
  await Comment.deleteMany({ post: postId });

  // delete the post
  await Post.findByIdAndDelete(postId);

  res.status(200).json({ message: "Post deleted successfully" });
});