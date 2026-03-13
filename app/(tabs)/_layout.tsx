import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '首页' }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: '探索' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: '我的' }}
      />
    </Tabs>
  );
}
