import { View, Text } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <ScreenWrapper className="bg-app-bg">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-ink text-2xl font-bold mb-6">我的</Text>
        <View className="items-center mb-8">
          <Avatar name={user?.email} size="lg" className="mb-3" />
          <Text className="text-ink text-base font-semibold">{user?.email}</Text>
        </View>
        <Button title="退出登录" onPress={signOut} variant="outline" />
      </View>
    </ScreenWrapper>
  );
}
