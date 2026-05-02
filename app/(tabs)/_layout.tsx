import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamilyInvitationPromptModal, type FamilyInvitationPrompt } from '@/components/ui/FamilyInvitationPromptModal';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

function isMissingRpcFunctionError(message: string): boolean {
  return message.includes('get_my_pending_family_invitation') && message.includes('no matches were found in the schema cache');
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 10);
  const { user, initialized } = useAuthStore();
  const bumpProfileVersion = useAppStore((state) => state.bumpProfileVersion);

  const [invitation, setInvitation] = useState<FamilyInvitationPrompt | null>(null);
  const [showInvitationPrompt, setShowInvitationPrompt] = useState(false);
  const [acting, setActing] = useState(false);

  async function checkPendingInvitation() {
    try {
      const { data, error } = await supabase.rpc('get_my_pending_family_invitation');
      if (error) {
        // Backend migration may lag behind app deploy. Skip prompt until RPC exists.
        if (isMissingRpcFunctionError(error.message)) {
          setInvitation(null);
          setShowInvitationPrompt(false);
          return;
        }

        console.error('[TabLayout] checkPendingInvitation failed:', error);
        return;
      }

      const first = Array.isArray(data) ? (data[0] as FamilyInvitationPrompt | undefined) : undefined;
      if (!first) {
        setInvitation(null);
        setShowInvitationPrompt(false);
        return;
      }

      setInvitation(first);
      setShowInvitationPrompt(true);
    } catch (error) {
      console.error('[TabLayout] checkPendingInvitation failed:', error);
    }
  }

  async function handleAcceptInvitation() {
    if (!invitation || acting) return;

    setActing(true);
    try {
      const { error } = await supabase.rpc('accept_family_invitation', {
        p_invitation_id: invitation.invitation_id,
      });

      if (error) {
        Alert.alert('操作失败', error.message);
        return;
      }

      setShowInvitationPrompt(false);
      setInvitation(null);
      bumpProfileVersion();
      Alert.alert('加入成功', `你已加入 ${invitation.family_name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '邀请处理失败，请稍后重试';
      Alert.alert('操作失败', message);
    } finally {
      setActing(false);
    }
  }

  async function handleRejectInvitation() {
    if (!invitation || acting) return;

    setActing(true);
    try {
      const { error } = await supabase.rpc('reject_family_invitation', {
        p_invitation_id: invitation.invitation_id,
      });

      if (error) {
        Alert.alert('操作失败', error.message);
        return;
      }

      setShowInvitationPrompt(false);
      setInvitation(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '邀请处理失败，请稍后重试';
      Alert.alert('操作失败', message);
    } finally {
      setActing(false);
    }
  }

  useEffect(() => {
    if (!initialized || !user?.id) {
      setShowInvitationPrompt(false);
      setInvitation(null);
      return;
    }

    checkPendingInvitation();
  }, [initialized, user?.id]);

  return (
    <>
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
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="playlist-edit" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="family-members"
          options={{
            title: '成员资产',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="account-group" size={24} color={color} />
            ),
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
        <Tabs.Screen
          name="family-invite"
          options={{
            href: null,
            title: '邀请成员',
          }}
        />
      </Tabs>

      <FamilyInvitationPromptModal
        visible={showInvitationPrompt}
        invitation={invitation}
        loading={acting}
        onAccept={handleAcceptInvitation}
        onReject={handleRejectInvitation}
      />
    </>
  );
}
