export interface Account {
  id: string;
  name: string;
  balance: number;
  previousBalance: number;
  type: 'asset' | 'liability';
  category: AssetCategory;
  icon?: string;
}

export type AssetCategory = 'liquid' | 'investment' | 'fixed' | 'liability';

export interface CategorySummary {
  category: AssetCategory;
  label: string;
  total: number;
  accounts: Account[];
  color: string;
  percentage: number;
}

export interface NetWorthSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  lastUpdated: string;
}

export interface Snapshot {
  id: string;
  date: string;
  accounts: {
    accountId: string;
    balance: number;
  }[];
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface BalanceChange {
  accountId: string;
  previousBalance: number;
  currentBalance: number;
  change: number;
  changePercent: number;
  isIncrease: boolean;
}

export interface MonthlyData {
  month: string;
  year: number;
  monthNum: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  categories: {
    category: AssetCategory;
    total: number;
  }[];
  accounts: {
    accountId: string;
    accountName: string;
    balance: number;
  }[];
}

export interface TrendData {
  months: MonthlyData[];
  netWorthTrend: TrendPoint[];
  assetsTrend: TrendPoint[];
  liabilitiesTrend: TrendPoint[];
  categoryTrends: Record<AssetCategory, TrendPoint[]>;
}

export interface TrendPoint {
  label: string;
  value: number;
  date: string;
}

export interface AccountPercentage {
  accountId: string;
  accountName: string;
  balance: number;
  percentage: number;
  category: AssetCategory;
}
