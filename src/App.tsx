import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { DashboardScreen, ReconcileScreen } from './screens';
import { colors } from './styles/theme';

type TabType = 'dashboard' | 'reconcile';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabType>('dashboard');

  return (
    <View style={styles.container}>
      {activeTab === 'dashboard' && <DashboardScreen />}
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
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
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
