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