import { usePosts, Post } from "@/hooks/usePosts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Feather } from "@expo/vector-icons";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, postApi } from "@/utils/api";
import { useState } from "react";

interface PostItemProps {
  post: Post;
  currentUserId?: string;
}

const PostItem = ({ post, currentUserId }: PostItemProps) => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [isLiking, setIsLiking] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => postApi.likePost(api, post._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => {
      Alert.alert("Error", "Failed to like post. Please try again.");
    },
    onSettled: () => {
      setIsLiking(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => postApi.deletePost(api, post._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      Alert.alert("Success", "Post deleted successfully!");
    },
    onError: () => {
      Alert.alert("Error", "Failed to delete post. Please try again.");
    },
  });

  const handleLike = () => {
    if (isLiking) return;
    setIsLiking(true);
    likeMutation.mutate();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const isLiked = post.likes.includes(currentUserId || "");
  const isOwner = post.user._id === currentUserId;

  return (
    <View className="border-b border-gray-100 p-4 bg-white">
      <View className="flex-row">
        <Image
          source={{
            uri: post.user.profilePicture || "https://via.placeholder.com/50",
          }}
          className="w-12 h-12 rounded-full mr-3"
        />
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="font-bold text-gray-900 mr-2">
              {post.user.firstName} {post.user.lastName}
            </Text>
            <Text className="text-gray-500 text-sm">@{post.user.username}</Text>
            <Text className="text-gray-500 text-sm mx-2">·</Text>
            <Text className="text-gray-500 text-sm">
              {new Date(post.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {post.content && (
            <Text className="text-gray-900 text-base mb-2">{post.content}</Text>
          )}

          {post.image && (
            <Image
              source={{ uri: post.image }}
              className="w-full h-64 rounded-2xl mb-3"
              resizeMode="cover"
            />
          )}

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={handleLike}
                disabled={isLiking}
                className="flex-row items-center mr-6"
              >
                <Feather
                  name={isLiked ? "heart" : "heart"}
                  size={20}
                  color={isLiked ? "#EF4444" : "#657786"}
                  fill={isLiked ? "#EF4444" : "none"}
                />
                {post.likes.length > 0 && (
                  <Text
                    className={`ml-2 text-sm ${
                      isLiked ? "text-red-500" : "text-gray-500"
                    }`}
                  >
                    {post.likes.length}
                  </Text>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center mr-6">
                <Feather name="message-circle" size={20} color="#657786" />
                {post.comments.length > 0 && (
                  <Text className="ml-2 text-sm text-gray-500">
                    {post.comments.length}
                  </Text>
                )}
              </View>
            </View>

            {isOwner && (
              <TouchableOpacity onPress={handleDelete} disabled={deleteMutation.isPending}>
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const PostsList = () => {
  const { posts, isLoading, error } = usePosts();
  const { user: currentUser } = useCurrentUser();
  const currentUserId = currentUser?._id;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ActivityIndicator size="large" color="#1DA1F2" />
        <Text className="text-gray-500 mt-2">Loading posts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-gray-900 font-semibold mt-4">Failed to load posts</Text>
        <Text className="text-gray-500 text-sm mt-2">
          Please pull down to refresh
        </Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <Feather name="inbox" size={48} color="#657786" />
        <Text className="text-gray-900 font-semibold mt-4">No posts yet</Text>
        <Text className="text-gray-500 text-sm mt-2">
          Be the first to share something!
        </Text>
      </View>
    );
  }

  return (
    <View>
      {posts.map((post) => (
        <PostItem key={post._id} post={post} currentUserId={currentUserId} />
      ))}
    </View>
  );
};

export default PostsList;

