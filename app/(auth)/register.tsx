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
    const { error } = await signUpWithEmail(email, password);
    if (error) setError(error.message);
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
