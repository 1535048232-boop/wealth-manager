import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

function getAuthParamsFromUrl(url: string | null) {
  if (!url) return new URLSearchParams();

  const [baseAndQuery, hash = ''] = url.split('#');
  const query = baseAndQuery.includes('?') ? baseAndQuery.split('?')[1] : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recoveryUrl?: string }>();
  const incomingUrl = Linking.useURL();
  const processedUrlRef = useRef<string | null>(null);
  const { session, recoverSessionFromUrl, updatePassword } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isRecovering, setIsRecovering] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function restoreRecoverySession() {
      const sourceUrl = typeof params.recoveryUrl === 'string'
        ? decodeURIComponent(params.recoveryUrl)
        : incomingUrl ?? (await Linking.getInitialURL());

      if (!isActive) return;

      if (!sourceUrl) {
        setIsRecovering(false);
        return;
      }

      if (processedUrlRef.current === sourceUrl) {
        setIsRecovering(false);
        return;
      }

      processedUrlRef.current = sourceUrl;

      const authParams = getAuthParamsFromUrl(sourceUrl);
      const recoveryError = authParams.get('error_description');
      const recoveryType = authParams.get('type');

      if (recoveryError) {
        setError(recoveryError);
        setIsRecovering(false);
        return;
      }

      if (recoveryType !== 'recovery') {
        setIsRecovering(false);
        return;
      }

      const { error } = await recoverSessionFromUrl(sourceUrl);

      if (!isActive) return;

      if (error) {
        setError(error.message);
      }

      setIsRecovering(false);
    }

    restoreRecoverySession();

    return () => {
      isActive = false;
    };
  }, [incomingUrl, params.recoveryUrl, recoverSessionFromUrl]);

  async function handleUpdatePassword() {
    setError('');
    setSuccess(false);

    if (password.length < 6) {
      setError('新密码至少需要 6 位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setSuccess(true);
  }

  const canResetPassword = !!session;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 mb-2">重置密码</Text>
          <Text className="text-gray-500">
            {canResetPassword ? '输入新密码并立即生效' : '请从邮箱中的重置链接进入此页面'}
          </Text>
        </View>

        {isRecovering ? (
          <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <Text className="text-gray-600 text-sm">正在验证重置链接…</Text>
          </View>
        ) : null}

        {!isRecovering && !canResetPassword ? (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <Text className="text-amber-800 text-sm">
              {error || '当前链接不可用，请回到登录页重新发送重置邮件。'}
            </Text>
          </View>
        ) : null}

        {canResetPassword ? (
          <>
            <Input
              label="新密码"
              placeholder="至少 6 位"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              label="确认新密码"
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? (
              <Text className="text-red-500 text-sm mb-4">{error}</Text>
            ) : null}

            {success ? (
              <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <Text className="text-emerald-700 text-sm">密码已更新，你现在可以继续使用应用。</Text>
              </View>
            ) : null}

            <Button
              title="更新密码"
              onPress={handleUpdatePassword}
              isLoading={isSubmitting}
              className="mb-4"
            />

            <Button
              title="进入首页"
              onPress={() => router.replace('/(tabs)')}
              variant="outline"
            />
          </>
        ) : (
          <Link href="/(auth)/login">
            <Text className="text-blue-600 font-medium text-center">返回登录页</Text>
          </Link>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}