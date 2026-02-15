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
  const totalAssets = category.accounts
    .filter(acc => acc.type === 'asset')
    .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);

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
            {!isLiability && (
              <Text style={styles.percentage}>
                占比 {category.percentage.toFixed(1)}%
              </Text>
            )}
            <Text style={styles.expandText}>{isExpanded ? '收起' : '展开'}</Text>
          </View>
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.expandedContainer}>
          {category.accounts.map((account) => {
            const balanceDiff = account.balance - account.previousBalance;
            const hasIncreased = balanceDiff > 0;
            const accountPercentage = totalAssets > 0 
              ? (Math.abs(account.balance) / totalAssets) * 100 
              : 0;
            
            return (
              <View key={account.id} style={styles.accountRow}>
                <View style={styles.accountLeft}>
                  <Text style={styles.accountIcon}>{account.icon}</Text>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <View style={styles.accountMeta}>
                      {balanceDiff !== 0 && (
                        <Text style={[
                          styles.changeText,
                          { color: (account.type === 'liability' ? !hasIncreased : hasIncreased) ? colors.success : colors.danger }
                        ]}>
                          {hasIncreased ? '+' : ''}{formatCurrency(balanceDiff)}
                        </Text>
                      )}
                      {!isLiability && (
                        <Text style={styles.accountPercentage}>
                          {accountPercentage.toFixed(1)}%
                        </Text>
                      )}
                    </View>
                  </View>
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
            );
          })}
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
  percentage: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 2,
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
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: colors.primary,
    fontSize: 14,
  },
  accountMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 8,
  },
  accountPercentage: {
    fontSize: 11,
    color: colors.muted,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '500',
  },
});
