import { View, Text } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <ScreenWrapper>
      <View className="flex-1 px-6 pt-8">
        <View className="items-center mb-8">
          <Avatar name={user?.email} size="lg" className="mb-3" />
          <Text className="text-lg font-semibold text-gray-900">{user?.email}</Text>
        </View>

        <Button
          title="退出登录"
          onPress={signOut}
          variant="outline"
        />
      </View>
    </ScreenWrapper>
  );
}
