import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const { signUpWithEmail, isLoading } = useAuthStore();

  async function handleRegister() {
    setError('');
    if (!email || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    const { error, needsConfirmation } = await signUpWithEmail(email, password);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('注册邮件发送太频繁，请稍等几分钟后再试，或检查垃圾邮件文件夹中是否已有确认邮件');
      } else if (msg.includes('already registered') || msg.includes('user already exists')) {
        setError('该邮箱已注册，请直接登录');
      } else {
        setError(error.message);
      }
    } else if (needsConfirmation) {
      // Email confirmation required — show notice (no navigation yet)
      setEmailSent(true);
    }
    // If needsConfirmation is false, session was set and useProtectedRoute
    // will automatically navigate to /(tabs).
  }

  if (emailSent) {
    return (
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-gray-900 mb-4">确认邮箱</Text>
          <Text className="text-gray-600 leading-6 mb-6">
            验证邮件已发送至{'\n'}
            <Text className="font-semibold text-gray-900">{email}</Text>
            {'\n\n'}请前往邮箱点击确认链接后再返回登录。
          </Text>
          <Link href="/(auth)/login">
            <Text className="text-blue-600 font-medium text-center">返回登录</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    );
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
          <Text className="text-3xl font-bold text-gray-900 mb-2">创建账号</Text>
          <Text className="text-gray-500">开始你的旅程</Text>
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
          placeholder="至少 6 位"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Input
          label="确认密码"
          placeholder="再次输入密码"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {error ? (
          <Text className="text-red-500 text-sm mb-4">{error}</Text>
        ) : null}

        <Button
          title="注册"
          onPress={handleRegister}
          isLoading={isLoading}
          className="mb-4"
        />

        <View className="flex-row justify-center">
          <Text className="text-gray-500">已有账号？</Text>
          <Link href="/(auth)/login">
            <Text className="text-blue-600 font-medium"> 立即登录</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
