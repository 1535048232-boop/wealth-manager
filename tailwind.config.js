/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 主色系
        primary: {
          DEFAULT: '#7C3AED',
          light: '#A78BFA',
          bg: '#F5F3FF',
          mid: '#EDE9FE',
        },
        // 功能色
        success: {
          DEFAULT: '#6EE7B7',
          bg: '#ECFDF5',
        },
        danger: {
          DEFAULT: '#FCA5A5',
          bg: '#FFF1F2',
        },
        // 分类辅助色
        'soft-orange': '#FDBA74',
        'soft-cyan': '#67E8F9',
        'soft-pink': '#F9A8D4',
        'soft-yellow': '#FCD34D',
        // 基础层
        app: {
          bg: '#F8F7FF',
          surface: '#FFFFFF',
          border: '#EDE9FE',
        },
        // 文字
        ink: {
          DEFAULT: '#1C1B2E',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
          purple: '#7C3AED',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
