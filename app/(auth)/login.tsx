import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const { signInWithEmail, resendConfirmationEmail, isLoading } = useAuthStore();

  async function handleLogin() {
    setError('');
    setUnconfirmedEmail('');
    setResendStatus('idle');
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    const { error } = await signInWithEmail(email, password);
    if (error) {
      if (error.message === 'Email not confirmed') {
        // Show targeted prompt instead of raw error message
        setUnconfirmedEmail(email);
      } else {
        setError(error.message);
      }
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    const { error } = await resendConfirmationEmail(unconfirmedEmail);
    if (error) {
      setResendStatus('idle');
      if (error.message.toLowerCase().includes('rate limit')) {
        setError('发送太频繁，请稍后再试或检查垃圾邮件文件夹');
      } else {
        setError(error.message);
      }
      setUnconfirmedEmail('');
    } else {
      setResendStatus('sent');
    }
  }

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
          <Text className="text-3xl font-bold text-gray-900 mb-2">欢迎回来</Text>
          <Text className="text-gray-500">登录你的账号</Text>
        </View>

        <Input
          label="邮箱"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="密码"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Email not confirmed banner */}
        {unconfirmedEmail ? (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            {resendStatus === 'sent' ? (
              <Text className="text-amber-800 text-sm text-center">
                ✅ 确认邮件已发送，请检查收件箱（含垃圾邮件）
              </Text>
            ) : (
              <>
                <Text className="text-amber-800 text-sm mb-2">
                  邮箱尚未验证，请先确认注册邮件。
                </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendStatus === 'sending'}>
                  <Text className="text-blue-600 text-sm font-medium">
                    {resendStatus === 'sending' ? '发送中…' : '重新发送确认邮件'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {error ? (
          <Text className="text-red-500 text-sm mb-4">{error}</Text>
        ) : null}

        <Button
          title="登录"
          onPress={handleLogin}
          isLoading={isLoading}
          className="mb-4"
        />

        <View className="flex-row justify-center">
          <Text className="text-gray-500">还没有账号？</Text>
          <Link href="/(auth)/register">
            <Text className="text-blue-600 font-medium"> 立即注册</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
