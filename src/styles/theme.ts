import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#1A1F36',
  secondary: '#6B7280',
  background: '#FAFAFA',
  card: '#FFFFFF',
  success: '#4ADE80',
  danger: '#F87171',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  white: '#FFFFFF',
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  textPrimary: {
    color: colors.primary,
  },
  textSecondary: {
    color: colors.secondary,
  },
  textSuccess: {
    color: colors.success,
  },
  textDanger: {
    color: colors.danger,
  },
});
