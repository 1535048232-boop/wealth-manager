import { View, Text } from 'react-native';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';

export default function EntryScreen() {
  return (
    <ScreenWrapper>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-ink text-2xl font-bold mb-2">录入</Text>
        <Text className="text-ink-secondary text-sm">记录资产与交易</Text>
      </View>
    </ScreenWrapper>
  );
}
