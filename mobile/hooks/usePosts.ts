import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, postApi } from "../utils/api";

export const usePosts = (username?: string) => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const {
    data: postsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: username ? ["userPosts", username] : ["posts"],
    queryFn: () => (username ? postApi.getUserPosts(api, username) : postApi.getPosts(api)),
    select: (response) => response.data.posts,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      // Retry up to 2 times on server errors or network errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Max 5s delay
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnReconnect: true, // Only refetch on reconnect
  });

  const likePostMutation = useMutation({
    mutationFn: (postId: string) => postApi.likePost(api, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (username) {
        queryClient.invalidateQueries({ queryKey: ["userPosts", username] });
      }
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => postApi.deletePost(api, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (username) {
        queryClient.invalidateQueries({ queryKey: ["userPosts", username] });
      }
    },
  });

  const checkIsLiked = (postLikes: string[], currentUser: any) => {
    const isLiked = currentUser && postLikes.includes(currentUser._id);
    return isLiked;
  };

  return {
    posts: postsData || [],
    isLoading,
    error,
    refetch,
    toggleLike: (postId: string) => likePostMutation.mutate(postId),
    deletePost: (postId: string) => deletePostMutation.mutate(postId),
    checkIsLiked,
  };
};