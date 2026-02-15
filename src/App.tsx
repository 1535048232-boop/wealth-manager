import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { DashboardScreen, ReconcileScreen, StatisticsScreen } from './screens';
import { colors } from './styles/theme';
import { AssetProvider } from './context/AssetContext';

type TabType = 'dashboard' | 'statistics' | 'reconcile';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabType>('dashboard');

  return (
    <View style={styles.container}>
      {activeTab === 'dashboard' && <DashboardScreen />}
      {activeTab === 'statistics' && <StatisticsScreen />}
      {activeTab === 'reconcile' && <ReconcileScreen />}
      
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('dashboard')}
          style={styles.tabItem}
        >
          <Text style={[styles.tabIcon, activeTab !== 'dashboard' && styles.tabIconInactive]}>
            📊
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>
            总览
          </Text>
        </Pressable>
        
        <Pressable
          onPress={() => setActiveTab('statistics')}
          style={styles.tabItem}
        >
          <Text style={[styles.tabIcon, activeTab !== 'statistics' && styles.tabIconInactive]}>
            📈
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'statistics' && styles.tabLabelActive]}>
            统计
          </Text>
        </Pressable>
        
        <Pressable
          onPress={() => setActiveTab('reconcile')}
          style={styles.tabItem}
        >
          <Text style={[styles.tabIcon, activeTab !== 'reconcile' && styles.tabIconInactive]}>
            ✅
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'reconcile' && styles.tabLabelActive]}>
            对账
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export const App: React.FC = () => {
  return (
    <AssetProvider>
      <AppContent />
    </AssetProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  tabIcon: {
    fontSize: 24,
    opacity: 1,
  },
  tabIconInactive: {
    opacity: 0.4,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
    color: colors.secondary,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
