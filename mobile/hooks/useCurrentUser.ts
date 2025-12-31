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
        // If 404, user doesn't exist yet (needs sync) - return null
        if (err?.response?.status === 404) {
          return null;
        }
        // For other errors, throw to trigger retry
        throw err;
      }
    },
    enabled: isLoaded && isSignedIn, // Only fetch when user is signed in
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (user not found) - this is expected before sync
      if (error?.response?.status === 404) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: 1000,
    // Don't block UI - return null on 404
    throwOnError: false,
  });

  return { currentUser, isLoading, error, refetch };
};