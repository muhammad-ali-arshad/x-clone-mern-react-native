
import axios, {Axios, AxiosInstance} from "axios";
import {useAuth} from "@clerk/clerk-expo";
import {useMemo} from "react";



 // Use environment variable if available, otherwise fallback to Vercel URL
 const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://x-clone-mern-react-native.vercel.app/api"

 // Log the API URL being used (remove in production if needed)
 console.log("🌐 API Base URL:", API_BASE_URL);

 export const createApiClient = (getToken: () => Promise<string | null>): AxiosInstance => {
    const api = axios.create({ 
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 second timeout for all requests
    });
  
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

    api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Only log non-404 errors (404 is expected for user not found before sync)
          if (error.response.status !== 404) {
            console.error("API Error:", error.response.status, error.response.data);
          }
        } else if (error.request) {
          console.error("Network Error:", error.request);
        } else {
          console.error("Error:", error.message);
        }
        return Promise.reject(error);
      }
    );
  
    return api;
  };
  
  export const useApiClient = (): AxiosInstance => {
    const { getToken } = useAuth();
     return useMemo(() => createApiClient(getToken), [getToken]);
  };
  
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