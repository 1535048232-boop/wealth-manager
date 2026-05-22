import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface InviteRow {
  id: number;
  invitee_contact: string;
  invitee_contact_type: 1 | 2;
  invitee_user_id: string | null;
  status: 0 | 1 | -1;
  created_at: string;
}

interface SearchAccountResult {
  account_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  matched_contact: string;
  matched_contact_type: 1 | 2;
  already_in_family: boolean;
  pending_invitation: boolean;
  active_family_name: string | null;
  is_self: boolean;
}

interface InviterContext {
  memberId: number;
  familyId: number;
  role: 'admin' | 'member' | 'guest';
}

function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function validateSearchQuery(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '请输入邮箱或手机号';

  if (trimmed.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return '请输入正确的邮箱地址';
    return null;
  }

  if (!/^1\d{10}$/.test(trimmed)) return '请输入正确的11位手机号';
  return null;
}

function formatStatus(status: 0 | 1 | -1): { label: string; color: string; bg: string } {
  if (status === 1) return { label: '已加入', color: '#16A34A', bg: '#ECFDF5' };
  if (status === -1) return { label: '已拒绝', color: '#DC2626', bg: '#FEF2F2' };
  return { label: '待确认', color: '#7C3AED', bg: '#F5F3FF' };
}

function formatDateTime(dateLike: string): string {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function isMissingSearchRpcError(message: string): boolean {
  return message.includes('search_invitable_account') && message.includes('no matches were found in the schema cache');
}

export default function FamilyInviteScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [context, setContext] = useState<InviterContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchAccountResult | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const [recentInvites, setRecentInvites] = useState<InviteRow[]>([]);

  const isAdmin = context?.role === 'admin';

  async function loadInviterContext() {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('id, family_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 1)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setContext(null);
        return;
      }

      setContext({
        memberId: data.id,
        familyId: data.family_id,
        role: data.role,
      });
    } catch (error) {
      console.error('[FamilyInviteScreen] loadInviterContext failed:', error);
      Alert.alert('加载失败', '无法读取家庭信息，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentInvites(familyId: number) {
    try {
      const { data, error } = await supabase
        .from('family_invitations')
        .select('id, invitee_contact, invitee_contact_type, invitee_user_id, status, created_at')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setRecentInvites((data ?? []) as unknown as InviteRow[]);
    } catch (error) {
      console.error('[FamilyInviteScreen] loadRecentInvites failed:', error);
    }
  }

  useEffect(() => {
    loadInviterContext();
  }, [user?.id]);

  useEffect(() => {
    if (!context?.familyId) return;
    loadRecentInvites(context.familyId);
  }, [context?.familyId]);

  async function handleSearchAccount() {
    if (!context) {
      Alert.alert('暂无家庭', '请先创建或加入家庭');
      return;
    }

    if (!isAdmin) {
      Alert.alert('权限不足', '仅管理员可以邀请成员');
      return;
    }

    const validationError = validateSearchQuery(query);
    if (validationError) {
      Alert.alert('输入有误', validationError);
      return;
    }

    setSearching(true);
    setSearchAttempted(true);
    setSearchResult(null);

    try {
      const { data, error } = await supabase.rpc('search_invitable_account' as never, {
        p_query: query.trim(),
      } as never);

      if (error) {
        if (isMissingSearchRpcError(error.message)) {
          Alert.alert('需要同步后端', '搜索账号能力对应的数据库迁移还未执行，先同步 Supabase migration 后即可使用。');
          return;
        }

        throw error;
      }

      const first = Array.isArray(data) ? (data[0] as unknown as SearchAccountResult | undefined) : undefined;
      setSearchResult(first ?? null);
    } catch (error) {
      console.error('[FamilyInviteScreen] handleSearchAccount failed:', error);
      Alert.alert('搜索失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSearching(false);
    }
  }

  async function handleInviteAccount() {
    if (!context || !searchResult) return;

    if (searchResult.is_self) {
      Alert.alert('无法邀请', '不能邀请自己加入当前家庭');
      return;
    }

    if (searchResult.already_in_family) {
      Alert.alert('无需邀请', '该账号已经在当前家庭中');
      return;
    }

    if (searchResult.pending_invitation) {
      Alert.alert('已发送邀请', '该账号已有待处理邀请，请等待对方确认');
      return;
    }

    if (searchResult.active_family_name) {
      Alert.alert('暂不可邀请', `该账号当前已在“${searchResult.active_family_name}”家庭中`);
      return;
    }

    setSaving(true);
    try {
      let created = false;

      for (let i = 0; i < 5; i += 1) {
        const nextCode = generateInviteCode(8);
        const { error } = await supabase.from('family_invitations').insert({
          family_id: context.familyId,
          inviter_id: context.memberId,
          invitee_user_id: searchResult.account_user_id,
          invitee_contact: searchResult.matched_contact,
          invitee_contact_type: searchResult.matched_contact_type,
          invite_code: nextCode,
          last_send_time: null,
          status: 0,
        });

        if (!error) {
          created = true;
          break;
        }

        if (error.code !== '23505') throw error;
      }

      if (!created) {
        Alert.alert('操作失败', '邀请创建冲突，请重试');
        return;
      }

      setQuery('');
      setSearchAttempted(false);
      setSearchResult(null);
      await loadRecentInvites(context.familyId);

      Alert.alert(
        '邀请已发送',
        `已向 ${searchResult.display_name?.trim() || searchResult.matched_contact} 发出邀请，对方会在应用内收到“加入家庭”的确认弹窗。`,
      );
    } catch (error) {
      console.error('[FamilyInviteScreen] handleInviteAccount failed:', error);
      Alert.alert('操作失败', '邀请发送失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  const canInviteSelected =
    !!searchResult &&
    !searchResult.is_self &&
    !searchResult.already_in_family &&
    !searchResult.pending_invitation &&
    !searchResult.active_family_name;

  const matchedContactLabel =
    searchResult?.matched_contact_type === 1 ? `手机号 ${searchResult.matched_contact}` : `邮箱 ${searchResult?.matched_contact ?? ''}`;

  let searchHint = '';
  if (searchResult?.is_self) searchHint = '这是你自己的账号';
  if (searchResult?.already_in_family) searchHint = '该账号已经在当前家庭中';
  if (searchResult?.pending_invitation) searchHint = '该账号已有待处理邀请';
  if (searchResult?.active_family_name) searchHint = `该账号当前在“${searchResult.active_family_name}”家庭中`;

  return (
    <ScreenWrapper className="bg-app-bg">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 34 }}>
        <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold" style={{ color: Colors.text.primary }}>邀请家庭成员</Text>
          <View className="w-10 h-10" />
        </View>

        <View
          className="mx-4 mt-3 rounded-3xl p-4"
          style={{
            backgroundColor: 'rgba(255,255,255,0.74)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.8)',
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 1,
            shadowRadius: 16,
            elevation: 2,
          }}
        >
          <View className="rounded-2xl border px-4" style={{ borderColor: '#E7E4FF', backgroundColor: 'rgba(255,255,255,0.7)' }}>
            <TextInput
              value={query}
              onChangeText={(nextValue) => {
                setQuery(nextValue);
                setSearchResult(null);
                setSearchAttempted(false);
              }}
              placeholder="输入邮箱或手机号"
              placeholderTextColor="#A3A3B7"
              className="py-3.5 text-base"
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={handleSearchAccount}
            />
          </View>

          {searchResult ? (
            <View className="mt-4 rounded-2xl border p-3" style={{ borderColor: '#E7E4FF', backgroundColor: '#FFFFFF' }}>
              <Text className="text-xs font-semibold mb-3" style={{ color: Colors.text.tertiary }}>搜索结果</Text>
              <View className="flex-row items-center">
                <Avatar uri={searchResult.avatar_url} name={searchResult.display_name ?? searchResult.matched_contact} size="md" />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold" style={{ color: Colors.text.primary }}>
                    {searchResult.display_name?.trim() || '未设置昵称'}
                  </Text>
                  <Text className="text-sm mt-1" style={{ color: Colors.text.secondary }}>
                    {matchedContactLabel}
                  </Text>
                  {searchHint ? (
                    <Text className="text-xs mt-1" style={{ color: '#B45309' }}>
                      {searchHint}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: Colors.primary, opacity: canInviteSelected && !saving ? 1 : 0.45 }}
                  onPress={handleInviteAccount}
                  disabled={!canInviteSelected || saving}
                >
                  <Text className="text-sm font-semibold text-white">{saving ? '添加中' : '添加'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {!searchResult && searchAttempted && !searching ? (
            <View className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: '#F1EEFF', backgroundColor: '#FFFFFF' }}>
              <Text className="text-sm" style={{ color: Colors.text.secondary }}>没有找到对应账号，请确认邮箱或手机号是否正确。</Text>
            </View>
          ) : null}
        </View>

        <View className="mx-4 mt-5">
          <TouchableOpacity
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.primary, opacity: !isAdmin || searching || loading ? 0.6 : 1 }}
            onPress={handleSearchAccount}
            disabled={!isAdmin || searching || loading}
          >
            <Text className="text-lg font-semibold text-white">{searching ? '搜索中...' : '搜索账号'}</Text>
          </TouchableOpacity>

          {!isAdmin ? (
            <Text className="text-xs mt-2 text-center" style={{ color: '#DC2626' }}>
              仅家庭管理员可邀请成员
            </Text>
          ) : (
            <Text className="text-xs mt-2 text-center" style={{ color: Colors.text.tertiary }}>
              搜索到账号后，可直接发起家庭邀请
            </Text>
          )}
        </View>

        <View className="mx-4 mt-6 rounded-3xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.66)', borderColor: 'rgba(255,255,255,0.8)', borderWidth: 1 }}>
          <Text className="text-base font-semibold" style={{ color: Colors.text.primary }}>最近邀请</Text>

          {recentInvites.length === 0 ? (
            <Text className="text-sm mt-3" style={{ color: Colors.text.tertiary }}>暂无邀请记录</Text>
          ) : (
            <View className="mt-3">
              {recentInvites.map((item) => {
                const statusMeta = formatStatus(item.status);
                return (
                  <View key={item.id} className="rounded-2xl px-3 py-3 mb-2" style={{ backgroundColor: '#FFFFFF' }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold flex-1 pr-3" style={{ color: Colors.text.primary }}>
                        {item.invitee_contact}
                      </Text>
                      <View className="px-2 py-1 rounded-full" style={{ backgroundColor: statusMeta.bg }}>
                        <Text className="text-xs font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
                      </View>
                    </View>
                    <Text className="text-xs mt-2" style={{ color: Colors.text.secondary }}>
                      {item.invitee_contact_type === 1 ? '手机号账号' : '邮箱账号'}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: Colors.text.tertiary }}>
                      邀请时间 {formatDateTime(item.created_at)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
