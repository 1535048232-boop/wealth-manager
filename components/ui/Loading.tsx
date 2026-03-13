import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = false }: LoadingProps) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
        {message && <Text className="text-gray-500 mt-3 text-sm">{message}</Text>}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-8">
      <ActivityIndicator size="small" color="#3b82f6" />
      {message && <Text className="text-gray-500 mt-2 text-sm">{message}</Text>}
    </View>
  );
}
