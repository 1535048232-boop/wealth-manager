import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(angle: number) {
  return (angle + 360) % 360;
}

function HomeAssetTrendChart({
  points,
  segments,
  width,
}: {
  points: HomeTrendPoint[];
  segments: AssetSegmentData[];
  width: number;
}) {
  const chartHeight = 128;
  const valueLabelWidth = 64;
  const chartPaddingX = 24;
  const latestIndex = Math.max(points.length - 1, 0);
  const dimensionSegments = segments.slice(0, 5);
  const [selectedIndex, setSelectedIndex] = useState(latestIndex);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    setSelectedIndex(latestIndex);
    setIsInteracting(false);
  }, [latestIndex, points]);

  const series = [
    {
      key: 'total',
      label: '总资产',
      color: Colors.primary,
      strokeWidth: 3,
      values: points.map((point) => point.totalAmount),
      isTotal: true,
    },
    ...dimensionSegments.map((segment) => ({
      key: segment.label,
      label: segment.label,
      color: segment.color,
      strokeWidth: 2,
      values: points.map((point) => point.typeAmounts[segment.label] ?? 0),
      isTotal: false,
    })),
  ];
  const maxValue = Math.max(...series.flatMap((item) => item.values), 0);

  if (points.length === 0 || maxValue <= 0) {
    return null;
  }

  const plotWidth = Math.max(width - chartPaddingX * 2, 0);
  const activeIndex = clamp(selectedIndex, 0, points.length - 1);
  const activeLabel = points[activeIndex]?.label ?? '';
  const xStep = points.length === 1 ? 0 : plotWidth / (points.length - 1);
  const chartSeries = series.map((item) => ({
    ...item,
    points: item.values.map((value, index) => ({
      x: chartPaddingX + index * xStep,
      y: chartHeight - (value / maxValue) * chartHeight,
    })),
    selectedValue: item.values[activeIndex] ?? 0,
  }));
  const totalSeries = chartSeries[0];
  const activeTotalPoint = totalSeries.points[activeIndex];
  const labelLeft = activeTotalPoint ? Math.max(8, Math.min(activeTotalPoint.x - valueLabelWidth / 2, width - valueLabelWidth - 8)) : 8;
  const labelTop = activeTotalPoint ? Math.max(0, activeTotalPoint.y - 24) : 0;

  const updateSelectedIndex = useCallback(
    (locationX: number) => {
      if (points.length <= 1 || plotWidth <= 0) {
        setSelectedIndex(0);
        return;
      }

      const ratio = (locationX - chartPaddingX) / plotWidth;
      setSelectedIndex(clamp(Math.round(ratio * (points.length - 1)), 0, points.length - 1));
    },
    [chartPaddingX, plotWidth, points.length],
  );

  const resetSelection = useCallback(() => {
    setIsInteracting(false);
    setSelectedIndex(latestIndex);
  }, [latestIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) >= Math.abs(gestureState.dy),
        onPanResponderGrant: (event) => {
          setIsInteracting(true);
          updateSelectedIndex(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateSelectedIndex(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          resetSelection();
        },
        onPanResponderTerminate: () => {
          resetSelection();
        },
      }),
    [resetSelection, updateSelectedIndex],
  );

  return (
    <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border }}>
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text.primary }}>家庭资产趋势</Text>
        <Text style={{ fontSize: 11, color: isInteracting ? Colors.primary : Colors.text.tertiary }}>
          {isInteracting ? activeLabel : '按住拖动查看'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {chartSeries.map((item) => (
          <View
            key={item.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 3,
              backgroundColor: item.isTotal ? Colors.primaryMid : '#FFFFFF',
              borderWidth: 1,
              borderColor: item.isTotal ? Colors.primaryLight : Colors.border,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color, marginRight: 4 }} />
            <Text numberOfLines={1} style={{ fontSize: 10, color: Colors.text.secondary, maxWidth: 54 }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: item.isTotal ? Colors.primary : Colors.text.primary, marginLeft: 3 }}>
              ¥{formatAmount(item.selectedValue)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ position: 'relative', width, height: chartHeight }}>
        {activeTotalPoint ? (
          <View
            pointerEvents="none"
            className="rounded-full px-2 py-0.5"
            style={{
              position: 'absolute',
              left: labelLeft,
              top: labelTop,
              width: valueLabelWidth,
              backgroundColor: Colors.primary,
              borderWidth: 1,
              borderColor: Colors.primary,
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
              ¥{formatAmount(totalSeries.selectedValue)}
            </Text>
          </View>
        ) : null}

        <Svg width={width} height={chartHeight}>
          {[0, 0.5, 1].map((ratio) => {
            const y = chartHeight - ratio * chartHeight;
            return (
              <Path
                key={ratio}
                d={`M ${chartPaddingX.toFixed(1)} ${y.toFixed(1)} L ${(width - chartPaddingX).toFixed(1)} ${y.toFixed(1)}`}
                stroke="#E5E7EB"
                strokeDasharray="4 4"
              />
            );
          })}
          {chartSeries.slice(1).map((item) => (
            <Path
              key={item.key}
              d={buildLinePath(item.points)}
              fill="none"
              stroke={item.color}
              strokeWidth={item.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.8}
            />
          ))}
          <Path d={buildLinePath(totalSeries.points)} fill="none" stroke={Colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          {activeTotalPoint ? (
            <Path
              d={`M ${activeTotalPoint.x.toFixed(1)} 0 L ${activeTotalPoint.x.toFixed(1)} ${chartHeight.toFixed(1)}`}
              fill="none"
              stroke={isInteracting ? Colors.primaryLight : Colors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}
          {chartSeries.map((item) => {
            const activePoint = item.points[activeIndex];
            if (!activePoint || item.selectedValue <= 0) return null;

            return (
              <Circle
                key={`${item.key}-selected`}
                cx={activePoint.x}
                cy={activePoint.y}
                r={item.isTotal ? (isInteracting ? 5 : 4.5) : isInteracting ? 3.5 : 3}
                fill={item.isTotal ? Colors.primary : '#FFFFFF'}
                stroke={item.color}
                strokeWidth={2}
              />
            );
          })}
        </Svg>

        <View
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 3 }}
          {...panResponder.panHandlers}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: chartPaddingX }}>
        {points.map((point) => (
          <Text
            key={point.label}
            style={{
              fontSize: 11,
              color: point.label === activeLabel ? Colors.primary : Colors.text.tertiary,
              fontWeight: point.label === activeLabel ? '700' : '400',
            }}
          >
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
  const touchPadding = 14;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const arcs = useMemo(() => {
    let cursor = 0;
    return segments.map((seg) => {
      const startDeg = cursor * 3.6;
      const endDeg = (cursor + seg.percent) * 3.6;
      cursor += seg.percent;
      return { ...seg, startDeg, endDeg };
    });
  }, [segments]);

  useEffect(() => {
    setActiveIndex(null);
    setIsInteracting(false);
  }, [segments]);

  const activeSegment = activeIndex === null ? null : arcs[activeIndex] ?? null;

  const getActiveSegmentIndex = useCallback(
    (locationX: number, locationY: number) => {
      const dx = locationX - cx;
      const dy = locationY - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < innerR - touchPadding || distance > outerR + touchPadding) {
        return null;
      }

      const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90);
      const foundIndex = arcs.findIndex((arc) => angle >= arc.startDeg && angle <= arc.endDeg);
      return foundIndex >= 0 ? foundIndex : null;
    },
    [arcs, cx, cy, innerR, outerR],
  );

  const updateActiveSegment = useCallback(
    (locationX: number, locationY: number) => {
      const nextIndex = getActiveSegmentIndex(locationX, locationY);
      if (nextIndex !== null) {
        setActiveIndex(nextIndex);
      }
    },
    [getActiveSegmentIndex],
  );

  const resetInteraction = useCallback(() => {
    setIsInteracting(false);
    setActiveIndex(null);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setIsInteracting(true);
          updateActiveSegment(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          updateActiveSegment(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderRelease: () => {
          resetInteraction();
        },
        onPanResponderTerminate: () => {
          resetInteraction();
        },
      }),
    [resetInteraction, updateActiveSegment],
  );

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={trackR} fill="none" stroke="#F3F4F6" strokeWidth={strokeW} />
        {arcs.map((arc, i) => {
          const isActive = activeIndex === i;
          const hasSelection = activeIndex !== null;
          return (
            <Path
              key={arc.label}
              d={buildArc(cx, cy, trackR, arc.startDeg, arc.endDeg)}
              fill="none"
              stroke={arc.color}
              strokeWidth={isActive ? strokeW + 5 : strokeW}
              strokeOpacity={hasSelection && !isActive ? 0.3 : 1}
              strokeLinecap={isActive ? 'round' : 'butt'}
            />
          );
        })}
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: activeSegment ? 12 : 11,
            fontWeight: '600',
            color: activeSegment ? Colors.text.primary : Colors.text.secondary,
          }}
        >
          {activeSegment?.label ?? '资产结构'}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: activeSegment ? 18 : 11,
            fontWeight: activeSegment ? '700' : '500',
            color: activeSegment ? Colors.primary : Colors.text.tertiary,
          }}
        >
          {activeSegment ? `${activeSegment.percent}%` : isInteracting ? '滑动查看' : '按住查看'}
        </Text>
      </View>

      <View
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        {...panResponder.panHandlers}
      />
    </View>
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
              <View
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

                <HomeAssetTrendChart points={data.trendPoints} segments={data.segments} width={homeTrendChartWidth} />
              </View>
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
