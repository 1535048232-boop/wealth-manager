import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signInWithEmail, isLoading } = useAuthStore();

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    const { error } = await signInWithEmail(email, password);
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
