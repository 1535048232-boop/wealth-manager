# 家庭资产管理 APP — 设计规范

## 1. 配色系统

### 主色系（低饱和柔和淡紫）
| Token | Hex | 用途 |
|-------|-----|------|
| `primary` | `#7C3AED` | 主按钮、高亮、品牌色 |
| `primary-light` | `#A78BFA` | 次级强调、图标 |
| `primary-bg` | `#F5F3FF` | 页面背景、浅色区块 |
| `primary-mid` | `#EDE9FE` | 卡片内背景、分割 |

### 功能辅助色
| Token | Hex | 用途 |
|-------|-----|------|
| `success` | `#6EE7B7` | 增长、正向、盈利 |
| `success-bg` | `#ECFDF5` | 正向背景标签 |
| `danger` | `#FCA5A5` | 下跌、预警、待还款 |
| `danger-bg` | `#FFF1F2` | 负向背景标签 |
| `soft-orange` | `#FDBA74` | 分类色（消费/支出） |
| `soft-cyan` | `#67E8F9` | 分类色（储蓄/存款） |
| `soft-pink` | `#F9A8D4` | 分类色（保险/理财） |
| `soft-yellow` | `#FCD34D` | 提醒/待办 |

### 基础层
| Token | Hex | 用途 |
|-------|-----|------|
| `app-bg` | `#F8F7FF` | 页面底层背景 |
| `app-surface` | `#FFFFFF` | 卡片、弹窗 |
| `app-border` | `#EDE9FE` | 分割线、边框 |

### 文字层级
| Token | Hex | 用途 |
|-------|-----|------|
| `ink` | `#1C1B2E` | 主要文字（标题、金额） |
| `ink-secondary` | `#6B7280` | 次要信息（标签、说明） |
| `ink-tertiary` | `#9CA3AF` | 辅助/占位文字 |
| `ink-purple` | `#7C3AED` | 品牌色文字、链接 |

---

## 2. 设计风格

### 整体定位
iOS 端极简友好型金融设计，去传统金融产品的严肃冰冷感，偏向家庭使用的温暖易读风格。

### 圆角规范
| 场景 | 圆角值 | Tailwind class |
|------|--------|----------------|
| 大卡片、底部弹窗 | 24px | `rounded-3xl` |
| 普通卡片、输入框 | 16px | `rounded-2xl` |
| 按钮、标签 | 12px | `rounded-xl` |
| 小徽章、图标背景 | 8px | `rounded-lg` |

### 投影规范
```
// 卡片标准投影（柔和紫调）
shadow: 0 4px 24px rgba(124,58,237,0.08)

// NativeWind 使用
className="shadow-sm"  // 配合 shadow color token
```

### 毛玻璃效果
悬浮组件（顶部导航、底部 Tab、浮动卡片）使用半透明背景：
```
backgroundColor: 'rgba(255,255,255,0.75)'
// + backdrop blur（通过 expo-blur 实现）
```

---

## 3. 排版规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| 核心数据 | 32-40px | Bold 700 | 总资产金额 |
| 页面标题 | 22-24px | SemiBold 600 | 页面 H1 |
| 卡片标题 | 16-18px | SemiBold 600 | 模块标题 |
| 正文 | 14-15px | Regular 400 | 列表项、说明 |
| 辅助信息 | 12px | Regular 400 | 时间、标签 |

---

## 4. 组件规范

### 资产卡片
- 背景：白色 + 柔和紫调投影
- 圆角：`rounded-3xl`（24px）
- 内边距：`p-5`（20px）
- 金额：`text-3xl font-bold text-ink`

### 进度条 / 环形图
- 圆角端点（`strokeLinecap: 'round'`）
- 渐变填充：`primary-bg → primary`
- 无生硬折线，使用平滑曲线

### 按钮
- 主按钮：`bg-primary rounded-xl py-3.5`，白色文字
- 次级按钮：`bg-primary-mid rounded-xl py-3.5`，紫色文字
- 禁用态：`opacity-40`

### 标签/徽章
- 正向：`bg-success-bg text-success rounded-lg px-2 py-0.5`
- 负向：`bg-danger-bg text-danger rounded-lg px-2 py-0.5`

---

## 5. NativeWind 使用示例

```tsx
// 资产总览卡片
<View className="bg-white rounded-3xl p-5 shadow-sm mx-4">
  <Text className="text-ink-secondary text-sm">总资产</Text>
  <Text className="text-ink text-4xl font-bold mt-1">¥128,000</Text>
  <Text className="text-success text-sm mt-1">↑ 2.4% 本月</Text>
</View>

// 主按钮
<TouchableOpacity className="bg-primary rounded-xl py-3.5 items-center">
  <Text className="text-white font-semibold text-base">添加资产</Text>
</TouchableOpacity>

// 正向标签
<View className="bg-success-bg rounded-lg px-2 py-0.5">
  <Text className="text-success text-xs font-medium">+12.3%</Text>
</View>
```
