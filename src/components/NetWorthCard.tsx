import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NetWorthSummary } from '../types';
import { formatCurrency } from '../utils/format';
import { colors } from '../styles/theme';

interface NetWorthCardProps {
  summary: NetWorthSummary;
}

export const NetWorthCard: React.FC<NetWorthCardProps> = ({ summary }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>净资产</Text>
      <Text style={styles.netWorth}>¥{formatCurrency(summary.netWorth)}</Text>
      
      <View style={styles.divider}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>总资产</Text>
          <Text style={styles.assetAmount}>¥{formatCurrency(summary.totalAssets)}</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>总负债</Text>
          <Text style={styles.liabilityAmount}>¥{formatCurrency(summary.totalLiabilities)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  netWorth: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  divider: {
    flexDirection: 'row',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  assetAmount: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  liabilityAmount: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
