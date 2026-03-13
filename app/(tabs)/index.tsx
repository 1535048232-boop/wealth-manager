import { View, Text } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';

export default function HomeScreen() {
  const { user } = useAuthStore();

  return (
    <ScreenWrapper>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Welcome</Text>
        <Text className="text-gray-500">{user?.email}</Text>
      </View>
    </ScreenWrapper>
  );
}
