import React, { useRef, useCallback } from 'react';
import { View, ScrollView, Text, TextInput, StyleSheet, findNodeHandle, TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAssets } from '../context/AssetContext';
import { Account } from '../types';
import { formatFullCurrency } from '../utils/format';
import { colors } from '../styles/theme';

interface AccountReconcileItemProps {
  account: Account;
  index: number;
  totalCount: number;
  inputRefs: React.MutableRefObject<(TextInput | null)[]>;
  onFocusNext: (currentIndex: number) => void;
}

const AccountReconcileItem: React.FC<AccountReconcileItemProps> = ({
  account,
  index,
  totalCount,
  inputRefs,
  onFocusNext,
}) => {
  const { updateAccountBalance } = useAssets();
  const [inputValue, setInputValue] = React.useState(account.balance.toString());
  const [isEditing, setIsEditing] = React.useState(false);

  const isLiability = account.type === 'liability';
  const balanceDiff = account.balance - account.previousBalance;
  const hasIncreased = balanceDiff > 0;
  const hasDecreased = balanceDiff < 0;

  const handleEndEditing = useCallback(() => {
    setIsEditing(false);
    const numericValue = parseFloat(inputValue) || 0;
    const finalValue = isLiability ? -Math.abs(numericValue) : Math.abs(numericValue);
    updateAccountBalance(account.id, finalValue);
  }, [inputValue, account.id, isLiability, updateAccountBalance]);

  const handleSubmitEditing = useCallback(() => {
    handleEndEditing();
    onFocusNext(index);
  }, [handleEndEditing, onFocusNext, index]);

  const getChangeColor = () => {
    if (isLiability) {
      return hasIncreased ? colors.success : colors.danger;
    }
    return hasIncreased ? colors.success : colors.danger;
  };

  const getChangeText = () => {
    if (balanceDiff === 0) return null;
    const sign = balanceDiff > 0 ? '+' : '';
    return `${sign}${formatFullCurrency(balanceDiff)}`;
  };

  return (
    <View style={styles.accountRow}>
      <View style={styles.accountLeft}>
        <Text style={styles.accountIcon}>{account.icon}</Text>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{account.name}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.previousBalance}>
              上期: {formatFullCurrency(account.previousBalance)}
            </Text>
            {balanceDiff !== 0 && (
              <Text style={[styles.changeText, { color: getChangeColor() }]}>
                {getChangeText()}
              </Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.inputContainer}>
        <Text style={[styles.currencySymbol, { color: isLiability ? colors.danger : colors.primary }]}>
          ¥
        </Text>
        <View
          style={[
            styles.inputWrapper,
            isEditing && styles.inputWrapperFocused,
            hasIncreased && !isLiability && styles.inputWrapperIncreased,
            hasDecreased && !isLiability && styles.inputWrapperDecreased,
            hasIncreased && isLiability && styles.inputWrapperIncreased,
            hasDecreased && isLiability && styles.inputWrapperDecreased,
          ]}
        >
          <TextInput
            ref={(ref) => { inputRefs.current[index] = ref; }}
            value={inputValue}
            onChangeText={setInputValue}
            onFocus={() => setIsEditing(true)}
            onBlur={handleEndEditing}
            onSubmitEditing={handleSubmitEditing}
            keyboardType="decimal-pad"
            returnKeyType={index === totalCount - 1 ? 'done' : 'next'}
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            selectTextOnFocus
            style={[
              styles.input,
              { color: isLiability ? colors.danger : colors.primary },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

export const ReconcileScreen: React.FC = () => {
  const { accounts } = useAssets();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const assetAccounts = accounts.filter(acc => acc.type === 'asset');
  const liabilityAccounts = accounts.filter(acc => acc.type === 'liability');
  const allAccounts = [...assetAccounts, ...liabilityAccounts];

  const handleFocusNext = useCallback((currentIndex: number) => {
    if (currentIndex < allAccounts.length - 1) {
      const nextInput = inputRefs.current[currentIndex + 1];
      if (nextInput) {
        nextInput.focus();
      }
    }
  }, [allAccounts.length]);

  const getAccountIndex = (account: Account, isAsset: boolean) => {
    if (isAsset) {
      return assetAccounts.findIndex(a => a.id === account.id);
    }
    return assetAccounts.length + liabilityAccounts.findIndex(a => a.id === account.id);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>家庭资产看板</Text>
          <Text style={styles.headerTitle}>一键对账</Text>
          <Text style={styles.headerDesc}>
            修改余额后自动保存，点击"下一项"快速跳转
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                  index={getAccountIndex(account, true)}
                  totalCount={allAccounts.length}
                  inputRefs={inputRefs}
                  onFocusNext={handleFocusNext}
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
                  index={getAccountIndex(account, false)}
                  totalCount={allAccounts.length}
                  inputRefs={inputRefs}
                  onFocusNext={handleFocusNext}
                />
              ))}
            </View>
          </View>

          <View style={styles.tipContainer}>
            <Text style={styles.tipText}>
              💡 提示: 输入完成后点击键盘"下一项"可快速跳转
            </Text>
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
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  previousBalance: {
    color: colors.secondary,
    fontSize: 12,
  },
  changeText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  inputWrapperIncreased: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: colors.success,
  },
  inputWrapperDecreased: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: colors.danger,
  },
  input: {
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '500',
    minWidth: 80,
  },
  tipContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(26, 31, 54, 0.05)',
    borderRadius: 12,
  },
  tipText: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
