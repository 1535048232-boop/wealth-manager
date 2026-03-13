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
} from 'react-native';
import { useState, useEffect } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// ─── Asset Type Definitions ──────────────────────────────────────────────────

type DbAccountType = '银行卡' | '支付宝' | '微信' | '公积金' | '股票' | '期权' | '现金' | '保险' | '基金';
type DbAssetQuadrant = 'A类保值' | 'B类消费' | 'C类投资' | 'D类保障';

interface AssetTypeItem {
  dbValue: DbAccountType;
  label: string;
  emoji: string;
  bgColor: string;
}

const ASSET_TYPES: AssetTypeItem[] = [
  { dbValue: '银行卡', label: '银行卡', emoji: '💳', bgColor: '#EEF2FF' },
  { dbValue: '支付宝', label: '支付宝', emoji: '💰', bgColor: '#EFF6FF' },
  { dbValue: '微信',   label: '微信',   emoji: '💬', bgColor: '#F0FDF4' },
  { dbValue: '公积金', label: '公积金', emoji: '🏠', bgColor: '#F5F3FF' },
  { dbValue: '股票',   label: '股票',   emoji: '📈', bgColor: '#FFF7ED' },
  { dbValue: '期权',   label: '期权',   emoji: '📊', bgColor: '#FFF7ED' },
  { dbValue: '现金',   label: '现金',   emoji: '💵', bgColor: '#FFFBEB' },
  { dbValue: '保险',   label: '保险',   emoji: '🛡️', bgColor: '#F0FDFA' },
  { dbValue: '基金',   label: '基金',   emoji: '📉', bgColor: '#F5F3FF' },
];

const OPTIONAL_BASIC_FIELDS_TYPES = new Set<DbAccountType>(['支付宝', '微信', '公积金', '现金']);

// ─── Asset Classification ────────────────────────────────────────────────────

type AssetClass = DbAssetQuadrant;

interface AssetClassItem {
  key: DbAssetQuadrant;
  label: string;
  sublabel: string;
  emoji: string;
  bgColor: string;
  selectedBg: string;
  selectedBorder: string;
}

const ASSET_CLASSES: AssetClassItem[] = [
  { key: 'A类保值', label: 'A类保值', sublabel: '储蓄/现金',  emoji: '🏦', bgColor: '#F5F3FF', selectedBg: '#EDE9FE', selectedBorder: '#7C3AED' },
  { key: 'B类消费', label: 'B类消费', sublabel: '日常消费',    emoji: '🛒', bgColor: '#FFF7ED', selectedBg: '#FFEDD5', selectedBorder: '#F97316' },
  { key: 'C类投资', label: 'C类投资', sublabel: '股票/基金',   emoji: '📈', bgColor: '#FFFBEB', selectedBg: '#FEF3C7', selectedBorder: '#F59E0B' },
  { key: 'D类保障', label: 'D类保障', sublabel: '保险/公积金', emoji: '🛡️', bgColor: '#F0FDFA', selectedBg: '#CCFBF1', selectedBorder: '#14B8A6' },
];


// ─── Stage type ──────────────────────────────────────────────────────────────

