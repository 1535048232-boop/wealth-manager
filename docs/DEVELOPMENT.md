# 家庭资产看板 - 开发文档

## 1. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React Native | 0.81.5 | 跨平台移动应用框架 |
| Expo | 54.0.33 | 开发工具链 |
| TypeScript | 5.9.2 | 类型安全 |
| React Native SVG | 15.15.3 | 图表绘制 |
| React Navigation | 7.x | 导航管理 (已安装，待集成) |

## 2. 项目结构

```
trae-wealth-manager/
├── App.tsx                    # 应用入口
├── app.json                   # Expo 配置
├── package.json               # 依赖管理
├── tsconfig.json              # TypeScript 配置
├── babel.config.js            # Babel 配置
├── metro.config.js            # Metro 配置
└── src/
    ├── App.tsx                # 主应用组件
    ├── styles/
    │   └── theme.ts           # 主题配置 (颜色、通用样式)
    ├── types/
    │   └── index.ts           # TypeScript 类型定义
    ├── data/
    │   └── mockData.ts        # 模拟数据
    ├── utils/
    │   └── format.ts          # 工具函数 (金额格式化)
    ├── components/
    │   ├── index.ts           # 组件导出
    │   ├── NetWorthCard.tsx   # 净资产卡片
    │   ├── AssetChart.tsx     # 资产分布饼图
    │   └── AssetCategoryCard.tsx  # 分类资产卡片
    └── screens/
        ├── index.ts           # 页面导出
        ├── DashboardScreen.tsx    # 首页总览
        └── ReconcileScreen.tsx    # 一键对账页
```

## 3. 核心组件说明

### 3.1 NetWorthCard

**文件路径**: `src/components/NetWorthCard.tsx`

**Props**:
```typescript
interface NetWorthCardProps {
  summary: NetWorthSummary;
}

interface NetWorthSummary {
  netWorth: number;        // 净资产
  totalAssets: number;     // 总资产
  totalLiabilities: number; // 总负债
}
```

**功能**: 显示净资产总额卡片，深蓝色背景，白色文字

### 3.2 AssetChart

**文件路径**: `src/components/AssetChart.tsx`

**Props**:
```typescript
interface AssetChartProps {
  categories: CategorySummary[];  // 分类数据
  size?: number;                  // 图表尺寸，默认 200
}
```

**功能**: SVG 环形饼图，展示资产分布

### 3.3 AssetCategoryCard

**文件路径**: `src/components/AssetCategoryCard.tsx`

**Props**:
```typescript
interface AssetCategoryCardProps {
  category: CategorySummary;
  isExpanded: boolean;
  onToggle: () => void;
}
```

**功能**: 可展开的分类卡片，显示分类总额和账户明细

## 4. 工具函数

### 4.1 金额格式化

**文件路径**: `src/utils/format.ts`

```typescript
// 大额数字自动转换
formatCurrency(amount: number): string
// 示例: 10000 → "1.00万", 100000000 → "1.00亿"

// 完整格式化
formatFullCurrency(amount: number): string
// 示例: 1234567.89 → "1,234,567.89"
```

## 5. 类型定义

**文件路径**: `src/types/index.ts`

```typescript
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
```

## 6. 运行命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 指定平台运行
npm run ios      # iOS 模拟器
npm run android  # Android 模拟器
npm run web      # Web 浏览器

# 类型检查
npx tsc --noEmit

# 清除缓存
rm -rf .expo node_modules/.cache
```

## 7. 开发进度

| 阶段 | 功能 | 状态 |
|------|------|------|
| 第一阶段 | 静态 UI 页面 | ✅ 已完成 |
| 第二阶段 | 数据持久化 | 待开发 |
| 第三阶段 | 账户管理 (增删改) | 待开发 |
| 第四阶段 | 数据同步 | 待开发 |
| 第五阶段 | 图表交互、数据导出 | 待开发 |

## 8. 注意事项

### 8.1 样式方案

当前使用 React Native StyleSheet，如需使用 NativeWind 需要额外配置:

```bash
npm install nativewind tailwindcss
```

### 8.2 数据源

当前使用 mock 数据 (`src/data/mockData.ts`)，后续需对接真实数据存储方案:

- 本地存储: AsyncStorage / SQLite
- 云端同步: Firebase / Supabase / 自建后端

### 8.3 导航

当前使用简单的 Tab 切换，后续可集成 React Navigation 实现更复杂的导航:

```typescript
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();
```

## 9. 扩展开发指南

### 9.1 添加新账户

修改 `src/data/mockData.ts`:

```typescript
export const accounts: Account[] = [
  // ...existing accounts
  { 
    id: '13', 
    name: '新账户', 
    balance: 10000, 
    type: 'asset', 
    category: 'liquid', 
    icon: '💰' 
  },
];
```

### 9.2 添加新页面

1. 创建页面组件 `src/screens/NewScreen.tsx`
2. 在 `src/screens/index.ts` 导出
3. 在 `src/App.tsx` 添加 Tab 或导航

### 9.3 修改主题颜色

编辑 `src/styles/theme.ts`:

```typescript
export const colors = {
  primary: '#1A1F36',    // 修改主色
  secondary: '#6B7280',
  // ...
};
```
