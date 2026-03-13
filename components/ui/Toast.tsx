import { View, Text } from 'react-native';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export function Toast({ message, type = 'info' }: ToastProps) {
  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };

  return (
    <View className={`px-4 py-3 rounded-xl mx-4 ${typeClasses[type]}`}>
      <Text className="text-white text-sm font-medium">{message}</Text>
    </View>
  );
}
