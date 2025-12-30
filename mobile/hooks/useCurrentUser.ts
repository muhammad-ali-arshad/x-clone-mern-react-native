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
    queryFn: () => userApi.getCurrentUser(api),
    select: (response) => response.data.user,
    enabled: isLoaded && isSignedIn, // Only fetch when user is signed in
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  });

  return { currentUser, isLoading, error, refetch };
};