import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { App } from './src/App';

export default function RootApp() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <App />
    </SafeAreaProvider>
  );
}
