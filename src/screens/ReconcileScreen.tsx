import React, { useState } from 'react';
import { View, ScrollView, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllAccounts } from '../data/mockData';
import { Account } from '../types';
import { formatFullCurrency } from '../utils/format';
import { colors } from '../styles/theme';

interface AccountReconcileItemProps {
  account: Account;
  value: string;
  onValueChange: (value: string) => void;
}

const AccountReconcileItem: React.FC<AccountReconcileItemProps> = ({
  account,
  value,
  onValueChange,
}) => {
  const isLiability = account.type === 'liability';
  const isDifferent = value !== account.balance.toString();

  return (
    <View style={styles.accountRow}>
      <View style={styles.accountLeft}>
        <Text style={styles.accountIcon}>{account.icon}</Text>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountBalance}>
            账面余额: {formatFullCurrency(account.balance)}
          </Text>
        </View>
      </View>
      <View style={styles.inputContainer}>
        <Text style={[styles.currencySymbol, { color: isLiability ? colors.danger : colors.primary }]}>
          ¥
        </Text>
        <View style={[styles.inputWrapper, isDifferent && styles.inputWrapperChanged]}>
          <TextInput
            value={value}
            onChangeText={onValueChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: isLiability ? colors.danger : colors.primary }]}
          />
        </View>
      </View>
    </View>
  );
};

export const ReconcileScreen: React.FC = () => {
  const accounts = getAllAccounts();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    accounts.forEach(acc => {
      initial[acc.id] = acc.balance.toString();
    });
    return initial;
  });

  const handleValueChange = (accountId: string, value: string) => {
    setValues(prev => ({
      ...prev,
      [accountId]: value,
    }));
  };

  const assetAccounts = accounts.filter(acc => acc.type === 'asset');
  const liabilityAccounts = accounts.filter(acc => acc.type === 'liability');

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>家庭资产看板</Text>
          <Text style={styles.headerTitle}>一键对账</Text>
          <Text style={styles.headerDesc}>
            快速核对各账户余额，确保账目准确
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>资产账户</Text>
              <Text style={styles.sectionCount}>{assetAccounts.length} 个账户</Text>
            </View>
            <View style={styles.card}>
              {assetAccounts.map((account) => (
                <AccountReconcileItem
                  key={account.id}
                  account={account}
                  value={values[account.id]}
                  onValueChange={(value) => handleValueChange(account.id, value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>负债账户</Text>
              <Text style={styles.sectionCount}>{liabilityAccounts.length} 个账户</Text>
            </View>
            <View style={styles.card}>
              {liabilityAccounts.map((account) => (
                <AccountReconcileItem
                  key={account.id}
                  account={account}
                  value={values[account.id]}
                  onValueChange={(value) => handleValueChange(account.id, value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Pressable style={styles.saveButton}>
              <Text style={styles.saveButtonText}>保存对账结果</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerSubtitle: {
    color: colors.secondary,
    fontSize: 14,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  headerDesc: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCount: {
    color: colors.secondary,
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
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
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  accountBalance: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 14,
    marginRight: 4,
  },
  inputWrapper: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    backgroundColor: colors.background,
  },
  inputWrapperChanged: {
    backgroundColor: 'rgba(26, 31, 54, 0.05)',
  },
  input: {
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 24,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
