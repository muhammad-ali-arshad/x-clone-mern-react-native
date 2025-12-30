import { useQuery } from "@tanstack/react-query";
import { useApiClient, postApi } from "@/utils/api";

export interface Post {
  _id: string;
  user: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture: string;
  };
  content: string;
  image: string;
  likes: string[];
  comments: Array<{
    _id: string;
    user: {
      _id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePicture: string;
    };
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface PostsResponse {
  posts: Post[];
}

export const usePosts = () => {
  const api = useApiClient();

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<PostsResponse>({
    queryKey: ["posts"],
    queryFn: async () => {
      const response = await postApi.getPosts(api);
      return response.data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2,
  });

  return {
    posts: data?.posts || [],
    isLoading,
    error,
    refetch,
    isRefetching,
  };
};

