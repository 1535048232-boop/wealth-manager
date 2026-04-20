import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { APP_CONFIG } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface InviteRow {
  id: number;
  invitee_contact: string;
  invitee_contact_type: 1 | 2;
  invite_code: string;
  status: 0 | 1 | -1;
  last_send_time: string | null;
  expire_time: string;
  created_at: string;
}

type MemberRole = 'member' | 'guest';
type ContactMode = 'phone' | 'email';

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

function validateContact(mode: ContactMode, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '请输入联系方式';

  if (mode === 'phone') {
    if (!/^1\d{10}$/.test(trimmed)) return '请输入正确的11位手机号';
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return '请输入正确的邮箱地址';
  return null;
}

function formatStatus(status: 0 | 1 | -1): { label: string; color: string; bg: string } {
  if (status === 1) return { label: '已接受', color: '#16A34A', bg: '#ECFDF5' };
  if (status === -1) return { label: '已失效', color: '#DC2626', bg: '#FEF2F2' };
  return { label: '待确认', color: '#7C3AED', bg: '#F5F3FF' };
}

function buildInviteLink(inviteCode: string): string {
  const webBaseUrl = APP_CONFIG.webBaseUrl?.trim();
  if (webBaseUrl) {
    const normalized = webBaseUrl.endsWith('/') ? webBaseUrl.slice(0, -1) : webBaseUrl;
    return `${normalized}/invite?code=${encodeURIComponent(inviteCode)}`;
  }

  return Linking.createURL('/invite', {
    queryParams: {
      code: inviteCode,
    },
    scheme: 'myapp',
  });
}

function formatDateTime(dateLike: string | null): string {
  if (!dateLike) return '未发送提醒';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '未发送提醒';
  return date.toLocaleString('zh-CN', { hour12: false });
}

interface SendInvitationResult {
  sent: boolean;
  channel: 'email' | 'none';
  message: string;
  fallback: 'none' | 'manual_share';
}

interface FunctionEnvelope<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export default function FamilyInviteScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [context, setContext] = useState<InviterContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contactMode, setContactMode] = useState<ContactMode>('phone');
  const [contact, setContact] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member');
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const [recentInvites, setRecentInvites] = useState<InviteRow[]>([]);
  const [sendingInvitationId, setSendingInvitationId] = useState<number | null>(null);
  const isSharingRef = useRef(false);

  const isAdmin = context?.role === 'admin';

  const contactLabel = useMemo(() => {
    return contactMode === 'phone' ? '手机号' : '邮箱';
  }, [contactMode]);

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
        .select('id, invitee_contact, invitee_contact_type, invite_code, status, last_send_time, expire_time, created_at')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setRecentInvites((data ?? []) as InviteRow[]);
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

  async function triggerReminder(invitationId: number): Promise<{ ok: boolean; delivered: boolean; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke<FunctionEnvelope<SendInvitationResult>>('send-family-invitation', {
        body: {
          invitationId,
        },
      });

      if (error) {
        return { ok: false, delivered: false, message: error.message || '提醒发送失败，请稍后重试' };
      }

      if (data?.error) {
        return { ok: false, delivered: false, message: data.error.message || '提醒发送失败，请稍后重试' };
      }

      if (!data?.data) {
        return { ok: false, delivered: false, message: '提醒发送失败，请稍后重试' };
      }

      return {
        ok: true,
        delivered: data.data.sent,
        message: data.data.message || (data.data.channel === 'email' ? '邮箱提醒已发送' : '提醒已处理'),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '提醒发送失败，请稍后重试';
      return { ok: false, delivered: false, message };
    }
  }

  async function resendInvitation(item: InviteRow) {
    if (!context || item.status !== 0 || sendingInvitationId) return;

    if (item.invitee_contact_type !== 2) {
      Alert.alert('暂不支持手机号自动提醒', '请使用“分享”按钮把邀请链接发送给对方');
      return;
    }

    setSendingInvitationId(item.id);
    try {
      const result = await triggerReminder(item.id);
      await loadRecentInvites(context.familyId);

      if (!result.ok) {
        Alert.alert('提醒发送失败', result.message);
        return;
      }

      Alert.alert(result.delivered ? '提醒已发送' : '提醒未自动发送', result.message);
    } finally {
      setSendingInvitationId(null);
    }
  }

  async function createInvitation(sendNow: boolean) {
    if (!context) {
      Alert.alert('暂无家庭', '请先创建或加入家庭');
      return;
    }

    if (!isAdmin) {
      Alert.alert('权限不足', '仅管理员可以发送邀请');
      return;
    }

    const validationError = validateContact(contactMode, contact);
    if (validationError) {
      Alert.alert('输入有误', validationError);
      return;
    }

    setSaving(true);
    try {
      const normalizedContact = contact.trim();
      let createdCode = '';
      let createdInvitationId: number | null = null;

      for (let i = 0; i < 5; i += 1) {
        const nextCode = generateInviteCode(8);
        const { data, error } = await supabase
          .from('family_invitations')
          .insert({
            family_id: context.familyId,
            inviter_id: context.memberId,
            invitee_contact: normalizedContact,
            invitee_contact_type: contactMode === 'phone' ? 1 : 2,
            invite_code: nextCode,
            last_send_time: null,
            status: 0,
          })
          .select('id, invite_code')
          .single();

        if (!error && data) {
          createdCode = data.invite_code;
          createdInvitationId = data.id;
          break;
        }

        if (error.code !== '23505') throw error;
      }

      if (!createdCode) {
        Alert.alert('操作失败', '邀请码生成冲突，请重试');
        return;
      }

      let reminderMessage = '你可稍后手动分享邀请链接';
      if (sendNow && createdInvitationId) {
        if (contactMode === 'email') {
          const result = await triggerReminder(createdInvitationId);
          reminderMessage = result.ok ? result.message : `提醒发送失败：${result.message}`;
        } else {
          reminderMessage = '手机号暂不支持自动提醒，请点击“分享”发送邀请链接';
        }
      }

      setContact('');
      setShowRoleMenu(false);
      await loadRecentInvites(context.familyId);

      Alert.alert(
        sendNow ? '邀请已创建' : '邀请码已生成',
        `邀请码：${createdCode}\n被邀方式：${contactLabel}\n角色：${inviteRole === 'member' ? '普通成员' : '受限成员'}\n提醒状态：${reminderMessage}`,
      );
    } catch (error) {
      console.error('[FamilyInviteScreen] createInvitation failed:', error);
      Alert.alert('操作失败', '邀请创建失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  async function shareInviteLink(item: InviteRow) {
    if (item.status !== 0) {
      Alert.alert('该邀请不可分享', '仅待确认状态的邀请支持分享链接');
      return;
    }

    if (isSharingRef.current) return;
    isSharingRef.current = true;

    const inviteLink = buildInviteLink(item.invite_code);

    try {
      await Share.share({
        title: '家庭邀请链接',
        message: `邀请你加入我的家庭账本\n邀请码：${item.invite_code}\n邀请链接：${inviteLink}`,
      });
    } catch (error) {
      console.error('[FamilyInviteScreen] shareInviteLink failed:', error);
      Alert.alert('分享失败', '请稍后重试');
    } finally {
      isSharingRef.current = false;
    }
  }

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
          <View className="rounded-full p-1 flex-row" style={{ backgroundColor: '#EEF0FF' }}>
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-full items-center"
              style={{ backgroundColor: contactMode === 'phone' ? Colors.primaryLight : 'transparent' }}
              onPress={() => setContactMode('phone')}
            >
              <Text className="text-base font-semibold" style={{ color: contactMode === 'phone' ? '#fff' : Colors.text.secondary }}>
                手机号
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-full items-center"
              style={{ backgroundColor: contactMode === 'email' ? Colors.primaryLight : 'transparent' }}
              onPress={() => setContactMode('email')}
            >
              <Text className="text-base font-semibold" style={{ color: contactMode === 'email' ? '#fff' : Colors.text.secondary }}>
                邮箱
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-4 rounded-2xl border px-4" style={{ borderColor: '#E7E4FF', backgroundColor: 'rgba(255,255,255,0.7)' }}>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder={contactMode === 'phone' ? '输入手机号' : '输入邮箱'}
              placeholderTextColor="#A3A3B7"
              className="py-3.5 text-base"
              keyboardType={contactMode === 'phone' ? 'numeric' : 'email-address'}
              autoCapitalize="none"
            />
          </View>

          <View className="mt-4">
            {/* <TouchableOpacity
              className="rounded-2xl border px-4 py-3.5 flex-row items-center justify-between"
              style={{ borderColor: '#E7E4FF', backgroundColor: 'rgba(255,255,255,0.7)' }}
              onPress={() => setShowRoleMenu((prev) => !prev)}
            >
              <Text className="text-base" style={{ color: Colors.text.primary }}>
                被邀请人角色  {inviteRole === 'member' ? '普通成员' : '受限成员'}
              </Text>
              <MaterialCommunityIcons name={showRoleMenu ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.secondary} />
            </TouchableOpacity> */}

            {showRoleMenu ? (
              <View className="mt-2 rounded-2xl border overflow-hidden" style={{ borderColor: '#E7E4FF', backgroundColor: '#FFFFFF' }}>
                <TouchableOpacity
                  className="px-4 py-3"
                  style={{ backgroundColor: inviteRole === 'member' ? '#F5F3FF' : '#FFFFFF' }}
                  onPress={() => {
                    setInviteRole('member');
                    setShowRoleMenu(false);
                  }}
                >
                  <Text className="text-base" style={{ color: Colors.text.primary }}>普通成员</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-4 py-3 border-t"
                  style={{ borderColor: '#F1EEFF', backgroundColor: inviteRole === 'guest' ? '#F5F3FF' : '#FFFFFF' }}
                  onPress={() => {
                    setInviteRole('guest');
                    setShowRoleMenu(false);
                  }}
                >
                  <Text className="text-base" style={{ color: Colors.text.primary }}>受限成员</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* <Text className="text-xs mt-2" style={{ color: Colors.text.tertiary }}>
              当前底表未存储角色字段，角色用于本次邀请提示展示。
            </Text> */}
          </View>
        </View>

        <View className="mx-4 mt-5">
          <TouchableOpacity
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.primary, opacity: !isAdmin || saving ? 0.6 : 1 }}
            onPress={() => createInvitation(true)}
            disabled={!isAdmin || saving || loading}
          >
            <Text className="text-lg font-semibold text-white">创建并尝试发送提醒</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="rounded-full py-3.5 items-center mt-3 border"
            style={{ borderColor: '#D9D6FF', backgroundColor: 'rgba(255,255,255,0.8)', opacity: !isAdmin || saving ? 0.6 : 1 }}
            onPress={() => createInvitation(false)}
            disabled={!isAdmin || saving || loading}
          >
            <Text className="text-lg font-semibold" style={{ color: Colors.text.primary }}>生成邀请码</Text>
          </TouchableOpacity>

          {!isAdmin ? (
            <Text className="text-xs mt-2 text-center" style={{ color: '#DC2626' }}>
              仅家庭管理员可创建邀请
            </Text>
          ) : (
            <Text className="text-xs mt-2 text-center" style={{ color: Colors.text.tertiary }}>
              若自动提醒不可用，将自动降级为手动分享邀请链接
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
                const contactTypeLabel = item.invitee_contact_type === 1 ? '手机' : '邮箱';
                return (
                  <View key={item.id} className="rounded-2xl px-3 py-3 mb-2" style={{ backgroundColor: '#FFFFFF' }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold" style={{ color: Colors.text.primary }}>
                        {item.invitee_contact}
                      </Text>
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          className="px-2.5 py-1 rounded-full mr-2 flex-row items-center"
                          style={{ backgroundColor: '#EEF0FF' }}
                          onPress={() => shareInviteLink(item)}
                        >
                          <MaterialCommunityIcons name="share-variant" size={12} color={Colors.primary} />
                          <Text className="text-xs font-semibold ml-1" style={{ color: Colors.primary }}>分享</Text>
                        </TouchableOpacity>
                        {item.status === 0 && item.invitee_contact_type === 2 ? (
                          <TouchableOpacity
                            className="px-2.5 py-1 rounded-full mr-2 flex-row items-center"
                            style={{ backgroundColor: '#ECFDF5', opacity: sendingInvitationId === item.id ? 0.65 : 1 }}
                            onPress={() => resendInvitation(item)}
                            disabled={sendingInvitationId !== null}
                          >
                            <MaterialCommunityIcons name="bell-ring-outline" size={12} color="#16A34A" />
                            <Text className="text-xs font-semibold ml-1" style={{ color: '#16A34A' }}>
                              {sendingInvitationId === item.id ? '发送中' : '提醒'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <View className="px-2 py-1 rounded-full" style={{ backgroundColor: statusMeta.bg }}>
                          <Text className="text-xs font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
                        </View>
                      </View>
                    </View>
                    <Text className="text-xs mt-1" style={{ color: Colors.text.secondary }}>
                      {contactTypeLabel} | 邀请码 {item.invite_code}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: Colors.text.secondary }}>
                      最近提醒 {formatDateTime(item.last_send_time)}
                    </Text>
                    <Text className="text-xs mt-1" numberOfLines={1} style={{ color: Colors.text.tertiary }}>
                      链接 {buildInviteLink(item.invite_code)}
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
