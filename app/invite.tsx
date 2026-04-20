import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

interface InvitationPreview {
  invitation_id: number;
  family_id: number;
  family_name: string;
  family_avatar: string | null;
  inviter_name: string | null;
  expire_time: string;
}

function buildRedirectTo(code: string): string {
  return `/invite?code=${encodeURIComponent(code)}`;
}

function formatExpire(expireTime: string): string {
  const date = new Date(expireTime);
  if (Number.isNaN(date.getTime())) return '该邀请已过期';
  return `有效期至 ${date.toLocaleString('zh-CN', { hour12: false })}`;
}

export default function InviteScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const bumpProfileVersion = useAppStore((state) => state.bumpProfileVersion);
  const params = useLocalSearchParams<{ code?: string }>();

  const inviteCode = useMemo(() => {
    return typeof params.code === 'string' ? params.code.trim() : '';
  }, [params.code]);

  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState('');

  async function loadPreview() {
    if (!inviteCode) {
      setError('邀请链接无效，请检查后重试');
      setPreview(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('get_family_invitation_by_code', {
        p_invite_code: inviteCode,
      });

      if (error) {
        setError(error.message || '无法读取邀请信息');
        setPreview(null);
        return;
      }

      const first = Array.isArray(data) ? (data[0] as InvitationPreview | undefined) : undefined;
      if (!first) {
        setError('邀请不存在或已失效');
        setPreview(null);
        return;
      }

      setPreview(first);
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法读取邀请信息';
      setError(message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!inviteCode || !user?.id || accepting) return;

    setAccepting(true);
    try {
      const { error } = await supabase.rpc('accept_family_invitation_by_code', {
        p_invite_code: inviteCode,
      });

      if (error) {
        Alert.alert('加入失败', error.message || '邀请处理失败，请稍后重试');
        return;
      }

      bumpProfileVersion();
      Alert.alert('加入成功', '你已成功加入家庭');
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : '邀请处理失败，请稍后重试';
      Alert.alert('加入失败', message);
    } finally {
      setAccepting(false);
    }
  }

  function handleGoLogin() {
    if (!inviteCode) {
      router.replace('/(auth)/login');
      return;
    }

    router.replace({
      pathname: '/(auth)/login',
      params: { redirectTo: buildRedirectTo(inviteCode) },
    });
  }

  useEffect(() => {
    loadPreview();
  }, [inviteCode]);

  return (
    <ScreenWrapper className="bg-app-bg">
      <View className="flex-1 px-6 pt-10">
        <Text className="text-2xl font-bold" style={{ color: Colors.text.primary }}>
          家庭邀请
        </Text>

        <View className="mt-4 rounded-3xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.82)' }}>
          {loading ? (
            <Text className="text-sm" style={{ color: Colors.text.secondary }}>
              正在读取邀请信息...
            </Text>
          ) : null}

          {!loading && error ? (
            <Text className="text-sm" style={{ color: '#DC2626' }}>
              {error}
            </Text>
          ) : null}

          {!loading && !error && preview ? (
            <>
              <Text className="text-lg font-semibold" style={{ color: Colors.text.primary }}>
                {preview.family_name}
              </Text>
              <Text className="text-sm mt-2" style={{ color: Colors.text.secondary }}>
                {preview.inviter_name?.trim() ? `${preview.inviter_name} 邀请你加入家庭账本` : '家庭管理员邀请你加入家庭账本'}
              </Text>
              <Text className="text-xs mt-3" style={{ color: Colors.text.tertiary }}>
                {formatExpire(preview.expire_time)}
              </Text>
            </>
          ) : null}
        </View>

        {!user?.id ? (
          <TouchableOpacity
            className="mt-6 rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.primary }}
            onPress={handleGoLogin}
            disabled={loading || !preview}
          >
            <Text className="text-base font-semibold text-white">登录后加入</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="mt-6 rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.primary, opacity: accepting || !preview ? 0.6 : 1 }}
            onPress={handleAccept}
            disabled={accepting || loading || !preview}
          >
            <Text className="text-base font-semibold text-white">确认加入家庭</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenWrapper>
  );
}
