import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { TrendPoint } from '../types';
import { colors } from '../styles/theme';
import { formatCurrency } from '../utils/format';

interface TrendChartProps {
  data: TrendPoint[];
  title: string;
  color: string;
  height?: number;
  width?: number;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title,
  color,
  height = 200,
  width = 320,
}) => {
  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.emptyChart, { height }]}>
          <Text style={styles.emptyText}>暂无数据</Text>
        </View>
      </View>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const minValue = Math.min(...values) * 0.95;
  const maxValue = Math.max(...values) * 1.05;
  const valueRange = maxValue - minValue;

  const points = data.map((point, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, ...point };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => 
    minValue + (valueRange * i) / yTicks
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.chartWrapper, { height, width }]}>
        <Svg width={width} height={height}>
          <G>
            {yTickValues.map((tick, i) => {
              const y = padding.top + chartHeight - (i / yTicks) * chartHeight;
              return (
                <G key={`tick-${i}`}>
                  <Line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={colors.border}
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={padding.left - 8}
                    y={y + 4}
                    fontSize={10}
                    fill={colors.secondary}
                    textAnchor="end"
                  >
                    {formatCurrency(tick)}
                  </SvgText>
                </G>
              );
            })}

            <Path d={areaD} fill={`${color}20`} />
            <Path d={pathD} fill="none" stroke={color} strokeWidth={2} />

            {points.map((point, i) => (
              <G key={`point-${i}`}>
                <Rect
                  x={point.x - 15}
                  y={padding.top + chartHeight + 5}
                  width={30}
                  height={20}
                  fill="transparent"
                />
                <SvgText
                  x={point.x}
                  y={padding.top + chartHeight + 18}
                  fontSize={10}
                  fill={colors.secondary}
                  textAnchor="middle"
                >
                  {point.label}
                </SvgText>
              </G>
            ))}

            {points.map((point, i) => (
              <G key={`dot-${i}`}>
                <Rect
                  x={point.x - 4}
                  y={point.y - 4}
                  width={8}
                  height={8}
                  fill={color}
                  rx={4}
                />
              </G>
            ))}
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartWrapper: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyChart: {
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.secondary,
    fontSize: 14,
  },
});
