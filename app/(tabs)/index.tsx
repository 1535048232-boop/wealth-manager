import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/Colors';
import { useHomeData, type AssetSegmentData, type HomeTrendPoint, type MemberSummary } from '@/hooks/useHomeData';

// ─── Donut chart helpers ────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const gap = 2;
  const s = startDeg + gap / 2;
  const e = endDeg - gap / 2;
  const start = polarToCartesian(cx, cy, r, s);
  const end = polarToCartesian(cx, cy, r, e);
  const large = e - s > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return '早上好';
  if (h >= 12 && h < 14) return '中午好';
  if (h >= 14 && h < 19) return '下午好';
  if (h >= 19 && h < 23) return '晚上好';
  return '夜深了';
}

function getDateLabel() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatAmount(n: number) {
  const abs = Math.abs(n);

  const formatScaled = (value: number, unit: string) => {
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    const compact = Number(value.toFixed(digits)).toString();
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

  return n < 0 ? `-${result}` : result;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function HomeAssetTrendChart({ points, width }: { points: HomeTrendPoint[]; width: number }) {
  const chartHeight = 112;
  const valueLabelWidth = 56;
  const maxValue = Math.max(...points.map((point) => point.totalAmount), 0);

  if (points.length === 0 || maxValue <= 0) {
    return null;
  }

  const xStep = points.length === 1 ? 0 : width / (points.length - 1);
  const chartPoints = points.map((point, index) => ({
    x: index * xStep,
    y: chartHeight - (point.totalAmount / maxValue) * chartHeight,
  }));

  return (
    <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border }}>
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text.primary }}>家庭总资产趋势</Text>
        <Text style={{ fontSize: 11, color: Colors.text.tertiary }}>近6个月</Text>
      </View>

      <View style={{ position: 'relative', width, height: chartHeight }}>
        {chartPoints.map((point, index) => {
          const labelLeft = Math.max(0, Math.min(point.x - valueLabelWidth / 2, width - valueLabelWidth));
          const labelTop = Math.max(0, point.y - 24);

          return (
            <View
              key={`${points[index].label}-value`}
              pointerEvents="none"
              className="rounded-full px-2 py-0.5"
              style={{
                position: 'absolute',
                left: labelLeft,
                top: labelTop,
                width: valueLabelWidth,
                backgroundColor: index === chartPoints.length - 1 ? Colors.primary : '#FFFFFF',
                borderWidth: 1,
                borderColor: index === chartPoints.length - 1 ? Colors.primary : Colors.border,
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
                  color: index === chartPoints.length - 1 ? '#FFFFFF' : Colors.text.primary,
                }}
              >
                ¥{formatAmount(points[index].totalAmount)}
              </Text>
            </View>
          );
        })}

        <Svg width={width} height={chartHeight}>
          {[0, 0.5, 1].map((ratio) => {
            const y = chartHeight - ratio * chartHeight;
            return <Path key={ratio} d={`M 0 ${y.toFixed(1)} L ${width.toFixed(1)} ${y.toFixed(1)}`} stroke="#E5E7EB" strokeDasharray="4 4" />;
          })}
          <Path d={buildLinePath(chartPoints)} fill="none" stroke={Colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          {chartPoints.map((point, index) => (
            <Circle
              key={points[index].label}
              cx={point.x}
              cy={point.y}
              r={index === chartPoints.length - 1 ? 4.5 : 3}
              fill={index === chartPoints.length - 1 ? Colors.primary : '#FFFFFF'}
              stroke={Colors.primary}
              strokeWidth={2}
            />
          ))}
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {points.map((point) => (
          <Text key={point.label} style={{ fontSize: 11, color: Colors.text.tertiary }}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Donut chart component ───────────────────────────────────────────────────

function DonutChart({ segments, size = 120 }: { segments: AssetSegmentData[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;
  const strokeW = outerR - innerR;
  const trackR = innerR + strokeW / 2;

  const arcs = useMemo(() => {
    let cursor = 0;
    return segments.map((seg) => {
      const startDeg = cursor * 3.6;
      const endDeg = (cursor + seg.percent) * 3.6;
      cursor += seg.percent;
      return { ...seg, startDeg, endDeg };
    });
  }, [segments]);

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={trackR} fill="none" stroke="#F3F4F6" strokeWidth={strokeW} />
      {arcs.map((arc, i) => (
        <Path
          key={i}
          d={buildArc(cx, cy, trackR, arc.startDeg, arc.endDeg)}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeW}
          strokeLinecap="butt"
        />
      ))}
    </Svg>
  );
}

// ─── Legend item ─────────────────────────────────────────────────────────────

function LegendItem({ seg }: { seg: AssetSegmentData }) {
  return (
    <View className="flex-row items-center mb-1">
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: seg.color, marginRight: 4 }} />
      <Text style={{ fontSize: 11, color: Colors.text.secondary, lineHeight: 16 }}>
        {seg.label}
      </Text>
      <Text style={{ fontSize: 11, color: Colors.text.primary, fontWeight: '600', marginLeft: 3 }}>
        {seg.percent}%
      </Text>
    </View>
  );
}

// ─── Member card ─────────────────────────────────────────────────────────────

function MemberCard({ member, compact = false }: { member: MemberSummary; compact?: boolean }) {
  return (
    <View
      style={{
        flex: compact ? undefined : 1,
        width: compact ? '100%' : undefined,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 14,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View className="flex-row items-center mb-2">
        <Avatar uri={member.avatarUrl} name={member.displayName ?? '?'} size="sm" />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{ fontSize: 13, fontWeight: '600', color: Colors.text.primary, marginLeft: 8, flex: 1 }}
        >
          {member.displayName ?? '成员'}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.74}
        style={{
          fontSize: compact ? 16 : 18,
          fontWeight: '700',
          color: Colors.text.primary,
          letterSpacing: -0.3,
        }}
      >
        ¥{formatAmount(member.totalAmount)}
      </Text>
      <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 2 }}>
        ({member.percent}%)
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const greeting = getGreeting();
  const dateLabel = getDateLabel();
  const { data, isLoading, error, refetch } = useHomeData();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const RIGHT_LEGEND_LIMIT = 5;
  const isNarrowScreen = width < 390;
  const homeTrendChartWidth = Math.max(width - 68, 220);

  return (
    <ScreenWrapper className="bg-app-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
          <Text style={{ fontSize: 26, fontWeight: '700', color: Colors.text.primary }}>
            {greeting}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.text.secondary }}>
            {dateLabel}
          </Text>
        </View>

        {/* Loading state */}
        {isLoading && (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <View className="mx-4 p-4 rounded-2xl" style={{ backgroundColor: Colors.dangerBg }}>
            <Text style={{ color: Colors.danger, fontSize: 14 }}>加载失败：{error}</Text>
          </View>
        )}

        {/* Content */}
        {!isLoading && data && (
          <>
            {/* Main asset card */}
            <View className="mx-4">
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => router.push('/(tabs)/family-members')}
                accessibilityLabel="查看家庭成员资产详情"
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 20,
                  padding: 18,
                  shadowColor: Colors.shadow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 1,
                  shadowRadius: 16,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 13, color: Colors.text.secondary, marginBottom: 8 }}>
                  家庭总资产
                </Text>

                <View style={{ flexDirection: isNarrowScreen ? 'column' : 'row', alignItems: 'flex-start' }}>
                  {/* Left: amount info */}
                  <View style={{ flex: 1, minWidth: 0, width: isNarrowScreen ? '100%' : undefined }}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      style={{
                        fontSize: isNarrowScreen ? 28 : 32,
                        fontWeight: '800',
                        color: Colors.primary,
                        letterSpacing: -1,
                        lineHeight: 38,
                      }}
                    >
                      ¥{formatAmount(data.totalAssets)}
                    </Text>

                    {/* Growth badge */}
                    {data.monthGrowth !== 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: data.monthGrowth >= 0 ? Colors.successBg : Colors.dangerBg,
                          borderRadius: 20,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          alignSelf: 'flex-start',
                          marginTop: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: data.monthGrowth >= 0 ? '#10B981' : '#EF4444',
                          }}
                        >
                          {data.monthGrowth >= 0 ? '+' : ''}¥{formatAmount(Math.abs(data.monthGrowth))}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: data.monthGrowth >= 0 ? '#10B981' : '#EF4444',
                            marginLeft: 2,
                          }}
                        >
                          本月增长
                        </Text>
                      </View>
                    )}

                    {/* Disposable */}
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                      style={{ fontSize: 13, color: Colors.text.secondary, marginTop: 10 }}
                    >
                      可支配{' '}
                      <Text style={{ color: Colors.text.primary, fontWeight: '600' }}>
                        ¥{formatAmount(data.disposableAmount)}
                      </Text>
                      {' '}
                      <Text style={{ color: Colors.text.tertiary }}>
                        ({data.disposablePercent}%)
                      </Text>
                    </Text>
                  </View>

                  {/* Right: donut chart + legend */}
                  {data.segments.length > 0 && (
                    <View
                      style={{
                        alignItems: 'flex-start',
                        marginLeft: isNarrowScreen ? 0 : 8,
                        marginTop: isNarrowScreen ? 14 : 0,
                        width: isNarrowScreen ? '100%' : undefined,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <DonutChart segments={data.segments} size={108} />
                        <View style={{ marginLeft: 10 }}>
                          {data.segments.slice(0, RIGHT_LEGEND_LIMIT).map((seg) => (
                            <LegendItem key={seg.label} seg={seg} />
                          ))}
                        </View>
                      </View>
                      {data.segments.length > RIGHT_LEGEND_LIMIT && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2, paddingLeft: 4 }}>
                          {data.segments.slice(RIGHT_LEGEND_LIMIT).map((seg) => (
                            <LegendItem key={seg.label} seg={seg} />
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <HomeAssetTrendChart points={data.trendPoints} width={homeTrendChartWidth} />
              </TouchableOpacity>
            </View>

            {/* Member cards */}
            {data.members.length > 0 && (
              <View
                style={{
                  flexDirection: isNarrowScreen ? 'column' : 'row',
                  marginHorizontal: 16,
                  marginTop: 16,
                  gap: 12,
                }}
              >
                {data.members.map((m) => (
                  <MemberCard key={m.memberId} member={m} compact={isNarrowScreen} />
                ))}
              </View>
            )}

            {/* Empty state: no asset data */}
            {data.totalAssets === 0 && (
              <View className="mx-4 mt-4 p-6 rounded-2xl items-center" style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 14, color: Colors.text.tertiary, textAlign: 'center' }}>
                  暂无资产数据{'\n'}请先录入资产账户和余额
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
