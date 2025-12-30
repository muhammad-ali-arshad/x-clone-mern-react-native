import { useQuery } from "@tanstack/react-query";
import { useApiClient, userApi } from "@/utils/api";
import { useAuth } from "@clerk/clerk-expo";

export interface CurrentUser {
  _id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string;
  bio?: string;
  location?: string;
  bannerImage?: string;
  followers: string[];
  following: string[];
}

interface UserResponse {
  user: CurrentUser;
}

export const useCurrentUser = () => {
  const api = useApiClient();
  const { isSignedIn, isLoaded } = useAuth();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<UserResponse>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await userApi.getCurrentUser(api);
      return response.data;
    },
    enabled: isLoaded && isSignedIn, // Only fetch when user is signed in
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  });

  return {
    user: data?.user,
    isLoading,
    error,
    refetch,
  };
};

