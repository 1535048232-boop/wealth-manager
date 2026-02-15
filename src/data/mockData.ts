import { Account, CategorySummary, NetWorthSummary, AssetCategory } from '../types';

export const accounts: Account[] = [
  { id: '1', name: '招商银行', balance: 125680.50, type: 'asset', category: 'liquid', icon: '🏦' },
  { id: '2', name: '支付宝', balance: 8934.20, type: 'asset', category: 'liquid', icon: '📱' },
  { id: '3', name: '微信钱包', balance: 3256.80, type: 'asset', category: 'liquid', icon: '💬' },
  { id: '4', name: '现金', balance: 5000.00, type: 'asset', category: 'liquid', icon: '💵' },
  { id: '5', name: '股票账户', balance: 286500.00, type: 'asset', category: 'investment', icon: '📈' },
  { id: '6', name: '基金', balance: 156780.00, type: 'asset', category: 'investment', icon: '📊' },
  { id: '7', name: '债券', balance: 50000.00, type: 'asset', category: 'investment', icon: '📄' },
  { id: '8', name: '房产', balance: 3500000.00, type: 'asset', category: 'fixed', icon: '🏠' },
  { id: '9', name: '车辆', balance: 280000.00, type: 'asset', category: 'fixed', icon: '🚗' },
  { id: '10', name: '房贷', balance: -1850000.00, type: 'liability', category: 'liability', icon: '🏠' },
  { id: '11', name: '车贷', balance: -85000.00, type: 'liability', category: 'liability', icon: '🚗' },
  { id: '12', name: '信用卡', balance: -12580.00, type: 'liability', category: 'liability', icon: '💳' },
];

const categoryConfig: Record<AssetCategory, { label: string; color: string }> = {
  liquid: { label: '流动资产', color: '#4ADE80' },
  investment: { label: '投资资产', color: '#60A5FA' },
  fixed: { label: '固定资产', color: '#A78BFA' },
  liability: { label: '负债', color: '#F87171' },
};

export const getCategorySummaries = (): CategorySummary[] => {
  const categories: AssetCategory[] = ['liquid', 'investment', 'fixed', 'liability'];
  
  return categories.map(category => {
    const categoryAccounts = accounts.filter(acc => acc.category === category);
    const total = categoryAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    return {
      category,
      label: categoryConfig[category].label,
      total,
      accounts: categoryAccounts,
      color: categoryConfig[category].color,
    };
  });
};

export const getNetWorthSummary = (): NetWorthSummary => {
  const totalAssets = accounts
    .filter(acc => acc.type === 'asset')
    .reduce((sum, acc) => sum + acc.balance, 0);
  
  const totalLiabilities = Math.abs(
    accounts
      .filter(acc => acc.type === 'liability')
      .reduce((sum, acc) => sum + acc.balance, 0)
  );
  
  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
  };
};

export const getAllAccounts = (): Account[] => {
  return accounts;
};
