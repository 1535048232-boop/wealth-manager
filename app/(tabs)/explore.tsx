import { View, Text } from 'react-native';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';

export default function ExploreScreen() {
  return (
    <ScreenWrapper>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">探索</Text>
        <Text className="text-gray-500">发现更多内容</Text>
      </View>
    </ScreenWrapper>
  );
}
