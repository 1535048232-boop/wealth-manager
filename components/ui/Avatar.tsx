import { View, Text, Image } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Colors } from '@/constants/Colors';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show a camera icon when no avatar is set (profile upload hint) */
  showCamera?: boolean;
}

export function Avatar({ uri, name, size = 'md', className = '', showCamera = false }: AvatarProps) {
  const sizeMap = {
    sm: { container: 'w-8 h-8',   text: 'text-xs',  icon: 14 },
    md: { container: 'w-12 h-12', text: 'text-base', icon: 20 },
    lg: { container: 'w-16 h-16', text: 'text-xl',   icon: 26 },
  };
  const { container, text, icon } = sizeMap[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={`rounded-full ${container} ${className}`}
      />
    );
  }

  if (showCamera) {
    return (
      <View
        className={`rounded-full items-center justify-center ${container} ${className}`}
        style={{ backgroundColor: Colors.primaryMid }}
      >
        <SymbolView name="camera.fill" tintColor={Colors.primary} size={icon} />
      </View>
    );
  }

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <View className={`rounded-full bg-blue-100 items-center justify-center ${container} ${className}`}>
      <Text className={`font-semibold text-blue-600 ${text}`}>{initials}</Text>
    </View>
  );
}
