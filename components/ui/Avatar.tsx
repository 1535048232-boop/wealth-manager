import { View, Text, Image } from 'react-native';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ uri, name, size = 'md', className = '' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-base',
    lg: 'text-xl',
  };

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={`rounded-full ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <View className={`rounded-full bg-blue-100 items-center justify-center ${sizeClasses[size]} ${className}`}>
      <Text className={`font-semibold text-blue-600 ${textSizeClasses[size]}`}>{initials}</Text>
    </View>
  );
}
