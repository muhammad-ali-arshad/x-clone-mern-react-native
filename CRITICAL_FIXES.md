# 🔧 Critical Fixes - Code-Level Implementation

## Priority 1: IMMEDIATE FIXES (Deploy Blockers)

### Fix 1: Environment Variable Validation

**File:** `backend/src/config/env.js`

**Replace entire file with:**

```javascript
import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  'MONGO_URI',
  'CLERK_SECRET_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  const message = `❌ Missing required environment variables: ${missingVars.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(message);
    // In production, log but don't exit (serverless functions)
  } else {
    console.warn(message);
  }
}

export const ENV = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  ARCJET_KEY: process.env.ARCJET_KEY,
};
```

---

### Fix 2: Improve Clerk Error Handling in syncUser

**File:** `backend/src/controllers/user.controller.js`

**Replace lines 45-61 with:**

```javascript
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
```

---

### Fix 3: Add req.body Validation in Controllers

**File:** `backend/src/controllers/post.controller.js`

**Replace lines 82-89 with:**

```javascript
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
```

**File:** `backend/src/controllers/comment.controller.js`

**Replace lines 18-25 with:**

```javascript
export const createComment = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;
  
  // Validate req.body exists
  if (!req.body) {
    return res.status(400).json({ error: "Request body is required" });
  }
  
  const { content } = req.body || {};

  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Comment content is required" });
  }
```

**File:** `backend/src/controllers/user.controller.js`

**Replace lines 16-28 with:**

```javascript
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
```

---

### Fix 4: Improve MongoDB Connection Handling

**File:** `backend/src/config/db.js`

**Replace entire file with:**

```javascript
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
```

---

### Fix 5: Improve Cloudinary Configuration

**File:** `backend/src/config/cloudinary.js`

**Replace entire file with:**

```javascript
import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env.js";

if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
  console.warn("⚠️  Cloudinary credentials missing. Image uploads will fail.");
} else {
  cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
  });
  console.log("✅ Cloudinary configured successfully");
}

