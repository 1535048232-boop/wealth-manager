import { View, Text, Image } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
  const emojiAvatar = uri?.startsWith('emoji:') ? uri.slice('emoji:'.length) : null;

  if (emojiAvatar) {
    return (
      <View className={`rounded-full items-center justify-center ${container} ${className}`} style={{ backgroundColor: Colors.primaryMid }}>
        <Text style={{ fontSize: size === 'sm' ? 14 : size === 'md' ? 22 : 28 }}>{emojiAvatar}</Text>
      </View>
    );
  }

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
        <MaterialCommunityIcons name="camera-outline" size={24} color="black" />
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
