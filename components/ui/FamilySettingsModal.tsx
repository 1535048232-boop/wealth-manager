import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const CURRENCIES = [
  { label: '人民币（CNY）', value: 'CNY' },
  { label: '美元（USD）', value: 'USD' },
  { label: '欧元（EUR）', value: 'EUR' },
  { label: '港元（HKD）', value: 'HKD' },
];

export interface FamilyDetail {
  id: number;
  family_name: string;
  currency: string;
  debt_warning_threshold: number;
  repayment_reminder_switch: 0 | 1;
  data_export_switch: 0 | 1;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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
  const [debtThreshold, setDebtThreshold] = useState(20);
  const [repaymentReminder, setRepaymentReminder] = useState(true);
  const [dataExport, setDataExport] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens in view mode
  useEffect(() => {
    if (visible && mode === 'view' && initialData) {
      setFamilyName(initialData.family_name);
      setCurrency(initialData.currency);
      setDebtThreshold(Number(initialData.debt_warning_threshold));
      setRepaymentReminder(initialData.repayment_reminder_switch === 1);
      setDataExport(initialData.data_export_switch === 1);
    }
    if (visible && mode === 'create') {
      setFamilyName('我的家庭');
      setCurrency('CNY');
      setDebtThreshold(20);
      setRepaymentReminder(true);
      setDataExport(false);
    }
  }, [visible, mode, initialData]);

  const selectedCurrencyLabel =
    CURRENCIES.find((c) => c.value === currency)?.label ?? currency;

  async function handleSave() {
    if (!familyName.trim()) {
      Alert.alert('提示', '请输入家庭名称');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      let error;
      if (mode === 'create') {
        ({ error } = await supabase.from('families').insert({
          family_name: familyName.trim(),
          creator_id: user.id,
          currency,
          debt_warning_threshold: debtThreshold,
          repayment_reminder_switch: (repaymentReminder ? 1 : 0) as 0 | 1,
          data_export_switch: (dataExport ? 1 : 0) as 0 | 1,
        }));
      } else {
        ({ error } = await supabase.from('families').update({
          family_name: familyName.trim(),
          currency,
          debt_warning_threshold: debtThreshold,
          repayment_reminder_switch: (repaymentReminder ? 1 : 0) as 0 | 1,
          data_export_switch: (dataExport ? 1 : 0) as 0 | 1,
        }).eq('id', initialData!.id));
      }

      if (error) {
        const msg =
          error.code === '23505'
            ? '您已创建过家庭，每个账号只能创建一个家庭。'
            : error.message;
        Alert.alert('保存失败', msg);
        return;
      }

      onSuccess?.();
      onClose();
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
              {/* ── Avatar placeholder ── */}
              <View className="items-center mb-6">
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 88,
                    height: 88,
                    backgroundColor: 'rgba(167,139,250,0.18)',
                    borderWidth: 2,
                    borderColor: 'rgba(167,139,250,0.35)',
                    borderStyle: 'dashed',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>📷</Text>
                </View>
                <Text className="text-xs text-purple-400 mt-2">上传家庭照片</Text>
              </View>

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

              {/* ── Debt threshold card ── */}
              <View
                className="rounded-2xl px-4 pt-3.5 pb-2 mt-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.82)', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-sm font-medium text-gray-700">负债预警阈值</Text>
                  <View
                    className="px-3 py-1 rounded-lg"
                    style={{ backgroundColor: Colors.primaryMid }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: Colors.primary }}>
                      {debtThreshold}%
                    </Text>
                  </View>
                </View>
                <Slider
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={debtThreshold}
                  onValueChange={(v) => setDebtThreshold(Math.round(v))}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor="#DDD6FE"
                  thumbTintColor={Colors.primary}
                  style={{ marginHorizontal: -4 }}
                />
                <View className="flex-row justify-between mt-0.5 mb-1">
                  <Text className="text-xs text-purple-300">0%</Text>
                  <Text className="text-xs text-purple-300">100%</Text>
                </View>
              </View>

              {/* ── Toggle card ── */}
              <View
                className="rounded-2xl overflow-hidden mt-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.82)', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }}
              >
                <View className="flex-row items-center px-4 py-3 border-b border-purple-50">
                  <Text className="flex-1 text-sm font-medium text-gray-700">还款提醒</Text>
                  <Switch
                    value={repaymentReminder}
                    onValueChange={setRepaymentReminder}
                    trackColor={{ false: '#E5E7EB', true: Colors.primaryLight }}
                    thumbColor={Platform.OS === 'android' ? (repaymentReminder ? Colors.primary : '#fff') : '#fff'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
                <View className="flex-row items-center px-4 py-3">
                  <Text className="flex-1 text-sm font-medium text-gray-700">数据导出</Text>
                  <Switch
                    value={dataExport}
                    onValueChange={setDataExport}
                    trackColor={{ false: '#E5E7EB', true: Colors.primaryLight }}
                    thumbColor={Platform.OS === 'android' ? (dataExport ? Colors.primary : '#fff') : '#fff'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
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
    </Modal>
  );
}
