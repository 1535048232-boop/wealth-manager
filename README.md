# 家庭资产看板

一款极简主义风格的 Fintech 应用，帮助用户清晰掌握家庭财务状况。

## 快速启动

### 环境要求

- Node.js 18+
- npm 或 yarn
- Expo CLI

### 安装依赖

```bash
npm install
```

### 启动项目

```bash
npm start
```

启动后可选择运行平台：

- 按 `w` - Web 浏览器
- 按 `i` - iOS 模拟器
- 按 `a` - Android 模拟器

### 其他命令

```bash
npm run ios      # 直接启动 iOS
npm run android  # 直接启动 Android
npm run web      # 直接启动 Web
```

## 项目结构

```
trae-wealth-manager/
├── App.tsx                 # 应用入口
├── docs/
│   ├── PRODUCT.md          # 产品文档
│   └── DEVELOPMENT.md      # 开发文档
└── src/
    ├── App.tsx             # 主应用组件
    ├── styles/theme.ts     # 主题配置
    ├── types/index.ts      # 类型定义
    ├── data/mockData.ts    # 模拟数据
    ├── utils/format.ts     # 工具函数
    ├── components/         # UI 组件
    │   ├── NetWorthCard.tsx
    │   ├── AssetChart.tsx
    │   └── AssetCategoryCard.tsx
    └── screens/            # 页面
        ├── DashboardScreen.tsx
        └── ReconcileScreen.tsx
```

## 功能特性

- **首页总览**: 净资产展示、资产分布饼图、分类明细
- **一键对账**: 快速核对各账户余额

## 技术栈

- React Native + Expo
- TypeScript
- React Native SVG

## 文档

- [产品文档](./docs/PRODUCT.md)
- [开发文档](./docs/DEVELOPMENT.md)

## 开发进度

- [x] 第一阶段: 静态 UI 页面
- [ ] 第二阶段: 数据持久化
- [ ] 第三阶段: 账户管理
- [ ] 第四阶段: 数据同步
