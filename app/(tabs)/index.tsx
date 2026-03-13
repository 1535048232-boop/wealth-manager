import { View, Text } from 'react-native';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Colors } from '@/constants/Colors';

export default function HomeScreen() {
  return (
    <ScreenWrapper className="bg-app-bg">
      <View className="flex-1 px-5 pt-4">
        <Text className="text-ink text-2xl font-bold">家庭资产</Text>
        <Text className="text-ink-secondary text-sm mt-1">总览</Text>
      </View>
    </ScreenWrapper>
  );
}
