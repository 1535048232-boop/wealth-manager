import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from '@/constants/Colors';
import { Avatar } from './Avatar';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';

interface AvatarPickerModalProps {
  visible: boolean;
  userId?: string;
  displayName?: string;
  currentAvatarUrl?: string | null;
  onClose: () => void;
  onUploaded: (avatarUrl: string) => void;
}

const DECORATIONS = ['🐷', '🏠', '🪙', '💰', '🐽', '🏡', '💸', '👨‍👩‍👧', '👫', '👨‍👩‍👧‍👦', '👨‍👩‍👦', '👨‍👩‍👧'];

function inferExtension(uri: string, mimeType?: string | null) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (uri.toLowerCase().endsWith('.png')) return 'png';
  if (uri.toLowerCase().endsWith('.webp')) return 'webp';
  return 'jpg';
}

export function AvatarPickerModal({
  visible,
  userId,
  displayName,
  currentAvatarUrl,
  onClose,
  onUploaded,
}: AvatarPickerModalProps) {
  const bumpProfileVersion = useAppStore((state) => state.bumpProfileVersion);
  const [uploading, setUploading] = useState(false);

  const topTitle = useMemo(() => (currentAvatarUrl ? '当前头像' : '设置头像'), [currentAvatarUrl]);

  async function saveAvatarUrl(nextAvatarUrl: string, successMsg: string) {
    if (!userId) {
      Alert.alert('提示', '请先登录后再设置头像');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: nextAvatarUrl })
      .eq('id', userId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    onUploaded(nextAvatarUrl);
    bumpProfileVersion();
    onClose();
    Alert.alert('成功', successMsg);
  }

  async function uploadAvatar(uri: string, mimeType?: string | null) {
    if (!userId) {
      Alert.alert('提示', '请先登录后再上传头像');
      return;
    }

    setUploading(true);
    try {
      const extension = inferExtension(uri, mimeType);
      const contentType = mimeType ?? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg');
      const objectPath = `${userId}/avatar-${Date.now()}.${extension}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(objectPath, blob, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
      const avatarUrl = data.publicUrl;

      await saveAvatarUrl(avatarUrl, '头像已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败，请稍后重试';
      if (message.includes('Bucket not found')) {
        Alert.alert('上传失败', '未找到 avatars 存储桶。请先执行数据库迁移：npx supabase db push');
      } else {
        Alert.alert('上传失败', message);
      }
    } finally {
      setUploading(false);
    }
  }

  async function pickEmojiAvatar(emoji: string) {
    setUploading(true);
    try {
      await saveAvatarUrl(`emoji:${emoji}`, '头像已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后重试';
      Alert.alert('保存失败', message);
    } finally {
      setUploading(false);
    }
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', '请先允许访问相册');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    await uploadAvatar(asset.uri, asset.mimeType);
  }

  async function takePhoto() {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert('权限不足', '请先允许访问相机');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    await uploadAvatar(asset.uri, asset.mimeType);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(28,27,46,0.12)',
          justifyContent: 'center',
          paddingHorizontal: 18,
        }}
      >
        <View
          style={{
            borderRadius: 34,
            backgroundColor: 'rgba(255,255,255,0.78)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.65)',
            padding: 18,
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 1,
            shadowRadius: 22,
            elevation: 6,
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>

          <View
            style={{
              marginTop: 10,
              borderRadius: 26,
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderWidth: 1,
              borderColor: Colors.border,
              paddingHorizontal: 14,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Avatar
              uri={currentAvatarUrl}
              name={currentAvatarUrl ? displayName : undefined}
              showCamera={!currentAvatarUrl}
              size="lg"
            />
            <Text style={{ marginLeft: 14, color: Colors.text.primary, fontSize: 34, fontWeight: '600' }}>
              {topTitle}
            </Text>
          </View>

          <View
            style={{
              marginTop: 16,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.55)',
              borderWidth: 1,
              borderColor: Colors.border,
              paddingHorizontal: 12,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            <Text style={{ color: Colors.text.secondary, fontSize: 16, fontWeight: '500', marginBottom: 10 }}>
              系统预设
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {DECORATIONS.map((item, index) => (
                <TouchableOpacity
                  key={`${item}-${index}`}
                  onPress={() => pickEmojiAvatar(item)}
                  disabled={uploading}
                  style={{
                    width: '23%',
                    aspectRatio: 1,
                    borderRadius: 20,
                    marginBottom: 10,
                    backgroundColor: 'rgba(255,255,255,0.72)',
                    borderWidth: 1,
                    borderColor: currentAvatarUrl === `emoji:${item}` ? Colors.primary : 'rgba(255,255,255,0.7)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: uploading ? 0.65 : 1,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <TouchableOpacity
              onPress={pickFromLibrary}
              disabled={uploading}
              style={{
                flex: 1,
                marginRight: 8,
                borderRadius: 26,
                backgroundColor: 'rgba(255,255,255,0.75)',
                borderWidth: 1,
                borderColor: Colors.border,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.text.primary, fontSize: 16, fontWeight: '600' }}>从相册选择</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePhoto}
              disabled={uploading || Platform.OS === 'web'}
              style={{
                flex: 1,
                marginLeft: 8,
                borderRadius: 26,
                backgroundColor: Platform.OS === 'web' ? 'rgba(209,213,219,0.7)' : 'rgba(255,255,255,0.75)',
                borderWidth: 1,
                borderColor: Colors.border,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.text.primary, fontSize: 16, fontWeight: '600' }}>拍照</Text>
            </TouchableOpacity>
          </View>

          {uploading && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={{ marginLeft: 8, color: Colors.text.secondary, fontSize: 13 }}>正在保存头像...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
