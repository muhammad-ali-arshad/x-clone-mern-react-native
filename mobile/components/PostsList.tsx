import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePosts } from "@/hooks/usePosts";
import { Post } from "@/types";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import PostCard from "./PostCard";
import { useState } from "react";
import CommentsModal from "./CommentsModal";

const PostsList = ({ username }: { username?: string }) => {
  const { currentUser } = useCurrentUser();
  const { posts, isLoading, error, refetch, toggleLike, deletePost, checkIsLiked } =
    usePosts(username);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const selectedPost = selectedPostId ? posts.find((p: Post) => p._id === selectedPostId) : null;

  if (isLoading) {
    return (
      <View className="p-8 items-center">
        <ActivityIndicator size="large" color="#1DA1F2" />
        <Text className="text-gray-500 mt-2">Loading posts...</Text>
      </View>
    );
  }

  // Show error only if we have an error AND no posts (not just a 404 or empty result)
  if (error && posts.length === 0 && !isLoading) {
    const errorMessage = (error as any)?.response?.data?.error || (error as any)?.message || "Unknown error";
    const statusCode = (error as any)?.response?.status;
    
    // Don't show error for 404 or if posts array is just empty
    if (statusCode !== 404) {
      return (
        <View className="p-8 items-center">
          <Text className="text-red-500 mb-2 font-semibold">Failed to load posts</Text>
          {statusCode && (
            <Text className="text-gray-500 mb-2">Status: {statusCode}</Text>
          )}
          <Text className="text-gray-500 mb-4 text-center">{errorMessage}</Text>
          <TouchableOpacity className="bg-blue-500 px-4 py-2 rounded-lg" onPress={() => refetch()}>
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  if (posts.length === 0 && !isLoading) {
    return (
      <View className="p-8 items-center">
        <Text className="text-gray-500">No posts yet</Text>
      </View>
    );
  }

  return (
    <>
      {posts.map((post: Post) => (
        <PostCard
          key={post._id}
          post={post}
          onLike={toggleLike}
          onDelete={deletePost}
          onComment={(post: Post) => setSelectedPostId(post._id)}
          currentUser={currentUser}
          isLiked={checkIsLiked(post.likes, currentUser)}
        />
      ))}

      <CommentsModal selectedPost={selectedPost} onClose={() => setSelectedPostId(null)} />
    </>
  );
};

export default PostsList;