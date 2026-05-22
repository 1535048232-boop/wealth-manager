import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import { Avatar } from '@/components/ui/Avatar';
import { uploadProfileAvatar } from '@/lib/profileAvatar';

interface ProfilePayload {
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  visible: boolean;
  userId?: string;
  email?: string | null;
  initialDisplayName?: string | null;
  initialAvatarUrl?: string | null;
  onClose: () => void;
  onSuccess?: (profile: ProfilePayload) => void;
}

export function ProfileEditModal({
  visible,
  userId,
  email,
  initialDisplayName,
  initialAvatarUrl,
  onClose,
  onSuccess,
}: Props) {
  const bumpProfileVersion = useAppStore((state) => state.bumpProfileVersion);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDisplayName(initialDisplayName ?? '');
    setAvatarUrl(initialAvatarUrl ?? null);
  }, [visible, initialDisplayName, initialAvatarUrl]);

  async function handleSave() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert('提示', '请输入显示名称');
      return;
    }

    if (!userId) {
      Alert.alert('提示', '用户信息缺失，请重新登录后重试');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: trimmedName,
          avatar_url: avatarUrl,
        })
        .eq('id', userId)
        .select('display_name, avatar_url')
        .single();

      if (error) {
        Alert.alert('保存失败', error.message);
        return;
      }

      if (data) {
        onSuccess?.(data);
      }
      bumpProfileVersion();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    if (!userId) {
      Alert.alert('提示', '用户信息缺失，请重新登录后重试');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', '请先允许访问相册');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert('上传失败', '未获取到图片文件');
      return;
    }

    setAvatarUploading(true);
    try {
      const nextAvatarUrl = await uploadProfileAvatar({
        userId,
        uri: asset.uri,
        mimeType: asset.mimeType ?? null,
        base64Data: asset.base64 ?? null,
      });
      setAvatarUrl(nextAvatarUrl);
      bumpProfileVersion();
      Alert.alert('成功', '头像已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败，请稍后重试';
      if (message.includes('Bucket not found')) {
        Alert.alert('上传失败', '未找到 avatars 存储桶。请先执行数据库迁移：npx supabase db push');
      } else {
        Alert.alert('上传失败', message);
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(64,56,112,0.22)',
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%', maxWidth: 520 }}>
          <View
            style={{
              borderRadius: 28,
              backgroundColor: 'rgba(244,241,255,0.96)',
              paddingHorizontal: 18,
              paddingTop: 20,
              paddingBottom: Platform.OS === 'ios' ? 18 : 14,
              shadowColor: Colors.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 22,
              elevation: 8,
            }}
          >
            <View className="items-center">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickAvatar}
                disabled={saving || avatarUploading}
                style={{
                  width: 124,
                  height: 124,
                  borderRadius: 62,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(202,192,240,0.36)',
                  borderWidth: 1,
                  borderColor: 'rgba(170,155,232,0.45)',
                  opacity: saving || avatarUploading ? 0.7 : 1,
                }}
              >
                <Avatar
                  uri={avatarUrl}
                  name={avatarUrl ? displayName : undefined}
                  showCamera={!avatarUrl}
                  size="lg"
                />
              </TouchableOpacity>
              <View className="flex-row items-center mt-2">
                {avatarUploading ? (
                  <>
                    <ActivityIndicator size="small" color="#6E63A8" />
                    <Text className="text-base ml-1" style={{ color: '#6E63A8' }}>正在上传...</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera-outline" size={14} color="#6E63A8" />
                    <Text className="text-base ml-1" style={{ color: '#6E63A8' }}>上传头像</Text>
                  </>
                )}
              </View>
            </View>

            <View className="mt-5">
              <Text className="text-lg font-medium text-gray-800 mb-2">显示名称</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="请输入的显示名称"
                placeholderTextColor="#b8b3c8"
                className="w-full rounded-full bg-white px-5 text-lg text-gray-800"
                style={{ height: 52 }}
                maxLength={40}
              />
            </View>

            <View className="mt-4">
              <Text className="text-lg font-medium text-gray-800 mb-2">邮箱</Text>
              <TextInput
                value={email ?? ''}
                editable={false}
                selectTextOnFocus={false}
                placeholder="user@example.com"
                placeholderTextColor="#9ba0a8"
                className="w-full rounded-full px-5 text-lg"
                style={{
                  height: 52,
                  backgroundColor: 'rgba(156,163,175,0.22)',
                  color: '#6b7280',
                }}
              />
            </View>

            <View className="flex-row mt-7">
              <TouchableOpacity
                onPress={onClose}
                disabled={saving}
                activeOpacity={0.85}
                className="flex-1 mr-2 items-center justify-center rounded-full"
                style={{
                  height: 52,
                  backgroundColor: '#7762EA',
                  opacity: saving ? 0.75 : 1,
                }}
              >
                <Text className="text-white text-2xl font-semibold">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
                className="flex-1 ml-2 items-center justify-center rounded-full"
                style={{
                  height: 52,
                  backgroundColor: '#7762EA',
                  opacity: saving ? 0.75 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-2xl font-semibold">完成</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

    </Modal>
  );
}
