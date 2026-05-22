import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Avatar } from '@/components/ui/Avatar';
import { TrendGranularitySwitch } from '@/components/common/TrendGranularitySwitch';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { buildTrendPeriods, getValueAtDate, type TrendGranularity } from '@/lib/trendTime';
import { supabase } from '@/lib/supabase';

type DbAccountType = '银行卡' | '支付宝' | '微信' | '公积金' | '股票' | '期权' | '现金' | '保险' | '基金' | '其他';
type DbAssetQuadrant = 'A类保值' | 'B类消费' | 'C类投资' | 'D类保障';

interface FamilyMemberRow {
  id: number;
  user_id: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AssetAccountRow {
  id: number;
  member_id: number;
  account_name: string;
  account_type: DbAccountType;
  institution: string | null;
  asset_quadrant: DbAssetQuadrant | null;
  description: string | null;
  created_at: string;
}

interface SnapshotRow {
  account_id: number;
  snapshot_date: string;
  amount: number;
}

interface TrendPeriod {
  label: string;
  dateText: string;
}

interface MemberAssetAccount {
  id: number;
  accountName: string;
  accountType: DbAccountType;
  institution: string | null;
  assetQuadrant: DbAssetQuadrant | null;
  description: string | null;
  amount: number;
  snapshotDate: string | null;
  trends: Record<TrendGranularity, number[]>;
}

interface MemberAssetDetail {
  memberId: number;
  displayName: string;
  avatarUrl: string | null;
  totalAmount: number;
  accountCount: number;
  trendLabels: Record<TrendGranularity, string[]>;
  accounts: MemberAssetAccount[];
}

const TYPE_META: Record<DbAccountType, { emoji: string; bgColor: string; color: string }> = {
  银行卡: { emoji: '💳', bgColor: '#EEF2FF', color: '#4F46E5' },
  支付宝: { emoji: '💰', bgColor: '#EFF6FF', color: '#0284C7' },
  微信: { emoji: '💬', bgColor: '#F0FDF4', color: '#16A34A' },
  公积金: { emoji: '🏠', bgColor: '#F5F3FF', color: '#059669' },
  股票: { emoji: '📈', bgColor: '#FFF7ED', color: '#EA580C' },
  期权: { emoji: '📊', bgColor: '#FEF3C7', color: '#D97706' },
  现金: { emoji: '💵', bgColor: '#FFFBEB', color: '#CA8A04' },
  保险: { emoji: '🛡️', bgColor: '#F0FDFA', color: '#9333EA' },
  基金: { emoji: '📉', bgColor: '#FFE4E6', color: '#E11D48' },
  其他: { emoji: '📁', bgColor: '#F3F4F6', color: '#6B7280' },
};

const QUADRANT_META: Record<DbAssetQuadrant, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
  A类保值: { label: 'A类保值', textColor: '#7C3AED', bgColor: '#EDE9FE', borderColor: '#C4B5FD' },
  B类消费: { label: 'B类消费', textColor: '#EA580C', bgColor: '#FFEDD5', borderColor: '#FDBA74' },
  C类投资: { label: 'C类投资', textColor: '#D97706', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
  D类保障: { label: 'D类保障', textColor: '#0D9488', bgColor: '#CCFBF1', borderColor: '#5EEAD4' },
};

function formatAmount(value: number) {
  const abs = Math.abs(value);

  const formatScaled = (scaledValue: number, unit: string) => {
    const digits = scaledValue >= 100 ? 0 : scaledValue >= 10 ? 1 : 2;
    const compact = Number(scaledValue.toFixed(digits)).toString();
    return `${compact}${unit}`;
  };

  let result: string;
  if (abs >= 100000000) {
    result = formatScaled(abs / 100000000, '亿');
  } else if (abs >= 10000) {
    result = formatScaled(abs / 10000, '万');
  } else {
    result = abs.toLocaleString('zh-CN');
  }

  return value < 0 ? `-${result}` : result;
}

function formatSnapshotDate(dateText: string | null) {
  if (!dateText) return '暂无快照';
  return `最近更新 ${dateText}`;
}

function buildTrendPeriodsForDisplay(snapshotDates: string[], granularity: TrendGranularity): TrendPeriod[] {
  const periods = buildTrendPeriods(snapshotDates, granularity);
  return granularity === 'month' ? periods.slice(-6) : periods;
}

function buildSparklinePath(values: number[], width: number, height: number, padding = 4) {
  if (values.length === 0) return '';
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const drawableWidth = Math.max(width - padding * 2, 1);
  const drawableHeight = Math.max(height - padding * 2, 1);
  const stepX = values.length === 1 ? 0 : drawableWidth / (values.length - 1);
  const range = maxValue - minValue || 1;

  return values.map((value, index) => {
    const x = padding + index * stepX;
    const y = padding + drawableHeight - ((value - minValue) / range) * drawableHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function buildValueLabelLayouts(
  values: number[],
  points: Array<{ x: number; y: number }>,
  chartWidth: number,
  topPadding: number,
) {
  const layouts: Array<{ text: string; x: number; y: number }> = [];
  const verticalOffsets = [12, 28, 44, -6];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const text = `¥${formatAmount(values[index] ?? 0)}`;
    const estimatedWidth = Math.max(28, text.length * 7);
    const previous = layouts[layouts.length - 1];

    let offsetIndex = 0;
    if (previous) {
      const tooCloseX = Math.abs(previous.x - point.x) < estimatedWidth;
      const tooCloseY = Math.abs(previous.y - (point.y - verticalOffsets[0])) < 12;
      if (tooCloseX && tooCloseY) {
        offsetIndex = Math.min(layouts.length % verticalOffsets.length, verticalOffsets.length - 1);
      }
    }

    const preferredY = point.y - verticalOffsets[offsetIndex];
    layouts.push({
      text,
      x: Math.min(Math.max(point.x, estimatedWidth / 2 + 4), chartWidth - estimatedWidth / 2 - 4),
      y: Math.max(topPadding - 6, preferredY),
    });
  }

  return layouts;
}

function MiniTrendChart({ values, color }: { values: number[]; color: string }) {
  const width = 60;
  const height = 32;
  const path = buildSparklinePath(values, width, height);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const padding = 4;
  const drawableHeight = Math.max(height - padding * 2, 1);
  const range = maxValue - minValue || 1;
  const lastValue = values[values.length - 1] ?? 0;
  const lastX = values.length <= 1 ? padding : width - padding;
  const lastY = padding + drawableHeight - ((lastValue - minValue) / range) * drawableHeight;

  if (values.length === 0) {
    return (
      <View
        style={{
          width,
          height,
          borderRadius: 10,
          backgroundColor: '#F8FAFC',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 10, color: Colors.text.tertiary }}>暂无趋势</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
      }}
    >
      <Svg width={width} height={height}>
        <Path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={lastX} cy={lastY} r={2.5} fill="#FFFFFF" stroke={color} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

function DetailedTrendChart({
  granularity,
  labels,
  values,
  color,
}: {
  granularity: TrendGranularity;
  labels: string[];
  values: number[];
  color: string;
}) {
  const [chartWidth, setChartWidth] = useState(280);
  const chartHeight = 192;
  const horizontalPadding = 20;
  const topPadding = 34;
  const bottomPadding = 24;
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const valueRange = maxValue - minValue || 1;
  const drawableWidth = Math.max(chartWidth - horizontalPadding * 2, 1);
  const drawableHeight = Math.max(chartHeight - topPadding - bottomPadding, 1);
  const xStep = values.length <= 1 ? 0 : drawableWidth / (values.length - 1);

  const points = values.map((value, index) => ({
    x: horizontalPadding + index * xStep,
    y: topPadding + drawableHeight - ((value - minValue) / valueRange) * drawableHeight,
  }));

  const linePath = buildLinePath(points);
  const latestValue = values[values.length - 1] ?? 0;
  const firstValue = values[0] ?? 0;
  const deltaValue = latestValue - firstValue;
  const deltaColor = deltaValue >= 0 ? '#059669' : '#DC2626';
  const subtitle = granularity === 'month' ? `近${labels.length}个月资产变化` : '按年查看资产变化';
  const valueLabelLayouts = buildValueLabelLayouts(values, points, chartWidth, topPadding);

  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text.primary }}>
            {granularity === 'month' ? '月度增长趋势' : '年度增长趋势'}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.text.secondary, marginTop: 4 }}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text.primary }}>¥{formatAmount(latestValue)}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: deltaColor, marginTop: 4 }}>
            {deltaValue >= 0 ? '+' : '-'}¥{formatAmount(Math.abs(deltaValue))}
          </Text>
        </View>
      </View>

      <View
        onLayout={(event) => {
          const nextWidth = Math.floor(event.nativeEvent.layout.width);
          if (nextWidth > 0 && nextWidth !== chartWidth) {
            setChartWidth(nextWidth);
          }
        }}
        style={{
          marginTop: 14,
          borderRadius: 20,
          backgroundColor: '#F8FAFC',
          paddingHorizontal: 6,
          paddingTop: 10,
          paddingBottom: 12,
        }}
      >
        <Svg width={chartWidth} height={chartHeight}>
          {[0, 0.5, 1].map((ratio) => {
            const y = topPadding + drawableHeight - ratio * drawableHeight;
            return (
              <Path
                key={ratio}
                d={`M ${horizontalPadding.toFixed(1)} ${y.toFixed(1)} L ${(chartWidth - horizontalPadding).toFixed(1)} ${y.toFixed(1)}`}
                stroke="#E5E7EB"
                strokeDasharray="4 4"
              />
            );
          })}
          <Path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.flatMap((point, index) => ([
            <SvgText
              key={`label-${labels[index] ?? index}-${point.x}`}
              x={valueLabelLayouts[index]?.x ?? point.x}
              y={valueLabelLayouts[index]?.y ?? Math.max(point.y - 12, topPadding - 6)}
              fontSize="9"
              fontWeight="700"
              fill={color}
              textAnchor="middle"
            >
              {valueLabelLayouts[index]?.text ?? `¥${formatAmount(values[index] ?? 0)}`}
            </SvgText>,
            <Circle
              key={`${labels[index] ?? index}-${point.x}`}
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 4 : 3}
              fill="#FFFFFF"
              stroke={color}
              strokeWidth={index === points.length - 1 ? 2.5 : 2}
            />,
          ]))}
        </Svg>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 16 }}>
          {labels.map((label) => (
            <Text key={label} style={{ fontSize: 10, color: Colors.text.tertiary }}>
              {label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function AccountTrendModal({
  visible,
  account,
  trendGranularity,
  onTrendGranularityChange,
  labels,
  onClose,
}: {
  visible: boolean;
  account: MemberAssetAccount | null;
  trendGranularity: TrendGranularity;
  onTrendGranularityChange: (value: TrendGranularity) => void;
  labels: string[];
  onClose: () => void;
}) {
  if (!account) return null;

  const typeMeta = TYPE_META[account.accountType] ?? TYPE_META.其他;
  const quadrantMeta = account.assetQuadrant ? QUADRANT_META[account.assetQuadrant] : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'center', paddingHorizontal: 20 }}>
        <TouchableOpacity style={{ position: 'absolute', inset: 0 }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 28,
            maxHeight: '80%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text.primary }} numberOfLines={1}>
                {account.accountName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: typeMeta.bgColor }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: typeMeta.color }}>{account.accountType}</Text>
                </View>
                {quadrantMeta ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: quadrantMeta.bgColor,
                      borderWidth: 1,
                      borderColor: quadrantMeta.borderColor,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: quadrantMeta.textColor }}>
                      {quadrantMeta.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text.secondary, lineHeight: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 14, alignItems: 'flex-start' }}>
            <TrendGranularitySwitch value={trendGranularity} onChange={onTrendGranularityChange} />
          </View>

          <DetailedTrendChart
            granularity={trendGranularity}
            labels={labels}
            values={account.trends[trendGranularity]}
            color={typeMeta.color}
          />

          <View
            style={{
              marginTop: 18,
              borderRadius: 18,
              backgroundColor: '#F8FAFC',
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: Colors.text.secondary }}>最近更新时间</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text.primary, marginTop: 4 }}>
                {account.snapshotDate ?? '暂无快照'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: Colors.text.secondary }}>当前资产</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary, marginTop: 4 }}>
                ¥{formatAmount(account.amount)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function MemberAssetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId?: string }>();
  const memberId = useMemo(() => {
    const raw = typeof params.memberId === 'string' ? Number(params.memberId) : NaN;
    return Number.isFinite(raw) ? raw : 0;
  }, [params.memberId]);

  const [detail, setDetail] = useState<MemberAssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('month');
  const selectedAccount = useMemo(
    () => detail?.accounts.find((account) => account.id === selectedAccountId) ?? null,
    [detail?.accounts, selectedAccountId],
  );

  const loadDetail = useCallback(async () => {
    if (!memberId) {
      setError('成员参数无效');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('family_members')
        .select('id, user_id')
        .eq('id', memberId)
        .eq('status', 1)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!memberData) {
        setDetail(null);
        setError('未找到该成员');
        return;
      }

      const member = memberData as FamilyMemberRow;
      const [profileRes, accountsRes] = await Promise.all([
        member.user_id
          ? supabase.from('profiles').select('id, display_name, avatar_url').eq('id', member.user_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('asset_accounts')
          .select('id, member_id, account_name, account_type, institution, asset_quadrant, description, created_at')
          .eq('member_id', memberId)
          .eq('status', 1)
          .order('created_at', { ascending: true }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (accountsRes.error) throw accountsRes.error;

      const profile = profileRes.data as ProfileRow | null;
      const accounts = (accountsRes.data ?? []) as AssetAccountRow[];
      const accountIds = accounts.map((account) => account.id);
      const snapshotsRes = accountIds.length > 0
        ? await supabase
          .from('asset_daily_snapshots')
          .select('account_id, snapshot_date, amount')
          .in('account_id', accountIds)
          .order('snapshot_date', { ascending: true })
        : { data: [] as SnapshotRow[], error: null };

      if (snapshotsRes.error) throw snapshotsRes.error;

      const latestSnapshotByAccount = new Map<number, SnapshotRow>();
      const snapshotsByAccount = new Map<number, SnapshotRow[]>();
      const normalizedSnapshots = ((snapshotsRes.data ?? []) as SnapshotRow[]).map((snapshot) => ({
        account_id: Number(snapshot.account_id),
        snapshot_date: snapshot.snapshot_date,
        amount: Number(snapshot.amount),
      }));

      normalizedSnapshots.forEach((snapshot) => {
        const normalized = {
          account_id: snapshot.account_id,
          snapshot_date: snapshot.snapshot_date,
          amount: snapshot.amount,
        } satisfies SnapshotRow;
        latestSnapshotByAccount.set(Number(snapshot.account_id), {
          account_id: normalized.account_id,
          snapshot_date: normalized.snapshot_date,
          amount: normalized.amount,
        });
        if (!snapshotsByAccount.has(normalized.account_id)) {
          snapshotsByAccount.set(normalized.account_id, []);
        }
        snapshotsByAccount.get(normalized.account_id)?.push(normalized);
      });

      const trendPeriods: Record<TrendGranularity, TrendPeriod[]> = {
        month: buildTrendPeriodsForDisplay(normalizedSnapshots.map((snapshot) => snapshot.snapshot_date), 'month'),
        year: buildTrendPeriodsForDisplay(normalizedSnapshots.map((snapshot) => snapshot.snapshot_date), 'year'),
      };

      const detailedAccounts = accounts.map((account) => {
        const latestSnapshot = latestSnapshotByAccount.get(account.id);
        return {
          id: account.id,
          accountName: account.account_name,
          accountType: account.account_type,
          institution: account.institution,
          assetQuadrant: account.asset_quadrant,
          description: account.description,
          amount: latestSnapshot?.amount ?? 0,
          snapshotDate: latestSnapshot?.snapshot_date ?? null,
          trends: {
            month: trendPeriods.month.map((period) => getValueAtDate(snapshotsByAccount.get(account.id) ?? [], period.dateText)),
            year: trendPeriods.year.map((period) => getValueAtDate(snapshotsByAccount.get(account.id) ?? [], period.dateText)),
          },
        } satisfies MemberAssetAccount;
      });

      const totalAmount = detailedAccounts.reduce((sum, account) => sum + account.amount, 0);

      setDetail({
        memberId,
        displayName: profile?.display_name ?? `成员${memberId}`,
        avatarUrl: profile?.avatar_url ?? null,
        totalAmount,
        accountCount: detailedAccounts.length,
        trendLabels: {
          month: trendPeriods.month.map((period) => period.label),
          year: trendPeriods.year.map((period) => period.label),
        },
        accounts: detailedAccounts,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '加载失败';
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail]),
  );

  return (
    <ScreenWrapper className="bg-app-bg">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pb-3" style={{ paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/family-members')}
              style={{ width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 28, color: Colors.text.secondary, fontWeight: '700', lineHeight: 28 }}>‹</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.text.primary, lineHeight: 26 }}>资产详情</Text>
          <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 4, lineHeight: 18 }}>
            查看该成员名下所有账户资产信息
          </Text>
        </View>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}

        {!loading && error ? (
          <View className="mx-4 mt-4 rounded-3xl p-5" style={{ backgroundColor: Colors.dangerBg, borderWidth: 1, borderColor: '#FBCFE8' }}>
            <Text style={{ fontSize: 14, color: Colors.danger }}>加载失败：{error}</Text>
          </View>
        ) : null}

        {!loading && !error && detail ? (
          <>
            <View
              className="mx-4 mt-2 rounded-3xl p-4"
              style={{
                backgroundColor: Colors.surface,
                shadowColor: Colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ borderWidth: 3, borderColor: `${Colors.primary}33`, borderRadius: 999, padding: 1 }}>
                  <Avatar uri={detail.avatarUrl} name={detail.displayName} size="md" />
                </View>
                <View style={{ marginLeft: 14, flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text.primary, lineHeight: 20 }}>{detail.displayName}</Text>
                  <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 4 }}>
                    {detail.accountCount}个账户
                  </Text>
                </View>

                <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: Colors.text.secondary }}>总个人财富</Text>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.primary, marginTop: 8, lineHeight: 34, letterSpacing: -0.4 }}>
                    ¥{formatAmount(detail.totalAmount)}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mx-4 mt-5">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text.primary }}>账户列表</Text>
                <TrendGranularitySwitch value={trendGranularity} onChange={setTrendGranularity} />
              </View>
            </View>

            {detail.accounts.length === 0 ? (
              <View className="mx-4 mt-4 rounded-3xl p-6" style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 14, color: Colors.text.secondary }}>该成员暂时还没有资产账户</Text>
              </View>
            ) : (
              <View className="mx-4 mt-4" style={{ gap: 12 }}>
                {detail.accounts.map((account) => {
                  const typeMeta = TYPE_META[account.accountType] ?? TYPE_META.其他;
                  const quadrantMeta = account.assetQuadrant ? QUADRANT_META[account.assetQuadrant] : null;

                  return (
                    <TouchableOpacity
                      key={account.id}
                      activeOpacity={0.9}
                      onPress={() => setSelectedAccountId(account.id)}
                      className="rounded-3xl p-4"
                      style={{
                        backgroundColor: Colors.surface,
                        shadowColor: Colors.shadow,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 1,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text.primary, lineHeight: 18 }} numberOfLines={1}>
                            {account.accountName}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: typeMeta.bgColor }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: typeMeta.color }}>{account.accountType}</Text>
                            </View>
                            {quadrantMeta ? (
                              <View
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                  backgroundColor: quadrantMeta.bgColor,
                                  borderWidth: 1,
                                  borderColor: quadrantMeta.borderColor,
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: quadrantMeta.textColor }}>
                                  {quadrantMeta.label}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <View style={{ marginLeft: 8 }}>
                          <MiniTrendChart values={account.trends[trendGranularity]} color={typeMeta.color} />
                        </View>

                        <View style={{ alignItems: 'flex-end', marginLeft: 8, width: 112 }}>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text.primary, lineHeight: 22 }}>
                            ¥{formatAmount(account.amount)}
                          </Text>
                          <Text style={{ fontSize: 10, color: Colors.text.secondary, marginTop: 4 }} numberOfLines={1}>
                            {formatSnapshotDate(account.snapshotDate)}
                          </Text>
                        </View>
                      </View>

                      {account.description?.trim() ? (
                        <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 10, lineHeight: 18 }}>
                          备注：{account.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      <AccountTrendModal
        visible={Boolean(selectedAccount)}
        account={selectedAccount}
        trendGranularity={trendGranularity}
        onTrendGranularityChange={setTrendGranularity}
        labels={detail?.trendLabels[trendGranularity] ?? []}
        onClose={() => setSelectedAccountId(null)}
      />
    </ScreenWrapper>
  );
}
