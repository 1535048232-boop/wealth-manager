import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';

interface MemberTypeBreakdown {
  label: string;
  amount: number;
  color: string;
  bg: string;
  icon: string;
}

interface FamilyMemberCardData {
  memberId: number;
  displayName: string;
  avatarUrl: string | null;
  totalAmount: number;
  percent: number;
  breakdown: MemberTypeBreakdown[];
  lineColor: string;
}

interface TrendPoint {
  label: string;
  totalsByMember: Record<number, number>;
}

type AssetTrendType = '总趋势' | '银行卡' | '股票' | '期权' | '公积金';

interface TrendChartSection {
  key: AssetTrendType;
  label: string;
  emptyText: string;
  accentColor: string;
  accentBg: string;
  trendPoints: TrendPoint[];
}

interface FamilyMembersAnalyticsData {
  totalAssets: number;
  memberCards: FamilyMemberCardData[];
  trendChartSections: TrendChartSection[];
}

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
  account_type: string;
}

interface SnapshotRow {
  account_id: number;
  snapshot_date: string;
  amount: number;
}

const MEMBER_LINE_COLORS = ['#8B5CF6', '#FB7185', '#0EA5E9', '#F59E0B', '#14B8A6'];
const TREND_CHART_CONFIG: Array<Omit<TrendChartSection, 'trendPoints'>> = [
  {
    key: '总趋势',
    label: '总趋势',
    emptyText: '暂无趋势数据',
    accentColor: Colors.primary,
    accentBg: Colors.primaryBg,
  },
  {
    key: '银行卡',
    label: '银行卡',
    emptyText: '暂无银行卡趋势数据',
    accentColor: '#4F46E5',
    accentBg: '#E0E7FF',
  },
  {
    key: '股票',
    label: '股票',
    emptyText: '暂无股票趋势数据',
    accentColor: '#EA580C',
    accentBg: '#FFEDD5',
  },
  {
    key: '期权',
    label: '期权',
    emptyText: '暂无期权趋势数据',
    accentColor: '#D97706',
    accentBg: '#FEF3C7',
  },
  {
    key: '公积金',
    label: '公积金',
    emptyText: '暂无公积金趋势数据',
    accentColor: '#059669',
    accentBg: '#D1FAE5',
  },
];

