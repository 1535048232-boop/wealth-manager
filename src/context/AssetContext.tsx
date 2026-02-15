import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Account, AssetCategory, CategorySummary, NetWorthSummary, Snapshot, TrendData, TrendPoint, MonthlyData } from '../types';

const categoryConfig: Record<AssetCategory, { label: string; color: string }> = {
  liquid: { label: '流动资产', color: '#4ADE80' },
  investment: { label: '投资资产', color: '#60A5FA' },
  fixed: { label: '固定资产', color: '#A78BFA' },
  liability: { label: '负债', color: '#F87171' },
};

const initialAccounts: Account[] = [
  { id: '1', name: '招商银行', balance: 125680.50, previousBalance: 120000, type: 'asset', category: 'liquid', icon: '🏦' },
  { id: '2', name: '支付宝', balance: 8934.20, previousBalance: 8500, type: 'asset', category: 'liquid', icon: '📱' },
  { id: '3', name: '微信钱包', balance: 3256.80, previousBalance: 3000, type: 'asset', category: 'liquid', icon: '💬' },
  { id: '4', name: '现金', balance: 5000.00, previousBalance: 5000, type: 'asset', category: 'liquid', icon: '💵' },
  { id: '5', name: '股票账户', balance: 286500.00, previousBalance: 270000, type: 'asset', category: 'investment', icon: '📈' },
  { id: '6', name: '基金', balance: 156780.00, previousBalance: 150000, type: 'asset', category: 'investment', icon: '📊' },
  { id: '7', name: '债券', balance: 50000.00, previousBalance: 50000, type: 'asset', category: 'investment', icon: '📄' },
  { id: '13', name: '期权', balance: 35000.00, previousBalance: 30000, type: 'asset', category: 'investment', icon: '🎯' },
  { id: '8', name: '房产', balance: 3500000.00, previousBalance: 3500000, type: 'asset', category: 'fixed', icon: '🏠' },
  { id: '9', name: '车辆', balance: 280000.00, previousBalance: 300000, type: 'asset', category: 'fixed', icon: '🚗' },
  { id: '10', name: '房贷', balance: -1850000.00, previousBalance: -1870000, type: 'liability', category: 'liability', icon: '🏠' },
  { id: '11', name: '车贷', balance: -85000.00, previousBalance: -90000, type: 'liability', category: 'liability', icon: '🚗' },
  { id: '12', name: '信用卡', balance: -12580.00, previousBalance: -10000, type: 'liability', category: 'liability', icon: '💳' },
];

const generateMockSnapshots = (): Snapshot[] => {
  const now = new Date();
  const snapshots: Snapshot[] = [];
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const factor = 1 + (5 - i) * 0.02;
    
    snapshots.push({
      id: `snapshot-${i}`,
      date: date.toISOString(),
      accounts: initialAccounts.map(acc => ({
        accountId: acc.id,
        balance: acc.balance * (0.9 + Math.random() * 0.2),
      })),
      netWorth: 2500000 * factor,
      totalAssets: 4400000 * factor,
      totalLiabilities: 1900000 * factor,
    });
  }
  
  return snapshots;
};

interface AssetContextType {
  accounts: Account[];
  snapshots: Snapshot[];
  lastUpdated: string;
  updateAccountBalance: (accountId: string, newBalance: number) => void;
  getNetWorthSummary: () => NetWorthSummary;
  getCategorySummaries: () => CategorySummary[];
  getAccountById: (accountId: string) => Account | undefined;
  saveSnapshot: () => void;
  getLatestSnapshot: () => Snapshot | undefined;
  getTrendData: () => TrendData;
  getMonthlyData: (year: number, month: number) => MonthlyData | undefined;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export const AssetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(generateMockSnapshots);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  const updateAccountBalance = useCallback((accountId: string, newBalance: number) => {
    setAccounts(prev => 
      prev.map(account => 
        account.id === accountId 
          ? { ...account, balance: newBalance }
          : account
      )
    );
    setLastUpdated(new Date().toISOString());
  }, []);

