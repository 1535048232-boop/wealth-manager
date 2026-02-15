import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { CategorySummary } from '../types';
import { formatCurrency } from '../utils/format';
import { colors } from '../styles/theme';

interface AssetChartProps {
  categories: CategorySummary[];
  size?: number;
}

export const AssetChart: React.FC<AssetChartProps> = ({ categories, size = 200 }) => {
  const assetCategories = categories.filter(c => c.category !== 'liability');
  const total = assetCategories.reduce((sum, c) => sum + Math.abs(c.total), 0);
  
  const radius = (size - 40) / 2;
  const center = size / 2;
  const innerRadius = radius * 0.6;

  const calculateArcs = () => {
    let currentAngle = -90;
    const arcs: { startAngle: number; endAngle: number; color: string; percentage: number }[] = [];

    assetCategories.forEach((category) => {
      const percentage = (Math.abs(category.total) / total) * 100;
      const angle = (percentage / 100) * 360;
      
      arcs.push({
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        color: category.color,
        percentage,
      });
      
      currentAngle += angle;
    });

    return arcs;
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  const arcs = calculateArcs();

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G>
            {arcs.map((arc, index) => (
              <Path
                key={index}
                d={describeArc(arc.startAngle, arc.endAngle)}
                fill={arc.color}
              />
            ))}
            <Circle
              cx={center}
              cy={center}
              r={innerRadius - 8}
              fill="#FFFFFF"
            />
          </G>
        </Svg>
        <View style={[styles.centerLabel, { width: size, height: size }]}>
          <Text style={styles.centerLabelText}>总资产</Text>
          <Text style={styles.centerLabelAmount}>{formatCurrency(total)}</Text>
        </View>
      </View>
      
      <View style={styles.legendContainer}>
        {assetCategories.map((category) => (
          <View key={category.category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: category.color }]} />
            <Text style={styles.legendText}>{category.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabelText: {
    color: colors.secondary,
    fontSize: 12,
  },
  centerLabelAmount: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    color: colors.secondary,
    fontSize: 12,
  },
});