const ACCOUNT_TYPE_META: Record<string, { color: string; bg: string; icon: string }> = {
  '银行卡': { color: '#4F46E5', bg: '#E0E7FF', icon: 'bank' },
  '公积金': { color: '#059669', bg: '#D1FAE5', icon: 'home-city' },
  '股票': { color: '#EA580C', bg: '#FFEDD5', icon: 'chart-line' },
  '期权': { color: '#D97706', bg: '#FEF3C7', icon: 'ticket-percent' },
  '基金': { color: '#E11D48', bg: '#FFE4E6', icon: 'chart-donut' },
  '支付宝': { color: '#0284C7', bg: '#E0F2FE', icon: 'wallet' },
  '微信': { color: '#16A34A', bg: '#DCFCE7', icon: 'chat' },
  '现金': { color: '#CA8A04', bg: '#FEF9C3', icon: 'cash' },
  '保险': { color: '#9333EA', bg: '#F3E8FF', icon: 'shield-check' },
  '其他': { color: '#6B7280', bg: '#F3F4F6', icon: 'dots-grid' },
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

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthLabel(date: Date) {
  return `${date.getMonth() + 1}月`;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function getValueAtDate(snapshots: SnapshotRow[], dateText: string) {
  let lastAmount = 0;

  for (const snapshot of snapshots) {
    if (snapshot.snapshot_date <= dateText) {
      lastAmount = Number(snapshot.amount);
    } else {
      break;
    }
  }

  return lastAmount;
}

function getMemberSeriesPoints(
  data: { memberCards: FamilyMemberCardData[]; trendPoints: TrendPoint[] },
  memberId: number,
  width: number,
  height: number,
  maxValue: number,
  horizontalPadding = 0,
  topPadding = 0,
  bottomPadding = 0,
) {
  if (data.trendPoints.length === 0 || maxValue <= 0) return [] as Array<{ x: number; y: number }>;

  const drawableWidth = Math.max(width - horizontalPadding * 2, 1);
  const drawableHeight = Math.max(height - topPadding - bottomPadding, 1);
  const xStep = data.trendPoints.length === 1 ? 0 : drawableWidth / (data.trendPoints.length - 1);

  return data.trendPoints.map((point, index) => {
    const value = point.totalsByMember[memberId] ?? 0;
    return {
      x: horizontalPadding + index * xStep,
      y: topPadding + drawableHeight - (value / maxValue) * drawableHeight,
    };
  });
}

function TrendChart({
  data,
  title = '月度增长趋势',
}: {
  data: Pick<FamilyMembersAnalyticsData, 'memberCards' | 'trendChartSections'>;
  title?: string;
}) {
  const [selectedSectionKey, setSelectedSectionKey] = useState<AssetTrendType>('总趋势');
  const selectedSection = data.trendChartSections.find((section) => section.key === selectedSectionKey) ?? data.trendChartSections[0];
  const currentData = useMemo(
    () => ({
      memberCards: data.memberCards,
      trendPoints: selectedSection?.trendPoints ?? [],
    }),
    [data.memberCards, selectedSection],
  );
  const chartHeight = 180;
  const valueLabelWidth = 72;
  const axisLabels = [0, 0.25, 0.5, 0.75, 1];
  const [selectedIndex, setSelectedIndex] = useState(Math.max(currentData.trendPoints.length - 1, 0));
  const [selectedMemberId, setSelectedMemberId] = useState(data.memberCards[0]?.memberId ?? 0);
  const [chartWidth, setChartWidth] = useState(300);
  const chartHorizontalPadding = 24;
  const chartTopPadding = 26;
  const chartBottomPadding = 24;
  const drawableChartWidth = Math.max(chartWidth - chartHorizontalPadding * 2, 1);
  const drawableChartHeight = Math.max(chartHeight - chartTopPadding - chartBottomPadding, 1);
  const maxValue = Math.max(
    ...currentData.trendPoints.flatMap((point) => Object.values(point.totalsByMember)),
    0,
  );

  useEffect(() => {
    setSelectedIndex(Math.max(currentData.trendPoints.length - 1, 0));
  }, [currentData.trendPoints.length, selectedSectionKey]);

  useEffect(() => {
    if (!data.memberCards.some((member) => member.memberId === selectedMemberId)) {
      setSelectedMemberId(data.memberCards[0]?.memberId ?? 0);
    }
  }, [data.memberCards, selectedMemberId]);

  const selectedPoint = currentData.trendPoints[selectedIndex] ?? currentData.trendPoints[currentData.trendPoints.length - 1];
  const selectedMember = data.memberCards.find((member) => member.memberId === selectedMemberId) ?? data.memberCards[0];
  const selectedLineX = currentData.trendPoints.length > 1
    ? chartHorizontalPadding + (selectedIndex / (currentData.trendPoints.length - 1)) * drawableChartWidth
    : chartHorizontalPadding;
  const selectedMemberPoints = selectedMember
    ? getMemberSeriesPoints(
      currentData,
      selectedMember.memberId,
      chartWidth,
      chartHeight,
      maxValue,
      chartHorizontalPadding,
      chartTopPadding,
      chartBottomPadding,
    )
    : [];
  const activeSelectedPoint = selectedMemberPoints[selectedIndex];
  const selectedMemberValue = selectedPoint && selectedMember ? selectedPoint.totalsByMember[selectedMember.memberId] ?? 0 : 0;
  const labelLeft = activeSelectedPoint
    ? Math.max(8, Math.min(activeSelectedPoint.x - valueLabelWidth / 2, chartWidth - valueLabelWidth - 8))
    : 8;
  const labelTop = activeSelectedPoint ? Math.max(0, activeSelectedPoint.y - 24) : 0;

  const updateSelectedIndex = useCallback((locationX: number) => {
    if (currentData.trendPoints.length === 0) return;
    const x = Math.max(chartHorizontalPadding, Math.min(locationX, chartWidth - chartHorizontalPadding));
    const rawIndex = currentData.trendPoints.length === 1
      ? 0
      : Math.round(((x - chartHorizontalPadding) / drawableChartWidth) * (currentData.trendPoints.length - 1));

    setSelectedIndex(Math.max(0, Math.min(rawIndex, currentData.trendPoints.length - 1)));
  }, [chartHorizontalPadding, currentData.trendPoints.length, drawableChartWidth, chartWidth]);

  const chartPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (event) => updateSelectedIndex(event.nativeEvent.locationX),
      onPanResponderMove: (event) => updateSelectedIndex(event.nativeEvent.locationX),
    }),
    [updateSelectedIndex],
  );

  const renderSectionTabs = () => (
    <View className="flex-row flex-wrap mt-4 mb-1">
      {data.trendChartSections.map((section) => {
        const selected = section.key === selectedSectionKey;
        return (
          <TouchableOpacity
            key={section.key}
            activeOpacity={0.85}
            onPress={() => setSelectedSectionKey(section.key)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 7,
              marginRight: 8,
              marginBottom: 8,
              backgroundColor: selected ? section.accentBg : '#FFFFFF',
              borderWidth: 1,
              borderColor: selected ? section.accentColor : Colors.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? section.accentColor : Colors.text.secondary }}>
              {section.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (currentData.trendPoints.length === 0 || maxValue <= 0) {
    return (
      <View className="rounded-3xl px-5 py-6" style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text.primary }}>{title}</Text>
          {selectedSection ? (
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: selectedSection.accentBg,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: selectedSection.accentColor }}>{selectedSection.label}</Text>
            </View>
          ) : null}
        </View>
        {renderSectionTabs()}
        <Text style={{ fontSize: 13, color: Colors.text.secondary, marginTop: 10 }}>
          {selectedSection?.emptyText ?? '暂无趋势数据'}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-3xl px-5 py-5" style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'visible' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text.primary }}>{title}</Text>
        {selectedSection ? (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: selectedSection.accentBg,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: selectedSection.accentColor }}>{selectedSection.label}</Text>
          </View>
        ) : null}
      </View>

      {renderSectionTabs()}

      <View className="flex-row items-center flex-wrap mt-3 mb-3">
        {data.memberCards.map((member) => {
          const selected = member.memberId === selectedMember?.memberId;
          const selectedValue = selectedPoint?.totalsByMember[member.memberId] ?? 0;
          return (
            <TouchableOpacity
              key={member.memberId}
              activeOpacity={0.82}
              onPress={() => setSelectedMemberId(member.memberId)}
              className="flex-row items-center mr-2 mb-2"
              style={{
                borderRadius: 999,
                paddingHorizontal: 7,
                paddingVertical: 3,
                backgroundColor: selected ? `${member.lineColor}14` : '#FFFFFF',
                borderWidth: 1,
                borderColor: selected ? member.lineColor : Colors.border,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: member.lineColor, marginRight: 4 }} />
              <Text numberOfLines={1} style={{ fontSize: 10, color: selected ? Colors.text.primary : Colors.text.secondary, maxWidth: 64 }}>
                {member.displayName}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: selected ? member.lineColor : Colors.text.primary, marginLeft: 3 }}>
                ¥{formatAmount(selectedValue)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row' }}>
        <View
          style={{
            width: 40,
            height: chartHeight,
            justifyContent: 'space-between',
            paddingTop: chartTopPadding - 4,
            paddingBottom: chartBottomPadding - 2,
          }}
        >
          {[...axisLabels].reverse().map((ratio) => (
            <Text key={ratio} style={{ fontSize: 11, color: Colors.text.tertiary }}>
              {formatAmount(Math.round(maxValue * ratio))}
            </Text>
          ))}
        </View>

        <View
          style={{ flex: 1, minWidth: 0, overflow: 'visible' }}
          onLayout={(event) => {
            const nextWidth = Math.max(180, Math.floor(event.nativeEvent.layout.width));
            setChartWidth((current) => (Math.abs(current - nextWidth) > 1 ? nextWidth : current));
          }}
        >
          <View
            style={{ width: '100%', height: chartHeight, position: 'relative', overflow: 'visible' }}
            {...chartPanResponder.panHandlers}
          >
            {activeSelectedPoint && selectedMember ? (
              <View
                pointerEvents="none"
                className="rounded-full px-2 py-0.5"
                style={{
                  position: 'absolute',
                  left: labelLeft,
                  top: labelTop,
                  width: valueLabelWidth,
                  backgroundColor: selectedMember.lineColor,
                  borderWidth: 1,
                  borderColor: selectedMember.lineColor,
                  alignItems: 'center',
                  zIndex: 2,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    color: '#FFFFFF',
                  }}
                >
                  ¥{formatAmount(selectedMemberValue)}
                </Text>
              </View>
            ) : null}

            <Svg width={chartWidth} height={chartHeight}>
              {axisLabels.map((ratio) => {
                const y = chartTopPadding + drawableChartHeight - ratio * drawableChartHeight;
                return (
                  <Line
                    key={ratio}
                    x1={chartHorizontalPadding}
                    y1={y}
                    x2={chartWidth - chartHorizontalPadding}
                    y2={y}
                    stroke="#E5E7EB"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {selectedPoint && currentData.trendPoints.length > 1 ? (
                <Line
                  x1={selectedLineX}
                  y1={chartTopPadding}
                  x2={selectedLineX}
                  y2={chartTopPadding + drawableChartHeight}
                  stroke="#D8B4FE"
                  strokeDasharray="4 4"
                />
              ) : null}

              {data.memberCards.map((member) => {
                const points = getMemberSeriesPoints(
                  currentData,
                  member.memberId,
                  chartWidth,
                  chartHeight,
                  maxValue,
                  chartHorizontalPadding,
                  chartTopPadding,
                  chartBottomPadding,
                );
                const path = buildLinePath(points);
                const lastPoint = points[points.length - 1];
                const selectedChartPoint = points[selectedIndex];

                return (
                  <React.Fragment key={member.memberId}>
                    <Path d={path} fill="none" stroke={member.lineColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    {lastPoint ? <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={member.lineColor} /> : null}
                    {selectedChartPoint ? (
                      <>
                        <Circle cx={selectedChartPoint.x} cy={selectedChartPoint.y} r={6} fill="#FFFFFF" stroke={member.lineColor} strokeWidth={3} />
                        <Circle cx={selectedChartPoint.x} cy={selectedChartPoint.y} r={2.5} fill={member.lineColor} />
                      </>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>

          <View style={{ position: 'relative', marginTop: 8, width: '100%', height: 18 }}>
            {currentData.trendPoints.map((point, index) => (
              <Text
                key={point.label}
                style={{
                  position: 'absolute',
                  left: currentData.trendPoints.length === 1
                    ? chartHorizontalPadding - 12
                    : chartHorizontalPadding + (index / (currentData.trendPoints.length - 1)) * drawableChartWidth - 12,
                  width: 24,
                  textAlign: 'center',
                  fontSize: 11,
                  color: index === selectedIndex ? Colors.primary : Colors.text.tertiary,
                  fontWeight: index === selectedIndex ? '700' : '400',
                }}
              >
                {point.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function MemberBreakdownChip({ item }: { item: MemberTypeBreakdown }) {
  return (
    <View
      className="mb-2 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: item.bg, width: '48%' }}
    >
      <View className="flex-row items-start">
        <Text style={{ fontSize: 11, color: item.color, fontWeight: '700', flex: 1, lineHeight: 14 }}>{item.label}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ fontSize: 12, color: Colors.text.primary, fontWeight: '700', marginTop: 4 }}
      >
        ¥{formatAmount(item.amount)}
      </Text>
    </View>
  );
}

function MemberWealthCard({ member }: { member: FamilyMemberCardData }) {

  return (
    <View
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
      <View
        className="rounded-2xl pl-1 pr-2 py-3"
        style={{
          backgroundColor: `${member.lineColor}08`,
        }}
      >
        <View className="flex-row items-center">
          <View style={{ borderWidth: 3, borderColor: `${member.lineColor}55`, borderRadius: 999, padding: 1 }}>
            <Avatar uri={member.avatarUrl} name={member.displayName} size="sm" />
          </View>

          <View className="ml-3 flex-1 min-w-0">
            <Text style={{ fontSize: 12, color: Colors.text.secondary }}>总个人财富</Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginTop: 6, lineHeight: 19 }}
            >
              {member.displayName}
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5, lineHeight: 28 }}
          >
            ¥{formatAmount(member.totalAmount)}
          </Text>
          <View className="flex-row flex-wrap items-center mt-6">
            <Text style={{ fontSize: 13, color: Colors.text.secondary, marginRight: 6 }}>
              占家庭资产
            </Text>
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${member.lineColor}14` }}
            >
              <Text style={{ fontSize: 12, color: member.lineColor, fontWeight: '700' }}>
                {member.percent}%
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap items-start justify-between mt-3">
        {member.breakdown.length > 0 ? member.breakdown.map((item) => <MemberBreakdownChip key={`${member.memberId}-${item.label}`} item={item} />) : (
          <Text style={{ fontSize: 13, color: Colors.text.secondary }}>暂无账户明细</Text>
        )}
      </View>
    </View>
  );
}

function useFamilyMembersAnalytics() {
  const profileVersion = useAppStore((state) => state.profileVersion);
  const [data, setData] = useState<FamilyMembersAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const trendStart = new Date();
      trendStart.setMonth(trendStart.getMonth() - 5);
      trendStart.setDate(1);
      const trendStartText = trendStart.toISOString().split('T')[0];

      const [membersRes, accountsRes, snapshotsRes] = await Promise.all([
        supabase.from('family_members').select('id, user_id').eq('status', 1),
        supabase.from('asset_accounts').select('id, member_id, account_type').eq('status', 1),
        supabase.from('asset_daily_snapshots').select('account_id, snapshot_date, amount').gte('snapshot_date', trendStartText).order('snapshot_date', { ascending: true }),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (snapshotsRes.error) throw snapshotsRes.error;

      const familyMembers = (membersRes.data ?? []) as FamilyMemberRow[];
      const accounts = (accountsRes.data ?? []) as AssetAccountRow[];
      const snapshots = (snapshotsRes.data ?? []).map((item) => ({
        account_id: Number(item.account_id),
        snapshot_date: item.snapshot_date,
        amount: Number(item.amount),
      })) as SnapshotRow[];

      const userIds = familyMembers.map((member) => member.user_id).filter((id): id is string => Boolean(id));
      const profilesRes = userIds.length > 0
        ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
        : { data: [] as ProfileRow[], error: null };

      if (profilesRes.error) throw profilesRes.error;

      const profiles = profilesRes.data ?? [];
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const snapshotsByAccount = new Map<number, SnapshotRow[]>();
      const latestByAccount = new Map<number, number>();

      for (const snapshot of snapshots) {
        if (!snapshotsByAccount.has(snapshot.account_id)) {
          snapshotsByAccount.set(snapshot.account_id, []);
        }
        snapshotsByAccount.get(snapshot.account_id)?.push(snapshot);
        latestByAccount.set(snapshot.account_id, snapshot.amount);
      }

      const memberTypeMap = new Map<number, Map<string, number>>();
      const memberTotals = new Map<number, number>();

      for (const account of accounts) {
        const latestAmount = latestByAccount.get(account.id) ?? 0;
        memberTotals.set(account.member_id, (memberTotals.get(account.member_id) ?? 0) + latestAmount);

        if (!memberTypeMap.has(account.member_id)) {
          memberTypeMap.set(account.member_id, new Map<string, number>());
        }

        const typeMap = memberTypeMap.get(account.member_id);
        typeMap?.set(account.account_type, (typeMap.get(account.account_type) ?? 0) + latestAmount);
      }

      const totalAssets = Array.from(memberTotals.values()).reduce((sum, value) => sum + value, 0);
      const memberCards = familyMembers
        .map((member, index) => {
          const profile = member.user_id ? profileMap.get(member.user_id) : undefined;
          const typeAmounts = Array.from(memberTypeMap.get(member.id)?.entries() ?? [])
            .filter(([, amount]) => amount > 0)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 4)
            .map(([label, amount]) => ({
              label,
              amount,
              color: ACCOUNT_TYPE_META[label]?.color ?? ACCOUNT_TYPE_META['其他'].color,
              bg: ACCOUNT_TYPE_META[label]?.bg ?? ACCOUNT_TYPE_META['其他'].bg,
              icon: ACCOUNT_TYPE_META[label]?.icon ?? ACCOUNT_TYPE_META['其他'].icon,
            }));

          const totalAmount = memberTotals.get(member.id) ?? 0;
          return {
            memberId: member.id,
            displayName: profile?.display_name ?? `成员${member.id}`,
            avatarUrl: profile?.avatar_url ?? null,
            totalAmount,
            percent: totalAssets > 0 ? Number(((totalAmount / totalAssets) * 100).toFixed(1)) : 0,
            breakdown: typeAmounts,
            lineColor: MEMBER_LINE_COLORS[index % MEMBER_LINE_COLORS.length],
          } satisfies FamilyMemberCardData;
        })
        .sort((left, right) => right.totalAmount - left.totalAmount);

      const trendMonths = Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - index));
        const pointDate = index === 5 ? new Date() : getMonthEnd(date);
        return {
          label: getMonthLabel(date),
          dateText: pointDate.toISOString().split('T')[0],
        };
      });

      const buildTrendPoints = (accountType?: Exclude<AssetTrendType, '总趋势'>) => trendMonths.map((month) => {
        const totalsByMember: Record<number, number> = {};

        for (const member of familyMembers) {
          let totalForMember = 0;
          const memberAccounts = accounts.filter((account) => (
            account.member_id === member.id
            && (!accountType || account.account_type === accountType)
          ));

          for (const account of memberAccounts) {
            totalForMember += getValueAtDate(snapshotsByAccount.get(account.id) ?? [], month.dateText);
          }

          totalsByMember[member.id] = totalForMember;
        }

        return {
          label: month.label,
          totalsByMember,
        } satisfies TrendPoint;
      });
      const trendChartSections = TREND_CHART_CONFIG.map((chart) => ({
        ...chart,
        trendPoints: chart.key === '总趋势' ? buildTrendPoints() : buildTrendPoints(chart.key),
      }));

      setData({
        totalAssets,
        memberCards,
        trendChartSections,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [profileVersion]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics]),
  );

  return { data, isLoading, error, refetch: fetchAnalytics };
}

export default function FamilyMembersScreen() {
  const { data, isLoading, error } = useFamilyMembersAnalytics();

  return (
    <ScreenWrapper className="bg-app-bg">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View
          className="px-5 pb-3"
          style={{ paddingTop: 16 }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.text.primary }}>成员资产</Text>
          <Text style={{ fontSize: 13, color: Colors.text.secondary, marginTop: 4 }}>
            查看家庭成员资产占比与趋势
          </Text>
        </View>

        {isLoading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}

        {!isLoading && error ? (
          <View className="mx-4 mt-4 rounded-3xl p-5" style={{ backgroundColor: Colors.dangerBg, borderWidth: 1, borderColor: '#FBCFE8' }}>
            <Text style={{ fontSize: 14, color: Colors.danger }}>加载失败：{error}</Text>
          </View>
        ) : null}

        {!isLoading && !error && data ? (
          <>
            <View className="px-4 mt-2">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {data.memberCards.map((member) => (
                  <View key={member.memberId} style={{ width: '48%' }}>
                    <MemberWealthCard member={member} />
                  </View>
                ))}
              </View>
            </View>

            <View className="mx-4 mt-4">
              <TrendChart data={data} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}
