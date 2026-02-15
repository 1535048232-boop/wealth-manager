export interface Account {
  id: string;
  name: string;
  balance: number;
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
}

export interface NetWorthSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}