  const getNetWorthSummary = useCallback((): NetWorthSummary => {
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
      lastUpdated,
    };
  }, [accounts, lastUpdated]);

  const getCategorySummaries = useCallback((): CategorySummary[] => {
    const categories: AssetCategory[] = ['liquid', 'investment', 'fixed', 'liability'];
    const totalAssets = accounts
      .filter(acc => acc.type === 'asset')
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    return categories.map(category => {
      const categoryAccounts = accounts.filter(acc => acc.category === category);
      const total = categoryAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      const percentage = totalAssets > 0 ? (Math.abs(total) / totalAssets) * 100 : 0;
      
      return {
        category,
        label: categoryConfig[category].label,
        total,
        accounts: categoryAccounts,
        color: categoryConfig[category].color,
        percentage,
      };
    });
  }, [accounts]);

  const getAccountById = useCallback((accountId: string) => {
    return accounts.find(acc => acc.id === accountId);
  }, [accounts]);

  const saveSnapshot = useCallback(() => {
    const summary = getNetWorthSummary();
    const snapshot: Snapshot = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      accounts: accounts.map(acc => ({
        accountId: acc.id,
        balance: acc.balance,
      })),
      ...summary,
    };
    setSnapshots(prev => [...prev, snapshot]);
  }, [accounts, getNetWorthSummary]);

  const getLatestSnapshot = useCallback(() => {
    return snapshots[snapshots.length - 1];
  }, [snapshots]);

  const getTrendData = useCallback((): TrendData => {
    const sortedSnapshots = [...snapshots].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const netWorthTrend: TrendPoint[] = sortedSnapshots.map(s => ({
      label: new Date(s.date).toLocaleDateString('zh-CN', { month: 'short' }),
      value: s.netWorth,
      date: s.date,
    }));

    const assetsTrend: TrendPoint[] = sortedSnapshots.map(s => ({
      label: new Date(s.date).toLocaleDateString('zh-CN', { month: 'short' }),
      value: s.totalAssets,
      date: s.date,
    }));

    const liabilitiesTrend: TrendPoint[] = sortedSnapshots.map(s => ({
      label: new Date(s.date).toLocaleDateString('zh-CN', { month: 'short' }),
      value: s.totalLiabilities,
      date: s.date,
    }));

    const categoryTrends: Record<AssetCategory, TrendPoint[]> = {
      liquid: [],
      investment: [],
      fixed: [],
      liability: [],
    };

    sortedSnapshots.forEach(s => {
      const label = new Date(s.date).toLocaleDateString('zh-CN', { month: 'short' });
      categories.forEach(cat => {
        const catAccounts = s.accounts.filter(acc => {
          const account = accounts.find(a => a.id === acc.accountId);
          return account?.category === cat;
        });
        const total = catAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        categoryTrends[cat].push({
          label,
          value: total,
          date: s.date,
        });
      });
    });

    const months: MonthlyData[] = sortedSnapshots.map(s => {
      const date = new Date(s.date);
      return {
        month: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
        year: date.getFullYear(),
        monthNum: date.getMonth() + 1,
        netWorth: s.netWorth,
        totalAssets: s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        categories: categories.map(cat => {
          const catAccounts = s.accounts.filter(acc => {
            const account = accounts.find(a => a.id === acc.accountId);
            return account?.category === cat;
          });
          return {
            category: cat,
            total: catAccounts.reduce((sum, acc) => sum + acc.balance, 0),
          };
        }),
        accounts: s.accounts.map(acc => ({
          accountId: acc.accountId,
          accountName: accounts.find(a => a.id === acc.accountId)?.name || '',
          balance: acc.balance,
        })),
      };
    });

    return {
      months,
      netWorthTrend,
      assetsTrend,
      liabilitiesTrend,
      categoryTrends,
    };
  }, [snapshots, accounts]);

  const getMonthlyData = useCallback((year: number, month: number): MonthlyData | undefined => {
    const trendData = getTrendData();
    return trendData.months.find(m => m.year === year && m.monthNum === month);
  }, [getTrendData]);

  const categories: AssetCategory[] = ['liquid', 'investment', 'fixed', 'liability'];

  const value = useMemo(() => ({
    accounts,
    snapshots,
    lastUpdated,
    updateAccountBalance,
    getNetWorthSummary,
    getCategorySummaries,
    getAccountById,
    saveSnapshot,
    getLatestSnapshot,
    getTrendData,
    getMonthlyData,
  }), [
    accounts,
    snapshots,
    lastUpdated,
    updateAccountBalance,
    getNetWorthSummary,
    getCategorySummaries,
    getAccountById,
    saveSnapshot,
    getLatestSnapshot,
    getTrendData,
    getMonthlyData,
  ]);

  return (
    <AssetContext.Provider value={value}>
      {children}
    </AssetContext.Provider>
  );
};

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (!context) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
};
