import React, { useState } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAssets } from '../context/AssetContext';
import { TrendChart } from '../components/TrendChart';
import { AssetCategory } from '../types';
import { colors } from '../styles/theme';
import { formatCurrency } from '../utils/format';

const categoryConfig: Record<AssetCategory, { label: string; color: string }> = {
  liquid: { label: '流动资产', color: '#4ADE80' },
  investment: { label: '投资资产', color: '#60A5FA' },
  fixed: { label: '固定资产', color: '#A78BFA' },
  liability: { label: '负债', color: '#F87171' },
};

type TrendType = 'netWorth' | 'assets' | 'liabilities' | 'category';

export const StatisticsScreen: React.FC = () => {
  const { getTrendData, getNetWorthSummary } = useAssets();
  const [selectedTrend, setSelectedTrend] = useState<TrendType>('netWorth');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('liquid');

  const trendData = getTrendData();
  const summary = getNetWorthSummary();

  const getCurrentData = () => {
    switch (selectedTrend) {
      case 'netWorth':
        return trendData.netWorthTrend;
      case 'assets':
        return trendData.assetsTrend;
      case 'liabilities':
        return trendData.liabilitiesTrend;
      case 'category':
        return trendData.categoryTrends[selectedCategory] || [];
      default:
        return [];
    }
  };

  const getCurrentColor = () => {
    switch (selectedTrend) {
      case 'netWorth':
        return colors.primary;
      case 'assets':
        return colors.success;
      case 'liabilities':
        return colors.danger;
      case 'category':
        return categoryConfig[selectedCategory].color;
      default:
        return colors.primary;
    }
  };

  const getCurrentTitle = () => {
    switch (selectedTrend) {
      case 'netWorth':
        return '净资产趋势';
      case 'assets':
        return '总资产趋势';
      case 'liabilities':
        return '总负债趋势';
      case 'category':
        return `${categoryConfig[selectedCategory].label}趋势`;
      default:
        return '';
    }
  };

  const formatLastUpdated = () => {
    const date = new Date(summary.lastUpdated);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>家庭资产看板</Text>
          <Text style={styles.headerTitle}>统计分析</Text>
          <Text style={styles.lastUpdated}>
            最后更新: {formatLastUpdated()}
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>净资产</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  ¥{formatCurrency(summary.netWorth)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>总资产</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  ¥{formatCurrency(summary.totalAssets)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>总负债</Text>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  ¥{formatCurrency(summary.totalLiabilities)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>趋势选择</Text>
            <View style={styles.trendTabs}>
              <Pressable
                style={[styles.trendTab, selectedTrend === 'netWorth' && styles.trendTabActive]}
                onPress={() => setSelectedTrend('netWorth')}
              >
                <Text style={[styles.trendTabText, selectedTrend === 'netWorth' && styles.trendTabTextActive]}>
                  净资产
                </Text>
              </Pressable>
              <Pressable
                style={[styles.trendTab, selectedTrend === 'assets' && styles.trendTabActive]}
                onPress={() => setSelectedTrend('assets')}
              >
                <Text style={[styles.trendTabText, selectedTrend === 'assets' && styles.trendTabTextActive]}>
                  总资产
                </Text>
              </Pressable>
              <Pressable
                style={[styles.trendTab, selectedTrend === 'liabilities' && styles.trendTabActive]}
                onPress={() => setSelectedTrend('liabilities')}
              >
                <Text style={[styles.trendTabText, selectedTrend === 'liabilities' && styles.trendTabTextActive]}>
                  总负债
                </Text>
              </Pressable>
            </View>

            <View style={styles.trendChart}>
              <TrendChart
                data={getCurrentData()}
                title={getCurrentTitle()}
                color={getCurrentColor()}
                width={340}
                height={180}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>分类趋势</Text>
            <View style={styles.categoryGrid}>
              {(Object.keys(categoryConfig) as AssetCategory[]).map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryCard,
                    selectedTrend === 'category' && selectedCategory === cat && styles.categoryCardActive,
                  ]}
                  onPress={() => {
                    setSelectedTrend('category');
                    setSelectedCategory(cat);
                  }}
                >
                  <View style={[styles.categoryDot, { backgroundColor: categoryConfig[cat].color }]} />
                  <Text style={styles.categoryLabel}>{categoryConfig[cat].label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>月度数据</Text>
            <View style={styles.monthlyList}>
              {trendData.months.slice(-6).reverse().map((month, index) => (
                <View key={index} style={styles.monthlyItem}>
                  <Text style={styles.monthlyMonth}>{month.month}</Text>
                  <View style={styles.monthlyValues}>
                    <View style={styles.monthlyValueItem}>
                      <Text style={styles.monthlyValueLabel}>净资产</Text>
                      <Text style={[styles.monthlyValueNum, { color: colors.primary }]}>
                        ¥{formatCurrency(month.netWorth)}
                      </Text>
                    </View>
                    <View style={styles.monthlyValueItem}>
                      <Text style={styles.monthlyValueLabel}>总资产</Text>
                      <Text style={[styles.monthlyValueNum, { color: colors.success }]}>
                        ¥{formatCurrency(month.totalAssets)}
                      </Text>
                    </View>
                    <View style={styles.monthlyValueItem}>
                      <Text style={styles.monthlyValueLabel}>总负债</Text>
                      <Text style={[styles.monthlyValueNum, { color: colors.danger }]}>
                        ¥{formatCurrency(month.totalLiabilities)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
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
  lastUpdated: {
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    color: colors.secondary,
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  trendTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
  },
  trendTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  trendTabActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  trendTabText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  trendTabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  trendChart: {
    marginTop: 16,
    alignItems: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  categoryCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardActive: {
    borderColor: colors.primary,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  monthlyList: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  monthlyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthlyMonth: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  monthlyValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthlyValueItem: {
    alignItems: 'center',
  },
  monthlyValueLabel: {
    color: colors.secondary,
    fontSize: 11,
  },
  monthlyValueNum: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
