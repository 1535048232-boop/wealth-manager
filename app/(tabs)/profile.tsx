import { View, Text, ScrollView, TouchableOpacity, Platform, Modal, ActivityIndicator, Alert, TextInput } from 'react-native';
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
  isCurrentUser: boolean;
};

type FamilyInvitation = {
  id: number;
  inviterId: number | null;
  inviteeContact: string;
  inviteeContactType: 1 | 2;
  status: 0 | 1 | -1;
  lastSendTime: string | null;
  expireTime: string;
  createdAt: string;
  inviterDisplayName: string | null;
  inviterRole: 'admin' | 'member' | 'guest' | null;
};

type AssetAccountType = '银行卡' | '支付宝' | '微信' | '公积金' | '股票' | '期权' | '现金' | '保险' | '基金' | '其他';

const ASSET_ACCOUNT_TYPE_META: Record<AssetAccountType, { emoji: string; bgColor: string }> = {
  银行卡: { emoji: '💳', bgColor: '#EEF2FF' },
  支付宝: { emoji: '💰', bgColor: '#EFF6FF' },
  微信: { emoji: '💬', bgColor: '#F0FDF4' },
  公积金: { emoji: '🏠', bgColor: '#F5F3FF' },
  股票: { emoji: '📈', bgColor: '#FFF7ED' },
  期权: { emoji: '📊', bgColor: '#FFF7ED' },
  现金: { emoji: '💵', bgColor: '#FFFBEB' },
  保险: { emoji: '🛡️', bgColor: '#F0FDFA' },
  基金: { emoji: '📉', bgColor: '#F5F3FF' },
  其他: { emoji: '📁', bgColor: '#F9FAFB' },
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
        <Text className="text-[14px] font-medium text-gray-900">{label}</Text>
        {sublabel ? <Text className="text-[14px] text-gray-400 mt-0.5">{sublabel}</Text> : null}
      </View>
      {value}
      {onPress ? (
        <Text className="text-gray-300 text-base ml-1">›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const profileVersion = useAppStore((state) => state.profileVersion);
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [familyModalMode, setFamilyModalMode] = useState<'create' | 'view'>('create');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAssetList, setShowAssetList] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyMembersLoading, setFamilyMembersLoading] = useState(false);
  const [familyInvitations, setFamilyInvitations] = useState<FamilyInvitation[]>([]);
  const [familyInvitationsLoading, setFamilyInvitationsLoading] = useState(false);
  const [showFamilyMembers, setShowFamilyMembers] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [assetAccountCount, setAssetAccountCount] = useState(0);
  const [assetPreviewAccounts, setAssetPreviewAccounts] = useState<Array<{ id: number; account_type: AssetAccountType }>>([]);
  const [currentFamilyRole, setCurrentFamilyRole] = useState<'admin' | 'member' | 'guest' | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleDeleteAccount() {
    if (!user) return;

    const inputEmail = deleteConfirmEmail.trim().toLowerCase();
    const accountEmail = (user.email ?? '').toLowerCase();
    if (!inputEmail || inputEmail !== accountEmail) {
      Alert.alert('确认失败', '请输入与当前账号一致的邮箱');
      return;
    }

    try {
      setDeletingAccount(true);
      const { data, error } = await supabase.functions.invoke<{ deleted: true }>('delete-account', {
        body: { confirmEmail: deleteConfirmEmail.trim() },
      });

      // Edge Function 返回业务级 error 时，data 为 { data: null, error: {...} } 结构
      const fnError = (data as unknown as { error?: { message?: string } } | null)?.error;
      if (error || fnError) {
        const msg = fnError?.message ?? error?.message ?? '删除失败，请稍后重试';
        Alert.alert('删除失败', msg);
        return;
      }

      // 删除成功 → 清理本地会话
      setShowDeleteAccount(false);
      setDeleteConfirmEmail('');
      await signOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败，请稍后重试';
      Alert.alert('删除失败', msg);
    } finally {
      setDeletingAccount(false);
    }
  }

  function logFamilyMembersDebug(stage: string, payload?: unknown) {
    if (!__DEV__) return;
    console.log(`[ProfileScreen][loadFamily] ${stage}`, payload);
  }

  async function loadFamily() {
    if (!user) return;
    try {
      logFamilyMembersDebug('start', { userId: user.id });

      const { data: memberData, error: memberError } = await supabase
        .from('family_members')
        .select('id, family_id, role')
        .eq('profile_id', user.id)
        .eq('status', 1)
        .maybeSingle();

      logFamilyMembersDebug('step1 member row', { memberData, memberError });

      if (memberError) throw memberError;

      if (!memberData?.family_id) {
        const { data: creatorFamily, error: creatorFamilyError } = await supabase
          .from('families')
          .select('id, family_name, family_avatar, currency, debt_warning_threshold, repayment_reminder_switch, data_export_switch')
          .eq('creator_id', user.id)
          .maybeSingle();

        if (creatorFamilyError) throw creatorFamilyError;

        if (creatorFamily) {
          setFamily({
            id: creatorFamily.id,
            family_name: creatorFamily.family_name,
            family_avatar: creatorFamily.family_avatar,
            currency: creatorFamily.currency,
            debt_warning_threshold: Number(creatorFamily.debt_warning_threshold),
            repayment_reminder_switch: creatorFamily.repayment_reminder_switch,
            data_export_switch: creatorFamily.data_export_switch,
          });
          setCurrentFamilyRole('admin');
          setCurrentMemberId(null);
          setFamilyMembers([]);
          setFamilyInvitations([]);
          return;
        }

        logFamilyMembersDebug('stop no family_id', { memberData });
        setFamily(null);
        setCurrentFamilyRole(null);
        setFamilyMembers([]);
        setFamilyInvitations([]);
        return;
      }

      setCurrentFamilyRole((memberData.role ?? null) as 'admin' | 'member' | 'guest' | null);
      setCurrentMemberId(memberData.id as number);

      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('id, family_name, family_avatar, currency, debt_warning_threshold, repayment_reminder_switch, data_export_switch')
        .eq('id', memberData.family_id)
        .maybeSingle();

      logFamilyMembersDebug('step2 family row', { familyId: memberData.family_id, familyData, familyError });

      if (familyError) throw familyError;

      const f = familyData as {
        id: number;
        family_name: string;
        family_avatar: string | null;
        currency: string;
        debt_warning_threshold: number;
        repayment_reminder_switch: 0 | 1;
        data_export_switch: 0 | 1;
      } | null;

      if (f) setFamily({
        id: f.id,
        family_name: f.family_name,
        family_avatar: f.family_avatar,
        currency: f.currency,
        debt_warning_threshold: Number(f.debt_warning_threshold),
        repayment_reminder_switch: f.repayment_reminder_switch,
        data_export_switch: f.data_export_switch,
      });
      else setFamily(null);

      setFamilyMembersLoading(true);
      try {
        const { data: membersData, error: membersError } = await supabase
          .from('family_members')
          .select('id, role, join_source, status, profile_id, user_id, profiles:profile_id(display_name, avatar_url)')
          .eq('family_id', memberData.family_id)
          .in('status', [1, -1])
          .order('id', { ascending: true });

        logFamilyMembersDebug('step3 raw members', {
          familyId: memberData.family_id,
          count: membersData?.length ?? 0,
          membersError,
          membersData,
        });

        if (membersError) throw membersError;

        const members = (membersData ?? []).map((row: any) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            id: row.id as number,
            displayName: profile?.display_name ?? `成员${row.id}`,
            avatarUrl: profile?.avatar_url ?? null,
            role: (row.role ?? 'member') as 'admin' | 'member' | 'guest',
            joinSource: (row.join_source ?? 'invite') as 'creator' | 'invite',
            status: (row.status ?? 1) as 1 | 0 | -1,
            isCurrentUser: row.profile_id === user.id || row.user_id === user.id,
          } satisfies FamilyMember;
        }).sort((a, b) => {
          const roleOrder = { admin: 0, member: 1, guest: 2 } as const;
          return roleOrder[a.role] - roleOrder[b.role] || a.id - b.id;
        });

        logFamilyMembersDebug('step3 mapped members', members);
        setFamilyMembers(members);
      } finally {
        setFamilyMembersLoading(false);
      }

      setFamilyInvitationsLoading(true);
      try {
        const { data: invitationsData, error: invitationsError } = await supabase
        .from('family_invitations')
        .select('id, inviter_id, invitee_contact, invitee_contact_type, status, last_send_time, expire_time, created_at, inviter:inviter_id(role, profiles:profile_id(display_name))')
        .eq('family_id', memberData.family_id)
        .order('created_at', { ascending: false })
        .limit(20);

        logFamilyMembersDebug('step4 invitations', {
          familyId: memberData.family_id,
          count: invitationsData?.length ?? 0,
          invitationsError,
        });

        if (invitationsError) throw invitationsError;

        const invitations = (invitationsData ?? []).map((row: any) => {
          const inviter = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter;
          const inviterProfile = inviter ? (Array.isArray(inviter.profiles) ? inviter.profiles[0] : inviter.profiles) : null;
          return {
            id: row.id as number,
            inviterId: (row.inviter_id ?? null) as number | null,
            inviteeContact: row.invitee_contact as string,
            inviteeContactType: (row.invitee_contact_type ?? 1) as 1 | 2,
            status: (row.status ?? 0) as 0 | 1 | -1,
            lastSendTime: (row.last_send_time ?? null) as string | null,
            expireTime: row.expire_time as string,
            createdAt: row.created_at as string,
            inviterDisplayName: (inviterProfile?.display_name ?? null) as string | null,
            inviterRole: (inviter?.role ?? null) as 'admin' | 'member' | 'guest' | null,
          } satisfies FamilyInvitation;
        });

        setFamilyInvitations(invitations);
      } finally {
        setFamilyInvitationsLoading(false);
      }
    } catch (error) {
      logFamilyMembersDebug('error', error);
      console.error('[ProfileScreen] loadFamily failed:', error);
    }
  }

  async function revokeInvitation(invitationId: number) {
    try {
      const { error } = await supabase
        .from('family_invitations')
        .update({ status: -1 })
        .eq('id', invitationId);

      if (error) throw error;

      await loadFamily();
      Alert.alert('撤销成功', '该邀请已撤销');
    } catch (error) {
      console.error('[ProfileScreen] revokeInvitation failed:', error);
      Alert.alert('操作失败', '撤销邀请失败，请稍后重试');
    }
  }

  async function loadAssetAccountsPreview() {
    if (!user) return;

    const { data, error } = await supabase
      .from('asset_accounts')
      .select(`
        id,
        account_type,
        status,
        created_at,
        family_members!inner(user_id)
      `)
      .eq('family_members.user_id', user.id)
      .eq('status', 1)
      .order('created_at', { ascending: true });

    if (error || !data) {
      return;
    }

    const activeAccounts = (data as Array<{ id: number; account_type: AssetAccountType; status: 0 | 1 }>).filter((item) => item.status === 1);
    setAssetAccountCount(activeAccounts.length);
    // Keep preview consistent with "我的资产账户"列表：取同排序下的前三条记录。
    setAssetPreviewAccounts(activeAccounts.slice(0, 3).map((item) => ({ id: item.id, account_type: item.account_type ?? '其他' })));
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
    loadAssetAccountsPreview();
  }, [user?.id, profileVersion]);

  useEffect(() => {
    if (!showFamilyMembers) return;
    setNowTs(Date.now());
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showFamilyMembers]);

  useEffect(() => {
    if (!showFamilyMembers) return;
    loadFamily();
  }, [showFamilyMembers]);

  function maskInviteeContact(contact: string, contactType: 1 | 2) {
    if (contactType === 1) {
      const phone = contact.replace(/\s+/g, '');
      if (phone.length < 7) return contact;
      return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
    }

    const [localPart, domain] = contact.split('@');
    if (!localPart || !domain) return contact;
    const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
    return `${visiblePrefix}***@${domain}`;
  }

  function formatInviteDate(dateText: string) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return '--';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  function formatRemainingTime(expireTime: string) {
    const expire = new Date(expireTime).getTime();
    if (Number.isNaN(expire)) return '--:--:--';

    const diffMs = expire - nowTs;
    if (diffMs <= 0) return '00:00:00';

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function getInvitationStatusMeta(item: FamilyInvitation) {
    const isExpired = item.status === 0 && new Date(item.expireTime).getTime() <= nowTs;

    if (item.status === 1) {
      return { label: '已接受', color: '#16A34A', bg: '#DCFCE7', actionable: false };
    }

    if (item.status === -1 || isExpired) {
      return { label: '已过期', color: '#EF4444', bg: '#FEE2E2', actionable: false };
    }

    return { label: '待确认', color: '#F59E0B', bg: '#FEF3C7', actionable: true };
  }

  function getRoleLabel(role: FamilyInvitation['inviterRole']) {
    if (role === 'admin') return '超级管理员';
    if (role === 'member') return '普通成员';
    if (role === 'guest') return '受限成员';
    return null;
  }

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? '用户';
  const hasAvatar = !!profile?.avatar_url;
  const activeMembers = familyMembers.filter((m) => m.status === 1);
  const previewMembers = activeMembers.slice(0, 2);
  const canInviteFamilyMembers = currentFamilyRole === 'admin';
  const previewNameText =
    activeMembers.length > 0
      ? `${previewMembers.map((m) => m.displayName).join('、')}${activeMembers.length > 2 ? ` 等${activeMembers.length}人` : ''}`
      : '';

  return (
    <ScreenWrapper className="bg-app-bg">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Text className="text-[22px] font-bold text-gray-900">设置</Text>
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

        {/* ── 家庭管理 ── */}
        <Text
          className="font-semibold text-gray-400 uppercase tracking-widest px-5 pt-6 pb-2"
          style={{ fontSize: 14 }}
        >
          家庭管理
        </Text>
        <RowCard>
          <SettingRow
            label={family ? '家庭设置' : '创建家庭'}
            sublabel={family ? family.family_name : undefined}
            value={
              family ? (
                <Avatar
                  uri={family.family_avatar}
                  name={family.family_name}
                  size="sm"
                  className="mr-1"
                />
              ) : undefined
            }
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
            value={
              assetAccountCount > 0 ? (
                <View className="flex-row items-center mr-1">
                  <Text className="text-sm text-gray-400">{assetAccountCount}项</Text>
                  <View className="flex-row items-center ml-2">
                    {assetPreviewAccounts.map((account, idx) => {
                      const meta = ASSET_ACCOUNT_TYPE_META[account.account_type] ?? ASSET_ACCOUNT_TYPE_META['其他'];
                      return (
                        <View
                          key={account.id}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            marginLeft: idx === 0 ? 0 : -8,
                            backgroundColor: meta.bgColor,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: '#FFFFFF',
                            zIndex: assetPreviewAccounts.length - idx,
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <Text className="text-sm text-gray-400 mr-1">0项</Text>
              )
            }
            onPress={() => setShowAssetList(true)}
            last
          />
        </RowCard>

        {/* ── 退出登录 ── */}
        <TouchableOpacity
          onPress={signOut}
          className="mx-4 mt-6 py-3.5 rounded-2xl bg-white items-center"
          style={{ shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }}
        >
          <Text className="text-sm font-semibold text-red-500">退出登录</Text>
        </TouchableOpacity>

        {/* ── 删除账号（App Store Guideline 5.1.1(v) 合规要求）── */}
        <TouchableOpacity
          accessibilityLabel="删除账号"
          onPress={() => {
            setDeleteConfirmEmail('');
            setShowDeleteAccount(true);
          }}
          className="mx-4 mt-3 py-3 items-center"
        >
          <Text className="text-xs font-medium text-gray-400 underline">删除账号</Text>
        </TouchableOpacity>

      </ScrollView>
      <FamilySettingsModal
        visible={showCreateFamily}
        onClose={() => setShowCreateFamily(false)}
        onSuccess={(nextFamily) => {
          setShowCreateFamily(false);
          if (nextFamily) setFamily(nextFamily);
          loadFamily();
        }}
        mode={familyModalMode}
        initialData={family ?? undefined}
      />
      <AddAssetAccountModal
        visible={showAddAsset}
        onClose={() => {
          setShowAddAsset(false);
          loadAssetAccountsPreview();
        }}
      />
      <AssetAccountListModal
        visible={showAssetList}
        onClose={() => {
          setShowAssetList(false);
          loadAssetAccountsPreview();
        }}
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

      {/* ── 删除账号确认弹窗 ── */}
      <Modal
        visible={showDeleteAccount}
        animationType="fade"
        transparent
        onRequestClose={() => !deletingAccount && setShowDeleteAccount(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="bg-white rounded-3xl px-6 py-6">
            <View className="items-center mb-3">
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <MaterialCommunityIcons name="alert-octagon" size={24} color="#DC2626" />
              </View>
            </View>
            <Text className="text-lg font-bold text-gray-900 text-center">删除账号</Text>
            <Text className="text-sm text-gray-600 text-center mt-2 leading-5">
              此操作不可恢复。删除后将永久清除你的个人资料、家庭、资产账户、邀请记录等所有数据。
            </Text>
            <Text className="text-xs text-gray-400 text-center mt-2">
              如需继续，请输入账号邮箱以确认：
            </Text>
            <Text className="text-sm font-semibold text-gray-800 text-center mt-1">
              {user?.email ?? ''}
            </Text>

            <TextInput
              value={deleteConfirmEmail}
              onChangeText={setDeleteConfirmEmail}
              placeholder="请输入邮箱确认"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!deletingAccount}
              accessibilityLabel="确认账号邮箱"
              className="mt-4 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900"
              placeholderTextColor="#9CA3AF"
            />

            <View className="flex-row mt-5" style={{ gap: 10 }}>
              <TouchableOpacity
                disabled={deletingAccount}
                onPress={() => {
                  setShowDeleteAccount(false);
                  setDeleteConfirmEmail('');
                }}
                className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
              >
                <Text className="text-sm font-semibold text-gray-700">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={deletingAccount}
                onPress={handleDeleteAccount}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: deletingAccount ? '#FCA5A5' : '#DC2626' }}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-semibold text-white">永久删除</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFamilyMembers}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => setShowFamilyMembers(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#E9E8FF' }}>
          <View className="px-5" style={{ paddingTop: 48, paddingBottom: 10 }}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setShowFamilyMembers(false)} className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}>
                <Text className="text-gray-500 text-xl">‹</Text>
              </TouchableOpacity>
              <Text className="text-[22px] font-bold text-gray-900">家庭成员</Text>
              {canInviteFamilyMembers ? (
                <TouchableOpacity
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}
                  onPress={() => {
                    setShowFamilyMembers(false);
                    router.push('/(tabs)/family-invite');
                  }}
                >
                  <Text className="text-sm font-medium" style={{ color: Colors.primary }}>添加成员</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 72 }} />
              )}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 28 : 20 }}
          >
            <Text className="text-sm font-semibold text-gray-600 px-1 mb-2">成员列表</Text>

            {familyMembers.length === 0 ? (
              <View
                className="rounded-3xl px-4 py-5 mb-4"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.6)',
                }}
              >
                <Text className="text-base font-semibold text-gray-700">暂无家庭成员</Text>
                <Text className="text-sm text-gray-500 mt-2">{canInviteFamilyMembers ? '点击右上角添加成员' : '当前暂无可见成员'}</Text>
              </View>
            ) : (
              familyMembers.map((member) => {
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
                      backgroundColor: member.isCurrentUser ? 'rgba(255,255,255,0.7)' : 'rgba(229,231,235,0.88)',
                      borderWidth: 1,
                      borderColor: member.isCurrentUser ? 'rgba(255,255,255,0.6)' : 'rgba(209,213,219,0.95)',
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
                        {canInviteFamilyMembers ? (
                          <View className="flex-row items-center mr-3">
                            <MaterialCommunityIcons name={sourceMeta.icon as any} size={13} color="#9CA3AF" />
                            <Text className="text-xs text-gray-400 ml-1">{sourceMeta.label}</Text>
                          </View>
                        ) : null}

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
              })
            )}

            {canInviteFamilyMembers ? (
              <View className="mt-1 mb-2 px-1 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-gray-600">邀请记录</Text>
                {familyInvitationsLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text className="text-xs text-gray-400">共 {familyInvitations.length} 条</Text>
                )}
              </View>
            ) : null}

            {canInviteFamilyMembers ? (
              !familyInvitationsLoading && familyInvitations.length === 0 ? (
              <View
                className="rounded-3xl px-4 py-5"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.6)',
                }}
              >
                <Text className="text-base font-semibold text-gray-700">暂无邀请记录</Text>
                <Text className="text-sm text-gray-500 mt-2">添加成员后可查看最近邀请状态</Text>
              </View>
            ) : (
              familyInvitations.map((invitation) => {
                const statusMeta = getInvitationStatusMeta(invitation);
                const sendTimeText = formatInviteDate(invitation.lastSendTime ?? invitation.createdAt);

                return (
                  <View
                    key={invitation.id}
                    className="rounded-3xl px-4 py-3.5 mb-3.5"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-[15px] font-semibold text-gray-800">
                          邀请人: {invitation.inviterDisplayName ?? '未知成员'}
                          {getRoleLabel(invitation.inviterRole) ? `（${getRoleLabel(invitation.inviterRole)}）` : ''}
                        </Text>

                        <Text className="text-sm text-gray-600 mt-2">
                          发送时间: {sendTimeText}
                        </Text>
                        {statusMeta.actionable ? (
                          <Text className="text-sm text-gray-600 mt-1">
                            剩余: {formatRemainingTime(invitation.expireTime)}
                          </Text>
                        ) : null}
                        <Text className="text-xs text-gray-400 mt-1.5">
                          被邀请人联系方式: {maskInviteeContact(invitation.inviteeContact, invitation.inviteeContactType)}
                        </Text>
                      </View>

                      {invitation.inviterId === currentMemberId && statusMeta.actionable ? (
                        <View>
                          <View className="self-end px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: statusMeta.bg }}>
                            <Text className="text-[11px] font-semibold" style={{ color: statusMeta.color }}>
                              {statusMeta.label}
                            </Text>
                          </View>
                          <TouchableOpacity
                            className="px-3.5 py-2 rounded-full mb-2"
                            style={{ backgroundColor: '#FFFFFF' }}
                            onPress={() => {
                              setShowFamilyMembers(false);
                              router.push('/(tabs)/family-invite');
                            }}
                          >
                            <Text className="text-sm font-semibold text-gray-700">重新发送</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            className="px-3.5 py-2 rounded-full"
                            style={{ backgroundColor: '#FFFFFF' }}
                            onPress={() => {
                              Alert.alert('撤销邀请', '确认撤销该邀请吗？', [
                                { text: '取消', style: 'cancel' },
                                { text: '确认', style: 'destructive', onPress: () => revokeInvitation(invitation.id) },
                              ]);
                            }}
                          >
                            <Text className="text-sm font-semibold text-gray-700">撤销邀请</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: statusMeta.bg }}>
                          <Text className="text-[11px] font-semibold" style={{ color: statusMeta.color }}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
