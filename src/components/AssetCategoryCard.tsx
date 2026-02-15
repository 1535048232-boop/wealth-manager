import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CategorySummary } from '../types';
import { formatCurrency } from '../utils/format';
import { colors } from '../styles/theme';

interface AssetCategoryCardProps {
  category: CategorySummary;
  isExpanded: boolean;
  onToggle: () => void;
}

export const AssetCategoryCard: React.FC<AssetCategoryCardProps> = ({
  category,
  isExpanded,
  onToggle,
}) => {
  const isLiability = category.category === 'liability';

  return (
    <View style={styles.container}>
      <Pressable onPress={onToggle} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.leftContent}>
            <View
              style={[styles.iconContainer, { backgroundColor: `${category.color}20` }]}
            >
              <View
                style={[styles.iconDot, { backgroundColor: category.color }]}
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.label}>{category.label}</Text>
              <Text style={styles.count}>{category.accounts.length} 个账户</Text>
            </View>
          </View>
          <View style={styles.rightContent}>
            <Text
              style={[
                styles.amount,
                { color: isLiability ? colors.danger : colors.primary },
              ]}
            >
              {isLiability ? '-' : ''}
              {formatCurrency(Math.abs(category.total))}
            </Text>
            <Text style={styles.expandText}>{isExpanded ? '收起' : '展开'}</Text>
          </View>
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.expandedContainer}>
          {category.accounts.map((account) => (
            <View key={account.id} style={styles.accountRow}>
              <View style={styles.accountLeft}>
                <Text style={styles.accountIcon}>{account.icon}</Text>
                <Text style={styles.accountName}>{account.name}</Text>
              </View>
              <Text
                style={[
                  styles.accountBalance,
                  { color: account.balance >= 0 ? colors.primary : colors.danger },
                ]}
              >
                {formatCurrency(account.balance)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    color: colors.secondary,
    fontSize: 14,
    marginTop: 2,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
  },
  expandText: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 2,
  },
  expandedContainer: {
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  accountName: {
    color: colors.primary,
    fontSize: 14,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '500',
  },
});
