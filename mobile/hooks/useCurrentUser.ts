import { useQuery } from "@tanstack/react-query";
import { useApiClient, userApi } from "../utils/api";
import { useAuth } from "@clerk/clerk-expo";

export const useCurrentUser = () => {
  const api = useApiClient();
  const { isSignedIn, isLoaded } = useAuth();

  const {
    data: currentUser,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      try {
        const response = await userApi.getCurrentUser(api);
        return response.data.user;
      } catch (err: any) {
        // If 404, user doesn't exist yet (needs sync) - return null (not an error)
        if (err?.response?.status === 404) {
          return null;
        }
        // For other errors, throw to trigger retry (but limited)
        throw err;
      }
    },
    enabled: isLoaded && isSignedIn, // Only fetch when user is signed in
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error: any) => {
      // CRITICAL: Don't retry on any client errors (4xx including 404)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      // Only retry once on server errors (5xx) or network errors
      return failureCount < 1;
    },
    retryDelay: 2000, // Fixed 2s delay for single retry
    refetchOnWindowFocus: false, // CRITICAL: Don't refetch on window focus
    refetchOnMount: false, // CRITICAL: Don't refetch on mount if data exists
    refetchOnReconnect: false, // CRITICAL: Don't auto-refetch on reconnect (prevents loops)
    // Don't block UI - return null on 404
    throwOnError: false,
  });

  return { currentUser, isLoading, error, refetch };
};