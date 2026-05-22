import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { ensureProfileForUser } from '@/lib/profile';
import { inferImageExtension, uploadImageFromUri } from '@/lib/uploadImage';
import { useAuthStore } from '@/stores/authStore';

const CURRENCIES = [
  { label: '人民币（CNY）', value: 'CNY' },
  { label: '美元（USD）', value: 'USD' },
  { label: '欧元（EUR）', value: 'EUR' },
  { label: '港元（HKD）', value: 'HKD' },
];

const FAMILY_AVATARS = ['🏠', '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👪', '🪙', '💰', '🌟', '🍀', '🐷', '🏡', '💎', '📈'];

export interface FamilyDetail {
  id: number;
  family_name: string;
  family_avatar: string | null;
  currency: string;
  debt_warning_threshold: number;
  repayment_reminder_switch: 0 | 1;
  data_export_switch: 0 | 1;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (family?: FamilyDetail) => void | Promise<void>;
  mode?: 'create' | 'view';
  initialData?: FamilyDetail;
}

export function FamilySettingsModal({
  visible,
  onClose,
  onSuccess,
  mode = 'create',
  initialData,
}: Props) {
  const { user } = useAuthStore();

  const [familyName, setFamilyName] = useState('我的家庭');
  const [currency, setCurrency] = useState('CNY');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [debtThreshold, setDebtThreshold] = useState(20);
  const [repaymentReminder, setRepaymentReminder] = useState(true);
  const [dataExport, setDataExport] = useState(false);
  const [familyAvatar, setFamilyAvatar] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens in view mode
  useEffect(() => {
    if (visible && mode === 'view' && initialData) {
      setFamilyName(initialData.family_name);
      setFamilyAvatar(initialData.family_avatar);
      setCurrency(initialData.currency);
      setDebtThreshold(Number(initialData.debt_warning_threshold));
      setRepaymentReminder(initialData.repayment_reminder_switch === 1);
      setDataExport(initialData.data_export_switch === 1);
    }
    if (visible && mode === 'create') {
      setFamilyName('我的家庭');
      setFamilyAvatar(null);
      setCurrency('CNY');
      setDebtThreshold(20);
      setRepaymentReminder(true);
      setDataExport(false);
    }
  }, [visible, mode, initialData]);

  const selectedCurrencyLabel =
    CURRENCIES.find((c) => c.value === currency)?.label ?? currency;

  async function uploadFamilyAvatar(uri: string, mimeType?: string | null, base64Data?: string | null) {
    if (!user) {
      Alert.alert('提示', '请先登录后再上传头像');
      return;
    }

    setAvatarUploading(true);
    try {
      const extension = inferImageExtension(uri, mimeType);
      // storage RLS requires first folder segment to equal auth.uid()
      const objectPath = `${user.id}/family-avatar-${Date.now()}.${extension}`;
      const avatarUrl = await uploadImageFromUri({
        bucket: 'avatars',
        objectPath,
        uri,
        mimeType,
        base64Data,
      });
      setFamilyAvatar(avatarUrl);
      setShowAvatarPicker(false);
      Alert.alert('成功', '已选择本地头像，点击保存后生效');
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

  async function pickFamilyAvatarFromLibrary() {
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

    await uploadFamilyAvatar(asset.uri, asset.mimeType ?? null, asset.base64 ?? null);
  }

  function pickPresetFamilyAvatar(emoji: string) {
    setFamilyAvatar(`emoji:${emoji}`);
    setShowAvatarPicker(false);
    Alert.alert('成功', '已选择预设头像，点击保存后生效');
  }

  async function loadOwnCreatedFamily() {
    if (!user) return null;

    const { data, error } = await supabase
      .from('families')
      .select('id, family_name, family_avatar, currency, debt_warning_threshold, repayment_reminder_switch, data_export_switch')
      .eq('creator_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      family_name: data.family_name,
      family_avatar: data.family_avatar,
      currency: data.currency,
      debt_warning_threshold: Number(data.debt_warning_threshold),
      repayment_reminder_switch: data.repayment_reminder_switch,
      data_export_switch: data.data_export_switch,
    } satisfies FamilyDetail;
  }

  async function handleSave() {
    if (!familyName.trim()) {
      Alert.alert('提示', '请输入家庭名称');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      let error;
      let savedFamily: FamilyDetail | undefined;
      if (mode === 'create') {
        await ensureProfileForUser(user);
        const { error: insertError } = await supabase
          .from('families')
          .insert({
            family_name: familyName.trim(),
            creator_id: user.id,
            family_avatar: familyAvatar,
            currency,
            debt_warning_threshold: debtThreshold,
            repayment_reminder_switch: (repaymentReminder ? 1 : 0) as 0 | 1,
            data_export_switch: (dataExport ? 1 : 0) as 0 | 1,
          });

        error = insertError;
        if (!error) {
          savedFamily = (await loadOwnCreatedFamily()) ?? undefined;
        }
      } else {
        const ownCreatedFamily = await loadOwnCreatedFamily();
        if (!ownCreatedFamily || ownCreatedFamily.id !== initialData!.id) {
          Alert.alert('保存失败', '只有家庭创建者可以修改家庭设置');
          return;
        }

        const { error: updateError } = await supabase
          .from('families')
          .update({
            family_name: familyName.trim(),
            family_avatar: familyAvatar,
            currency,
            debt_warning_threshold: debtThreshold,
            repayment_reminder_switch: (repaymentReminder ? 1 : 0) as 0 | 1,
            data_export_switch: (dataExport ? 1 : 0) as 0 | 1,
          })
          .eq('id', initialData!.id);

        error = updateError;
        if (!error) {
          savedFamily = (await loadOwnCreatedFamily()) ?? {
            ...initialData!,
            family_name: familyName.trim(),
            family_avatar: familyAvatar,
            currency,
            debt_warning_threshold: debtThreshold,
            repayment_reminder_switch: (repaymentReminder ? 1 : 0) as 0 | 1,
            data_export_switch: (dataExport ? 1 : 0) as 0 | 1,
          };
        }
      }

      if (error) {
        if (mode === 'create' && error.code === '23505') {
          const existingFamily = await loadOwnCreatedFamily();
          if (existingFamily) {
            await onSuccess?.(existingFamily);
            onClose();
            return;
          }
        }

        const msg =
          error.code === '23505'
            ? '您已创建过家庭，每个账号只能创建一个家庭。'
            : error.message;
        Alert.alert('保存失败', msg);
        return;
      }

      await onSuccess?.(savedFamily);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后重试';
      Alert.alert('保存失败', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(124,58,237,0.18)', justifyContent: 'flex-end' }}
      >
        {/* Sheet — stop propagation so taps inside don't close */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View
            style={{
              backgroundColor: '#F5F3FF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            }}
          >
            {/* Drag handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-purple-200" />
            </View>

            {/* Title */}
            <Text className="text-center text-base font-semibold text-gray-800 py-3">
              {mode === 'view' ? '家庭设置' : '创建家庭'}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            >
              {/* ── Family avatar ── */}
              <TouchableOpacity
                onPress={() => setShowAvatarPicker(true)}
                activeOpacity={0.85}
                className="items-center mb-6"
                disabled={avatarUploading || saving}
              >
                <View
                  className="items-center justify-center rounded-full overflow-hidden"
                  style={{
                    width: 88,
                    height: 88,
                    backgroundColor: 'rgba(167,139,250,0.18)',
                    borderWidth: 2,
                    borderColor: 'rgba(167,139,250,0.35)',
                    borderStyle: 'dashed',
                  }}
                >
                  {avatarUploading ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : familyAvatar?.startsWith('emoji:') ? (
                    <Text style={{ fontSize: 36 }}>{familyAvatar.slice('emoji:'.length)}</Text>
                  ) : familyAvatar ? (
                    <Image source={{ uri: familyAvatar }} style={{ width: 88, height: 88 }} />
                  ) : (
                    <Text style={{ fontSize: 28 }}>📷</Text>
                  )}
                </View>
                <Text className="text-xs text-purple-400 mt-2">上传家庭照片</Text>
              </TouchableOpacity>

              {/* ── Form card ── */}
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.82)', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }}
              >
                {/* 家庭名称 */}
                <View className="flex-row items-center px-4 py-3.5 border-b border-purple-50">
                  <Text className="text-sm font-medium text-gray-700 w-20">家庭名称</Text>
                  <TextInput
                    value={familyName}
                    onChangeText={setFamilyName}
                    placeholder="请输入家庭名称"
                    placeholderTextColor="#c4b5fd"
                    className="flex-1 text-sm text-gray-800 text-right"
                  />
                </View>

                {/* 货币类型 */}
                <TouchableOpacity
                  onPress={() => setShowCurrencyPicker(true)}
                  className="flex-row items-center px-4 py-3.5"
                >
                  <Text className="text-sm font-medium text-gray-700 w-20">货币类型</Text>
                  <View className="flex-1 flex-row items-center justify-end">
                    <Text className="text-sm text-gray-600 mr-1">{selectedCurrencyLabel}</Text>
                    <Text className="text-gray-400">›</Text>
                  </View>
                </TouchableOpacity>
              </View>

                {/* ── Save button ── */}
                <TouchableOpacity
                  onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
                className="mt-6 rounded-2xl py-4 items-center"
                style={{ backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-semibold">保存</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Currency picker sheet */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowCurrencyPicker(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              }}
            >
              <View className="items-center pt-3 pb-2">
                <View className="w-10 h-1 rounded-full bg-gray-200" />
              </View>
              <Text className="text-center text-base font-semibold text-gray-800 mb-2">
                选择货币
              </Text>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => { setCurrency(c.value); setShowCurrencyPicker(false); }}
                  className="flex-row items-center justify-between px-6 py-4 border-b border-gray-50"
                >
                  <Text className="text-sm text-gray-800">{c.label}</Text>
                  {currency === c.value && (
                    <Text style={{ color: Colors.primary, fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Family avatar picker sheet */}
      <Modal
        visible={showAvatarPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowAvatarPicker(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              }}
            >
              <View className="items-center pt-3 pb-2">
                <View className="w-10 h-1 rounded-full bg-gray-200" />
              </View>
              <Text className="text-center text-base font-semibold text-gray-800 mb-3">
                选择家庭头像
              </Text>

              <TouchableOpacity
                onPress={pickFamilyAvatarFromLibrary}
                disabled={avatarUploading}
                className="mx-5 mb-4 rounded-xl py-3 items-center"
                style={{ backgroundColor: Colors.primaryLight, opacity: avatarUploading ? 0.7 : 1 }}
              >
                {avatarUploading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={{ color: Colors.primary, fontWeight: '600' }}>从相册上传</Text>
                )}
              </TouchableOpacity>

              <Text className="text-xs text-gray-400 px-5 mb-2">系统预设头像</Text>
              <View className="px-5" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {FAMILY_AVATARS.map((emoji) => {
                  const selected = familyAvatar === `emoji:${emoji}`;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => pickPresetFamilyAvatar(emoji)}
                      className="w-12 h-12 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: selected ? Colors.primaryMid : '#F3F4F6',
                        borderWidth: selected ? 1.5 : 0,
                        borderColor: selected ? Colors.primary : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}
