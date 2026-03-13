import { Tabs } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <SymbolView
      name={name as any}
      tintColor={color}
      size={24}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 10);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: (Platform.OS === 'ios' ? 66 : 72) + tabBarBottomPadding,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarItemStyle: {
          paddingVertical: Platform.OS === 'android' ? 5 : 4,
        },
        tabBarLabelStyle: {
          fontSize: Platform.OS === 'android' ? 12 : 11,
          lineHeight: Platform.OS === 'android' ? 16 : 14,
          fontWeight: '500',
          marginTop: 0,
          marginBottom: Platform.OS === 'android' ? 1 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home-heart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: '录入',
          tabBarButton: ({ onPress }) => (
            <Pressable
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                top: -14,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: Colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <MaterialCommunityIcons name="plus" size={24} color="#fff" />
              </View>
            </Pressable>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
