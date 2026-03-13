import { View, Text, ScrollView, TouchableOpacity, Switch, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { FamilySettingsModal } from '@/components/ui/FamilySettingsModal';

type Profile = { display_name: string | null; avatar_url: string | null };
type Family = { id: number; family_name: string };

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
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [biometric, setBiometric] = useState(false);
  const [repaymentReminder, setRepaymentReminder] = useState(true);
  const [monthlyReport, setMonthlyReport] = useState(true);
  const [showCreateFamily, setShowCreateFamily] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
    supabase
      .from('family_members')
      .select('families(id, family_name)')
      .eq('user_id', user.id)
      .eq('status', 1)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const f = (data as any)?.families;
        if (f) setFamily({ id: f.id, family_name: f.family_name });
      });
  }, [user?.id]);

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? '用户';
  const hasAvatar = !!profile?.avatar_url;

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
          <TouchableOpacity className="px-3 py-1.5 rounded-full border border-purple-200">
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
            label={family ? family.family_name : '创建家庭'}
            sublabel={family ? '我的家庭' : undefined}
            onPress={() => setShowCreateFamily(true)}
          />
          <SettingRow
            label="家庭成员"
            onPress={() => {}}
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
        onSuccess={() => setShowCreateFamily(false)}
      />
    </ScreenWrapper>
  );
}