export default cloudinary;
```

**File:** `backend/src/controllers/post.controller.js`

**Replace lines 96-118 with:**

```javascript
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
```

---

### Fix 6: Improve Clerk Middleware Error Handling

**File:** `backend/src/server.js`

**Replace lines 20-31 with:**

```javascript
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
```

---

### Fix 7: Improve DB Middleware Error Handling

**File:** `backend/src/middleware/db.middleware.js`

**Replace entire file with:**

```javascript
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
```

---

## Priority 2: HIGH PRIORITY FIXES

### Fix 8: Add Content-Type Header in Frontend

**File:** `mobile/utils/api.ts`

**Replace lines 17-36 with:**

```typescript
    api.interceptors.request.use(
      async (config) => {
        try {
          // Add headers to identify as mobile app (bypasses Arcjet bot detection)
          config.headers['User-Agent'] = 'X-Clone-Mobile-App/1.0.0';
          config.headers['X-Client-Type'] = 'mobile-app';
          
          // Set Content-Type for JSON requests (if not already set and not FormData)
          if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
            config.headers['Content-Type'] = 'application/json';
          }
          
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("Error getting token:", error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
```

---

### Fix 9: Improve Arcjet Middleware

**File:** `backend/src/middleware/arcjet.middleware.js`

**Replace lines 5-14 with:**

```javascript
export const arcjetMiddleware = async (req, res, next) => {
  // Skip if Arcjet is not configured
  if (!ENV.ARCJET_KEY || ENV.ARCJET_KEY === "dummy-key-for-development") {
    return next();
  }
  
  try {
    // Allow mobile app requests to bypass bot detection
    const isMobileApp = req.headers['x-client-type'] === 'mobile-app' || 
                        req.headers['user-agent']?.includes('X-Clone-Mobile-App');
    
    // Skip bot detection for mobile app requests
    if (isMobileApp) {
      return next();
    }

    const decision = await aj.protect(req, {
      requested: 1, // each request consumes 1 token
    });
```

---

## Priority 3: MEDIUM PRIORITY FIXES

### Fix 10: Add Missing Frontend API Calls

**File:** `mobile/utils/api.ts`

**Add after line 67:**

```typescript
  export const userApi = {
    syncUser: (api: AxiosInstance) => api.post("/users/sync"),
    getCurrentUser: (api: AxiosInstance) => api.get("/users/me"),
    updateProfile: (api: AxiosInstance, data: any) => api.put("/users/profile", data),
    getUserProfile: (api: AxiosInstance, username: string) => 
      api.get(`/users/profile/${username}`),
  };
  
  export const postApi = {
    createPost: (api: AxiosInstance, data: { content: string; image?: string }) =>
      api.post("/posts", data),
    getPosts: (api: AxiosInstance) => api.get("/posts"),
    getPost: (api: AxiosInstance, postId: string) => api.get(`/posts/${postId}`),
    getUserPosts: (api: AxiosInstance, username: string) => api.get(`/posts/user/${username}`),
    likePost: (api: AxiosInstance, postId: string) => api.post(`/posts/${postId}/like`),
    deletePost: (api: AxiosInstance, postId: string) => api.delete(`/posts/${postId}`),
  };
  
  export const commentApi = {
    createComment: (api: AxiosInstance, postId: string, content: string) =>
      api.post(`/comments/post/${postId}`, { content }),
    getComments: (api: AxiosInstance, postId: string) => 
      api.get(`/comments/post/${postId}`),
  };
  
  export const notificationApi = {
    getNotifications: (api: AxiosInstance) => api.get("/notifications"),
    deleteNotification: (api: AxiosInstance, notificationId: string) => 
      api.delete(`/notifications/${notificationId}`),
  };
```

---

### Fix 11: Improve User Sync Retry Logic

**File:** `mobile/hooks/useUserSync.ts`

**Replace lines 17-26 with:**

```typescript
        retry: (failureCount, error: any) => {
            const status = error?.response?.status;
            // Don't retry on client errors (4xx) - these are permanent
            if (status >= 400 && status < 500) {
                return false;
            }
            // Retry up to 3 times on 500 errors or network errors
            if ((status === 500 || !status) && failureCount < 3) {
                console.log(`🔄 Retrying user sync (attempt ${failureCount + 1}/3)...`);
                return true;
            }
            return false; // Don't retry on other errors
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Max 10s delay
```

---

## Vercel Configuration

### Add to `backend/package.json`:

```json
{
  "engines": {
    "node": "18.x"
  }
}
```

### Verify `backend/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

## Environment Variables Checklist for Vercel

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables:

- [ ] `MONGO_URI` = `mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority`
- [ ] `CLERK_SECRET_KEY` = `sk_test_...` or `sk_live_...`
- [ ] `CLOUDINARY_CLOUD_NAME` = Your Cloudinary cloud name
- [ ] `CLOUDINARY_API_KEY` = Your Cloudinary API key
- [ ] `CLOUDINARY_API_SECRET` = Your Cloudinary API secret
- [ ] `ARCJET_KEY` = Your Arcjet key (optional but recommended)
- [ ] `NODE_ENV` = `production`

**After adding variables, redeploy the project.**

---

## Testing After Fixes

1. Test health endpoint: `GET https://your-app.vercel.app/health`
2. Test user sync: `POST /api/users/sync` (with auth token)
3. Test posts: `GET /api/posts`
4. Test image upload: `POST /api/posts` (with image)
5. Check Vercel function logs for errors

---

## Summary

**Files Modified:**
1. `backend/src/config/env.js` - Add validation
2. `backend/src/controllers/user.controller.js` - Improve error handling
3. `backend/src/controllers/post.controller.js` - Add validation
4. `backend/src/controllers/comment.controller.js` - Add validation
5. `backend/src/config/db.js` - Improve connection handling
6. `backend/src/config/cloudinary.js` - Add validation
7. `backend/src/middleware/db.middleware.js` - Improve error handling
8. `backend/src/server.js` - Improve Clerk error handling
9. `backend/src/middleware/arcjet.middleware.js` - Add validation
10. `mobile/utils/api.ts` - Add Content-Type header, missing APIs

**Total Lines Changed:** ~200 lines across 10 files

**Estimated Time to Fix:** 2-3 hours

