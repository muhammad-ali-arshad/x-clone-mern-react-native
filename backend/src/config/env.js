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