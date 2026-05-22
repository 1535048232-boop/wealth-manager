import { Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import type { TrendGranularity } from '@/lib/trendTime';

const OPTIONS: Array<{ key: TrendGranularity; label: string }> = [
  { key: 'month', label: '按月' },
  { key: 'year', label: '按年' },
];

export function TrendGranularitySwitch({
  value,
  onChange,
}: {
  value: TrendGranularity;
  onChange: (value: TrendGranularity) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        padding: 3,
        backgroundColor: '#F3F4F6',
      }}
    >
      {OPTIONS.map((option) => {
        const selected = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.85}
            onPress={() => onChange(option.key)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: selected ? '#FFFFFF' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: selected ? Colors.primary : Colors.text.secondary,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
