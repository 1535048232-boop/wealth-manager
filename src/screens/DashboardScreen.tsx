import React, { useState } from 'react';
import { View, ScrollView, Text, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetWorthCard, AssetChart, AssetCategoryCard } from '../components';
import { AssetCategory } from '../types';
import { colors } from '../styles/theme';
import { useAssets } from '../context/AssetContext';

export const DashboardScreen: React.FC = () => {
  const [expandedCategory, setExpandedCategory] = useState<AssetCategory | null>(null);
  const { getCategorySummaries, getNetWorthSummary } = useAssets();
  
  const categories = getCategorySummaries();
  const netWorthSummary = getNetWorthSummary();

  const handleToggleCategory = (category: AssetCategory) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSubtitle}>家庭资产看板</Text>
              <Text style={styles.headerTitle}>资产总览</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
          </View>

          <NetWorthCard summary={netWorthSummary} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>资产分布</Text>
            <View style={styles.chartCard}>
              <AssetChart categories={categories} size={220} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>分类明细</Text>
            {categories.map((category) => (
              <AssetCategoryCard
                key={category.category}
                category={category}
                isExpanded={expandedCategory === category.category}
                onToggle={() => handleToggleCategory(category.category)}
              />
            ))}
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
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 31, 54, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});
