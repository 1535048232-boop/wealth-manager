import { View, Text, ScrollView, TouchableOpacity, Switch, Platform, Modal, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { FamilySettingsModal, FamilyDetail } from '@/components/ui/FamilySettingsModal';
import { AddAssetAccountModal } from '@/components/ui/AddAssetAccountModal';
import { AssetAccountListModal } from '@/components/ui/AssetAccountListModal';
import { ProfileEditModal } from '../../components/ui/ProfileEditModal';

type Profile = { display_name: string | null; avatar_url: string | null };
type Family = FamilyDetail;
type FamilyMember = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  role: 'admin' | 'member' | 'guest';
  joinSource: 'creator' | 'invite';
  status: 1 | 0 | -1;
};

// ─── Reusable row components ────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-5 pt-6 pb-2">
      {title}
    </Text>
  );
}

function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }}>
      {children}
    </View>
  );
}

function SettingRow({
  label,
  sublabel,
  value,
  onPress,
  last = false,
}: {
  label: string;
  sublabel?: string;
  value?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      className={`flex-row items-center px-4 py-3.5 ${!last ? 'border-b border-gray-50' : ''}`}
    >
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">{label}</Text>
        {sublabel ? <Text className="text-xs text-gray-400 mt-0.5">{sublabel}</Text> : null}
      </View>
      {value}
      {onPress ? (
        <Text className="text-gray-300 text-base ml-1">›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function ToggleRow({ label, sublabel, value, onChange, last = false }: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center px-4 py-3 ${!last ? 'border-b border-gray-50' : ''}`}>
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">{label}</Text>
        {sublabel ? <Text className="text-xs text-gray-400 mt-0.5">{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E5E7EB', true: Colors.primaryLight }}
        thumbColor={Platform.OS === 'android' ? (value ? Colors.primary : '#fff') : '#fff'}
        ios_backgroundColor="#E5E7EB"
      />
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const profileVersion = useAppStore((state) => state.profileVersion);
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [biometric, setBiometric] = useState(false);
  const [repaymentReminder, setRepaymentReminder] = useState(true);
  const [monthlyReport, setMonthlyReport] = useState(true);
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [familyModalMode, setFamilyModalMode] = useState<'create' | 'view'>('create');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAssetList, setShowAssetList] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyMembersLoading, setFamilyMembersLoading] = useState(false);
  const [showFamilyMembers, setShowFamilyMembers] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  async function loadFamily() {
    if (!user) return;

    // Step 1: find the member row by profile_id
    const { data: memberData } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('profile_id', user.id)
      .eq('status', 1)
      .maybeSingle();

    if (!memberData?.family_id) {
      setFamily(null);
      setFamilyMembers([]);
      return;
    }

    // Step 2: fetch full family details by family_id
    const { data: familyData } = await supabase
      .from('families')
      .select('id, family_name, currency, debt_warning_threshold, repayment_reminder_switch, data_export_switch')
      .eq('id', memberData.family_id)
      .maybeSingle();

    const f = familyData as {
      id: number;
      family_name: string;
      currency: string;
      debt_warning_threshold: number;
      repayment_reminder_switch: 0 | 1;
      data_export_switch: 0 | 1;
    } | null;

    if (f) setFamily({
      id: f.id,
      family_name: f.family_name,
      currency: f.currency,
      debt_warning_threshold: Number(f.debt_warning_threshold),
      repayment_reminder_switch: f.repayment_reminder_switch,
      data_export_switch: f.data_export_switch,
    });
    else setFamily(null);

    // Step 3: fetch active family members for UI preview/list
    setFamilyMembersLoading(true);
    try {
      const { data: membersData } = await supabase
        .from('family_members')
        .select('id, role, join_source, status, profiles:profile_id(display_name, avatar_url)')
        .eq('family_id', memberData.family_id)
        .in('status', [1, -1])
        .order('id', { ascending: true });

      const members = (membersData ?? []).map((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id as number,
          displayName: profile?.display_name ?? `成员${row.id}`,
          avatarUrl: profile?.avatar_url ?? null,
          role: (row.role ?? 'member') as 'admin' | 'member' | 'guest',
          joinSource: (row.join_source ?? 'invite') as 'creator' | 'invite',
          status: (row.status ?? 1) as 1 | 0 | -1,
        } satisfies FamilyMember;
      }).sort((a, b) => {
        const roleOrder = { admin: 0, member: 1, guest: 2 } as const;
        return roleOrder[a.role] - roleOrder[b.role] || a.id - b.id;
      });

      setFamilyMembers(members);
    } finally {
      setFamilyMembersLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
    loadFamily();
  }, [user?.id, profileVersion]);

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? '用户';
  const hasAvatar = !!profile?.avatar_url;
  const activeMembers = familyMembers.filter((m) => m.status === 1);
  const previewMembers = activeMembers.slice(0, 2);
  const previewNameText =
    activeMembers.length > 0
      ? `${previewMembers.map((m) => m.displayName).join('、')}${activeMembers.length > 2 ? ` 等${activeMembers.length}人` : ''}`
      : '';

  return (
    <ScreenWrapper className="bg-app-bg">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-gray-900">设置</Text>
          <Avatar uri={profile?.avatar_url} name={hasAvatar ? displayName : undefined} showCamera={!hasAvatar} size="md" />
        </View>

        {/* ── User card ── */}
        <View className="mx-4 mt-3 rounded-2xl bg-white px-4 py-4 flex-row items-center"
          style={{ shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 }}>
          <Avatar uri={profile?.avatar_url} name={hasAvatar ? displayName : undefined} showCamera={!hasAvatar} size="lg" />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-gray-900">{displayName}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">{user?.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowEditProfile(true)}
            className="px-3 py-1.5 rounded-full border border-purple-200"
          >
            <Text className="text-xs text-purple-600 font-medium">编辑</Text>
          </TouchableOpacity>
        </View>

        {/* ── 账户安全 ── */}
        <SectionHeader title="账户安全" />
        <RowCard>
          <ToggleRow
            label="人脸识别 / 指纹解锁"
            value={biometric}
            onChange={setBiometric}
          />
          <SettingRow label="支付密码" onPress={() => {}} />
          <SettingRow
            label="隐私模式"
            sublabel="快速隐藏敏感数据"
            onPress={() => {}}
            last
          />
        </RowCard>

        {/* ── 家庭管理 ── */}
        <SectionHeader title="家庭管理" />
        <RowCard>
          <SettingRow
            label={family ? '家庭设置' : '创建家庭'}
            sublabel={family ? family.family_name : undefined}
            onPress={() => {
              setFamilyModalMode(family ? 'view' : 'create');
              setShowCreateFamily(true);
            }}
          />
          <SettingRow
            label="家庭成员"
            value={
              familyMembersLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : activeMembers.length > 0 ? (
                <View className="flex-row items-center mr-1" style={{ maxWidth: 210 }}>
                  <Text className="text-sm text-gray-500" numberOfLines={1}>
                    {previewNameText}
                  </Text>
                  <View className="flex-row items-center ml-2">
                    {previewMembers.map((member, idx) => (
                      <View
                        key={member.id}
                        style={{
                          marginLeft: idx === 0 ? 0 : -8,
                          zIndex: previewMembers.length - idx,
                        }}
                      >
                        <Avatar
                          uri={member.avatarUrl}
                          name={member.displayName}
                          size="sm"
                          className="border-2 border-white"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : undefined
            }
            onPress={() => setShowFamilyMembers(true)}
          />
          <SettingRow
            label="添加资产账户"
            onPress={() => setShowAddAsset(true)}
          />
          <SettingRow
            label="我的资产账户"
            onPress={() => setShowAssetList(true)}
            last
          />
        </RowCard>

        {/* ── 通知提醒 ── */}
        <SectionHeader title="通知提醒" />
        <RowCard>
          <ToggleRow label="还款日提醒" value={repaymentReminder} onChange={setRepaymentReminder} />
          <ToggleRow label="月度报告推送" value={monthlyReport} onChange={setMonthlyReport} />
          <SettingRow
            label="大额支出预警"
            value={<Text className="text-sm text-gray-400 mr-1">¥10,000</Text>}
            onPress={() => {}}
            last
          />
        </RowCard>

        {/* ── 外观 ── */}
        <SectionHeader title="外观" />
        <RowCard>
          <SettingRow
            label="主题切换"
            value={<Text className="text-sm text-gray-400 mr-1">🌙</Text>}
            onPress={() => {}}
          />
          <SettingRow
            label="配色方案"
            value={
              <View className="flex-row items-center mr-1">
                <View className="w-3 h-3 rounded-full mr-1.5" style={{ backgroundColor: Colors.primary }} />
                <Text className="text-sm text-gray-400">柔雾紫境</Text>
              </View>
            }
            onPress={() => {}}
            last
          />
        </RowCard>

        {/* ── 其他 ── */}
        <SectionHeader title="其他" />
        <RowCard>
          <SettingRow label="数据导出" onPress={() => {}} />
          <SettingRow label="帮助与反馈" onPress={() => {}} />
          <SettingRow label="关于盈家" onPress={() => {}} last />
        </RowCard>

        {/* ── 退出登录 ── */}
        <TouchableOpacity
          onPress={signOut}
          className="mx-4 mt-6 py-3.5 rounded-2xl bg-white items-center"
          style={{ shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }}
        >
          <Text className="text-sm font-semibold text-red-500">退出登录</Text>
        </TouchableOpacity>

      </ScrollView>
      <FamilySettingsModal
        visible={showCreateFamily}
        onClose={() => setShowCreateFamily(false)}
        onSuccess={() => { setShowCreateFamily(false); loadFamily(); }}
        mode={familyModalMode}
        initialData={family ?? undefined}
      />
      <AddAssetAccountModal
        visible={showAddAsset}
        onClose={() => setShowAddAsset(false)}
      />
      <AssetAccountListModal
        visible={showAssetList}
        onClose={() => setShowAssetList(false)}
      />
      <ProfileEditModal
        visible={showEditProfile}
        userId={user?.id}
        email={user?.email}
        initialDisplayName={profile?.display_name}
        initialAvatarUrl={profile?.avatar_url}
        onClose={() => setShowEditProfile(false)}
        onSuccess={(nextProfile: Profile) => {
          setProfile(nextProfile);
          setShowEditProfile(false);
        }}
      />

      <Modal
        visible={showFamilyMembers}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => setShowFamilyMembers(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#E9E8FF' }}>
          <View className="px-5" style={{ paddingTop: Platform.OS === 'ios' ? 58 : 24, paddingBottom: 10 }}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setShowFamilyMembers(false)} className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}>
                <Text className="text-gray-500 text-xl">‹</Text>
              </TouchableOpacity>
              <Text className="text-[28px] font-bold text-gray-900">家庭成员</Text>
              <TouchableOpacity className="px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}>
                <Text className="text-sm font-medium" style={{ color: Colors.primary }}>添加成员</Text>
              </TouchableOpacity>
            </View>
          </View>

          {familyMembers.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-base font-semibold text-gray-700">暂无家庭成员</Text>
              <Text className="text-sm text-gray-500 mt-2">点击右上角添加成员</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 28 : 20 }}
            >
              {familyMembers.map((member) => {
                const roleMeta: Record<FamilyMember['role'], { label: string; icon: string; bg: string; color: string }> = {
                  admin: { label: '超级管理员', icon: 'crown', bg: '#EDE9FE', color: '#7C3AED' },
                  member: { label: '普通成员', icon: 'account', bg: '#DBEAFE', color: '#2563EB' },
                  guest: { label: '受限成员', icon: 'alert-circle', bg: '#FFEDD5', color: '#EA580C' },
                };

                const sourceMeta =
                  member.joinSource === 'creator'
                    ? { icon: 'account-plus', label: '创建' }
                    : { icon: 'account-multiple-plus', label: '邀请' };

                const statusMeta =
                  member.status === 1
                    ? { icon: 'check-circle', label: '正常', color: '#16A34A' }
                    : { icon: 'close-circle', label: '已禁用', color: '#EF4444' };

                return (
                  <View
                    key={member.id}
                    className="rounded-3xl px-4 py-3.5 mb-3.5 flex-row items-center"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <Avatar uri={member.avatarUrl} name={member.displayName} size="md" />

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-xl font-semibold text-gray-800 mr-2">{member.displayName}</Text>
                        <View
                          className="px-2.5 py-1 rounded-full flex-row items-center"
                          style={{ backgroundColor: roleMeta[member.role].bg }}
                        >
                          <MaterialCommunityIcons
                            name={roleMeta[member.role].icon as any}
                            size={11}
                            color={roleMeta[member.role].color}
                          />
                          <Text className="text-[11px] font-semibold ml-1" style={{ color: roleMeta[member.role].color }}>
                            {roleMeta[member.role].label}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center mt-1.5">
                        <View className="flex-row items-center mr-3">
                          <MaterialCommunityIcons name={sourceMeta.icon as any} size={13} color="#9CA3AF" />
                          <Text className="text-xs text-gray-400 ml-1">{sourceMeta.label}</Text>
                        </View>

                        <View className="flex-row items-center mr-3">
                          <MaterialCommunityIcons name="account-arrow-right" size={13} color="#9CA3AF" />
                          <Text className="text-xs text-gray-400 ml-1">邀请</Text>
                        </View>

                        <View className="flex-row items-center">
                          <MaterialCommunityIcons name={statusMeta.icon as any} size={13} color={statusMeta.color} />
                          <Text className="text-xs font-semibold ml-1" style={{ color: statusMeta.color }}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: 'rgba(167,139,250,0.12)' }}
                    >
                      <MaterialCommunityIcons name="dots-horizontal" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