type Stage = 'type-select' | 'create-form' | 'success';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onGoToList?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddAssetAccountModal({ visible, onClose, onGoToList }: Props) {
  const { user } = useAuthStore();

  const [stage, setStage] = useState<Stage>('type-select');
  const [selectedType, setSelectedType] = useState<AssetTypeItem | null>(null);
  const [accountName, setAccountName] = useState('');
  const [institution, setInstitution] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('A类保值');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState<number | null>(null);
  const skipBasicFields = selectedType ? OPTIONAL_BASIC_FIELDS_TYPES.has(selectedType.dbValue) : false;

  // ── Created account summary (for success screen) ──────────────────────────
  const [createdAccount, setCreatedAccount] = useState<{
    name: string;
    typeName: string;
    institution: string;
    assetClass: DbAssetQuadrant;
  } | null>(null);

  // ── Fetch current user's family member ID ─────────────────────────────────
  useEffect(() => {
    if (!visible || !user) return;
    supabase
      .from('family_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 1)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setMemberId((data as any).id); });
  }, [visible, user?.id]);

  function resetForm() {
    setStage('type-select');
    setSelectedType(null);
    setAccountName('');
    setInstitution('');
    setAssetClass('A类保值');
    setRemark('');
    setCreatedAccount(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSelectType(item: AssetTypeItem) {
    setSelectedType(item);
    setStage('create-form');
  }

  async function handleCreate() {
    const normalizedAccountName = skipBasicFields
      ? (accountName.trim() || selectedType?.label || '')
      : accountName.trim();

    if (!skipBasicFields && !normalizedAccountName) {
      Alert.alert('提示', '请输入账户名称');
      return;
    }
    if (!user) return;
    if (!memberId) {
      Alert.alert('提示', '您尚未加入任何家庭，请先创建或加入家庭');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('asset_accounts').insert({
        member_id: memberId,
        account_name: normalizedAccountName,
        account_type: selectedType!.dbValue,
        institution: skipBasicFields ? null : (institution.trim() || null),
        asset_quadrant: assetClass,
        description: remark.trim() || null,
        status: 1,
      });

      if (error) {
        Alert.alert('创建失败', error.message);
        return;
      }

      setCreatedAccount({
        name: normalizedAccountName,
        typeName: selectedType?.label ?? '',
        institution: skipBasicFields ? '' : institution.trim(),
        assetClass,
      });
      setStage('success');
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  function renderTypeSelect() {
    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
          <TouchableOpacity onPress={handleClose} style={{ padding: 4, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: Colors.text.secondary }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: Colors.text.primary, marginRight: 32 }}>
            添加资产账户
          </Text>
        </View>

        {/* 3×3 grid */}
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {[0, 1, 2].map((row) => (
            <View
              key={row}
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}
            >
              {ASSET_TYPES.slice(row * 3, row * 3 + 3).map((item) => (
                <TouchableOpacity
                  key={item.dbValue}
                  onPress={() => handleSelectType(item)}
                  activeOpacity={0.75}
                  style={{
                    width: '31%',
                    aspectRatio: 1,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.72)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: Colors.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 1,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: item.bgColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.text.primary }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* Cancel button */}
        <TouchableOpacity
          onPress={handleClose}
          style={{
            marginHorizontal: 20,
            marginTop: 8,
            marginBottom: Platform.OS === 'ios' ? 10 : 8,
            paddingVertical: 14,
            borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.70)',
            alignItems: 'center',
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 1,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '500', color: Colors.text.secondary }}>取消</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderCreateForm() {
    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => setStage('type-select')} style={{ padding: 4, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: Colors.text.secondary }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: Colors.text.primary, marginRight: 32 }}>
            创建账户
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        >
          {/* ── Form card ── */}
          <View
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.82)',
              shadowColor: Colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 8,
              elevation: 2,
              marginBottom: 16,
            }}
          >
            {skipBasicFields ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <Text style={{ fontSize: 13, color: Colors.text.secondary }}>
                  当前类型无需填写“账户名称”和“所属机构/开户行”。
                </Text>
              </View>
            ) : (
              <>
                {/* 账户名称 */}
                <View style={{ borderBottomWidth: 1, borderBottomColor: '#F3F0FF', paddingHorizontal: 16, paddingVertical: 14 }}>
                  <TextInput
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="账户名称"
                    placeholderTextColor="#c4b5fd"
                    style={{ fontSize: 15, color: Colors.text.primary }}
                  />
                </View>

                {/* 所属机构/开户行 */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                  <TextInput
                    value={institution}
                    onChangeText={setInstitution}
                    placeholder="所属机构/开户行"
                    placeholderTextColor="#c4b5fd"
                    style={{ fontSize: 15, color: Colors.text.primary }}
                  />
                </View>
              </>
            )}
          </View>

          {/* 资产类全 */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 10 }}>资产类全</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {ASSET_CLASSES.map((cls) => {
              const isSelected = assetClass === cls.key;
              return (
                <TouchableOpacity
                  key={cls.key}
                  onPress={() => setAssetClass(cls.key)}
                  activeOpacity={0.75}
                  style={{
                    width: '47%',
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    backgroundColor: isSelected ? cls.selectedBg : 'rgba(255,255,255,0.82)',
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected ? cls.selectedBorder : 'rgba(167,139,250,0.2)',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 10 }}>{cls.emoji}</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text.primary }}>{cls.label}</Text>
                    <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 1 }}>{cls.sublabel}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 备注 */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 10 }}>备注</Text>
          <View
            style={{
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.82)',
              borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.2)',
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 16,
              minHeight: 80,
              shadowColor: Colors.shadow,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 1,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <TextInput
              value={remark}
              onChangeText={setRemark}
              multiline
              numberOfLines={3}
              placeholder="备注（选填）"
              placeholderTextColor="#c4b5fd"
              style={{ fontSize: 14, color: Colors.text.primary, textAlignVertical: 'top' }}
            />
          </View>

          {/* 状态 */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.82)',
              borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.2)',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.text.primary }}>状态</Text>
            <Text style={{ fontSize: 14, color: Colors.text.secondary }}>正常</Text>
          </View>

          {/* 创建 button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.82}
            style={{
              paddingVertical: 15,
              borderRadius: 28,
              backgroundColor: saving ? Colors.primaryLight : Colors.primary,
              alignItems: 'center',
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>创建</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  function renderSuccess() {
    if (!createdAccount) return null;
    const cls = ASSET_CLASSES.find((c) => c.key === createdAccount.assetClass)!;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Checkmark */}
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(124,58,237,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: Colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 22 }}>✓</Text>
          </View>
        </View>

        <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginBottom: 20 }}>
          资产账户创建成功
        </Text>

        {/* Details card */}
        <View
          style={{
            width: '100%',
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.88)',
            paddingVertical: 20,
            paddingHorizontal: 20,
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 2,
            marginBottom: 32,
          }}
        >
          <DetailRow label="账户名称" value={createdAccount.name} />
          <DetailRow label="类型" value={selectedType?.label ?? ''} />
          {createdAccount.institution ? (
            <DetailRow label="所属机构" value={createdAccount.institution} />
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
            <Text style={{ fontSize: 13, color: Colors.text.secondary, minWidth: 64 }}>分类标签</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 20,
                backgroundColor: cls.selectedBg,
                borderWidth: 1,
                borderColor: cls.selectedBorder,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: cls.selectedBorder }}>
                {cls.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              onGoToList?.();
              onClose();
            }}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 28,
              backgroundColor: 'rgba(255,255,255,0.88)',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.3)',
              shadowColor: Colors.shadow,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 1,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text.secondary }}>返回资产列表</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setStage('type-select');
              setSelectedType(null);
              setAccountName('');
              setInstitution('');
              setAssetClass('A类保值');
              setRemark('');
              setCreatedAccount(null);
            }}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 28,
              backgroundColor: Colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>继续添加账户</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      {/* Backdrop – tap outside to close (only on type-select) */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={stage === 'type-select' ? handleClose : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(124,58,237,0.22)', justifyContent: 'flex-end' }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={{
            backgroundColor: '#F0EEFF',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            maxHeight: '90%',
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(124,58,237,0.25)' }} />
          </View>

          {stage === 'type-select' && renderTypeSelect()}
          {stage === 'create-form' && renderCreateForm()}
          {stage === 'success' && renderSuccess()}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
      <Text style={{ fontSize: 13, color: Colors.text.secondary, minWidth: 64 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.text.primary, flex: 1 }}>{value}</Text>
    </View>
  );
}
