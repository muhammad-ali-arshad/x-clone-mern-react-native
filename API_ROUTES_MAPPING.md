# API Routes Quick Reference

## Complete Route Mapping

### User Routes

| Method | Frontend Path | Backend Path | Handler | Auth | DB Models | Critical Env Vars |
|--------|--------------|--------------|---------|------|-----------|-------------------|
| GET | ❌ Not implemented | `/api/users/profile/:username` | `getUserProfile` | ❌ | User | `MONGO_URI` |
| POST | `/users/sync` | `/api/users/sync` | `syncUser` | ✅ Clerk | User | `MONGO_URI`, `CLERK_SECRET_KEY` |
| GET | `/users/me` | `/api/users/me` | `getCurrentUser` | ✅ Clerk | User | `MONGO_URI`, `CLERK_SECRET_KEY` |
| PUT | `/users/profile` | `/api/users/profile` | `updateProfile` | ✅ Clerk | User | `MONGO_URI`, `CLERK_SECRET_KEY` |
| POST | ❌ Not implemented | `/api/users/follow/:targetUserId` | `followUser` | ✅ Clerk | User, Notification | `MONGO_URI`, `CLERK_SECRET_KEY` |

### Post Routes

| Method | Frontend Path | Backend Path | Handler | Auth | DB Models | Critical Env Vars |
|--------|--------------|--------------|---------|------|-----------|-------------------|
| GET | `/posts` | `/api/posts` | `getPosts` | ❌ | Post, User, Comment | `MONGO_URI` |
| GET | ❌ Not implemented | `/api/posts/:postId` | `getPost` | ❌ | Post, User, Comment | `MONGO_URI` |
| GET | `/posts/user/:username` | `/api/posts/user/:username` | `getUserPosts` | ❌ | Post, User, Comment | `MONGO_URI` |
| POST | `/posts` | `/api/posts` | `createPost` | ✅ Clerk | Post, User | `MONGO_URI`, `CLERK_SECRET_KEY`, `CLOUDINARY_*` |
| POST | `/posts/:postId/like` | `/api/posts/:postId/like` | `likePost` | ✅ Clerk | Post, User, Notification | `MONGO_URI`, `CLERK_SECRET_KEY` |
| DELETE | `/posts/:postId` | `/api/posts/:postId` | `deletePost` | ✅ Clerk | Post, Comment | `MONGO_URI`, `CLERK_SECRET_KEY` |

### Comment Routes

| Method | Frontend Path | Backend Path | Handler | Auth | DB Models | Critical Env Vars |
|--------|--------------|--------------|---------|------|-----------|-------------------|
| GET | ❌ Not implemented | `/api/comments/post/:postId` | `getComments` | ❌ | Comment, User | `MONGO_URI` |
| POST | `/comments/post/:postId` | `/api/comments/post/:postId` | `createComment` | ✅ Clerk | Comment, Post, User, Notification | `MONGO_URI`, `CLERK_SECRET_KEY` |
| DELETE | ❌ Not implemented | `/api/comments/:commentId` | `deleteComment` | ✅ Clerk | Comment, Post | `MONGO_URI`, `CLERK_SECRET_KEY` |

### Notification Routes

| Method | Frontend Path | Backend Path | Handler | Auth | DB Models | Critical Env Vars |
|--------|--------------|--------------|---------|------|-----------|-------------------|
| GET | ❌ Not implemented | `/api/notifications` | `getNotifications` | ✅ Clerk | Notification, User, Post, Comment | `MONGO_URI`, `CLERK_SECRET_KEY` |
| DELETE | ❌ Not implemented | `/api/notifications/:notificationId` | `deleteNotification` | ✅ Clerk | Notification, User | `MONGO_URI`, `CLERK_SECRET_KEY` |

## Environment Variables Required

### Critical (Will cause 500 errors if missing):
- `MONGO_URI` - MongoDB connection string
- `CLERK_SECRET_KEY` - Clerk backend secret key

### Important (Will cause 500 errors on specific routes):
- `CLOUDINARY_CLOUD_NAME` - For image uploads
- `CLOUDINARY_API_KEY` - For image uploads
- `CLOUDINARY_API_SECRET` - For image uploads

### Optional (Will degrade functionality):
- `ARCJET_KEY` - Security/rate limiting (runs in DRY_RUN mode if missing)
- `CLERK_PUBLISHABLE_KEY` - Not needed for backend
- `NODE_ENV` - Should be "production" on Vercel

## Frontend API Client Usage

### Files Using API:
- `mobile/hooks/useUserSync.ts` - `POST /users/sync`
- `mobile/hooks/useCurrentUser.ts` - `GET /users/me`
- `mobile/hooks/usePosts.ts` - `GET /posts`, `GET /posts/user/:username`, `POST /posts/:postId/like`, `DELETE /posts/:postId`
- `mobile/hooks/useCreatePost.ts` - `POST /posts`
- `mobile/hooks/useComments.ts` - `POST /comments/post/:postId`

### Base URL:
- Default: `https://x-clone-mern-react-native.vercel.app/api`
- Override: `process.env.EXPO_PUBLIC_API_URL`

### Headers Added Automatically:
- `User-Agent: X-Clone-Mobile-App/1.0.0`
- `X-Client-Type: mobile-app`
- `Authorization: Bearer <token>` (if authenticated)
- `Content-Type: multipart/form-data` (for file uploads only)

