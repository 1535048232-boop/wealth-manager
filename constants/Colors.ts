// Named export for new code — 家庭资产管理 Design System
export const Colors = {
  // 主色系（低饱和柔和淡紫）
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryBg: '#F5F3FF',
  primaryMid: '#EDE9FE',

  // 功能色
  success: '#6EE7B7',   // 柔和薄荷绿 - 增长/正向
  successBg: '#ECFDF5',
  danger: '#FCA5A5',    // 淡珊瑚红 - 下跌/预警/待还
  dangerBg: '#FFF1F2',
  warning: '#FCD34D',   // 鹅黄 - 提醒
  warningBg: '#FFFBEB',

  // 分类辅助色（低饱和高明度）
  orange: '#FDBA74',    // 柔橙
  cyan: '#67E8F9',      // 淡青
  pink: '#F9A8D4',      // 浅粉

  // 基础层
  background: '#F8F7FF',  // 极浅淡紫灰/奶白
  surface: '#FFFFFF',     // 卡片纯白
  surfaceBlur: 'rgba(255,255,255,0.75)', // 毛玻璃半透

  // 文字层级
  text: {
    primary: '#1C1B2E',   // 深灰近黑
    secondary: '#6B7280', // 次要信息
    tertiary: '#9CA3AF',  // 辅助/占位
    inverse: '#FFFFFF',
    purple: '#7C3AED',    // 品牌色文字
  },

  // 边框/分割
  border: '#EDE9FE',
  borderLight: '#F3F4F6',

  // 投影（柔和）
  shadow: 'rgba(124,58,237,0.08)',
} as const;

// Legacy default export for template compatibility
const tintColorLight = '#7C3AED';
const tintColorDark = '#A78BFA';

export default {
  light: {
    text: '#1C1B2E',
    background: '#F8F7FF',
    tint: tintColorLight,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F5F3FF',
    background: '#0F0E1A',
    tint: tintColorDark,
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
  },
};
