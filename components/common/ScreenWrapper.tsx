import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
  children: React.ReactNode;
  className?: string;
  safeArea?: boolean;
}

export function ScreenWrapper({ children, className = '', safeArea = true }: ScreenWrapperProps) {
  const Wrapper = safeArea ? SafeAreaView : View;
  return (
    <Wrapper className={`flex-1 bg-white ${className}`}>
      {children}
    </Wrapper>
  );
}
