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
    isRefetching,
  } = useQuery({
    queryKey: username ? ["userPosts", username] : ["posts"],
    queryFn: () => (username ? postApi.getUserPosts(api, username) : postApi.getPosts(api)),
    select: (response) => {
      // Always return an array, even if response is null/undefined
      if (!response || !response.data) return [];
      return response.data.posts || [];
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      // Don't retry on 404, retry on 500 or network errors
      if (status === 404) return false;
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: 1000,
    // Don't throw errors - handle gracefully
    throwOnError: false,
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
    isRefetching,
    toggleLike: (postId: string) => likePostMutation.mutate(postId),
    deletePost: (postId: string) => deletePostMutation.mutate(postId),
    checkIsLiked,
  };
};