import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type DbAccountType = '银行卡' | '支付宝' | '微信' | '公积金' | '股票' | '期权' | '现金' | '保险' | '基金' | '其他';
type DbAssetQuadrant = 'A类保值' | 'B类消费' | 'C类投资' | 'D类保障';

interface AssetAccount {
  id: number;
  account_name: string;
  account_type: DbAccountType;
  institution: string | null;
  asset_quadrant: DbAssetQuadrant | null;
  description: string | null;
  status: 0 | 1;
  created_at: string;
}

// ─── Static maps ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { emoji: string; bgColor: string }> = {
  银行卡: { emoji: '💳', bgColor: '#EEF2FF' },
  支付宝: { emoji: '💰', bgColor: '#EFF6FF' },
  微信:   { emoji: '💬', bgColor: '#F0FDF4' },
  公积金: { emoji: '🏠', bgColor: '#F5F3FF' },
  股票:   { emoji: '📈', bgColor: '#FFF7ED' },
  期权:   { emoji: '📊', bgColor: '#FFF7ED' },
  现金:   { emoji: '💵', bgColor: '#FFFBEB' },
  保险:   { emoji: '🛡️', bgColor: '#F0FDFA' },
  基金:   { emoji: '📉', bgColor: '#F5F3FF' },
  其他:   { emoji: '📁', bgColor: '#F9FAFB' },
};

const QUADRANT_META: Record<string, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
  A类保值: { label: 'A类保值', textColor: '#7C3AED', bgColor: '#EDE9FE', borderColor: '#C4B5FD' },
  B类消费: { label: 'B类消费', textColor: '#EA580C', bgColor: '#FFEDD5', borderColor: '#FDBA74' },
  C类投资: { label: 'C类投资', textColor: '#D97706', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
  D类保障: { label: 'D类保障', textColor: '#0D9488', bgColor: '#CCFBF1', borderColor: '#5EEAD4' },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface SwipeRowProps {
  children: React.ReactNode;
  onInvalidate: () => void;
  invalidating: boolean;
}

const ACTION_WIDTH = 88;

function SwipeRow({ children, onInvalidate, invalidating }: SwipeRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openedRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        const isHorizontal = Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        return isHorizontal;
      },
      onPanResponderMove: (_evt, gesture) => {
        const nextX = Math.max(-ACTION_WIDTH, Math.min(0, gesture.dx));
        translateX.setValue(nextX);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const shouldOpen = gesture.dx < -40 || (gesture.vx < -0.5 && gesture.dx < -10);
        openedRef.current = shouldOpen;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: openedRef.current ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  const handleInvalidate = () => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      openedRef.current = false;
      onInvalidate();
    });
  };

  return (
    <View>
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: ACTION_WIDTH,
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity
          onPress={handleInvalidate}
          disabled={invalidating}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EF4444',
            opacity: invalidating ? 0.7 : 1,
          }}
        >
          {invalidating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>作废</Text>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssetAccountListModal({ visible, onClose }: Props) {
  const { user } = useAuthStore();

  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [invalidatingId, setInvalidatingId] = useState<number | null>(null);

  async function fetchAccounts() {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('asset_accounts')
      .select(`
        id,
        account_name,
        account_type,
        institution,
        asset_quadrant,
        description,
        status,
        created_at,
        family_members!inner(user_id)
      `)
      .eq('family_members.user_id', user.id)
      .eq('status', 1)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setAccounts(data as unknown as AssetAccount[]);
    }

    setLoading(false);
  }

  function handleInvalidateAccount(id: number) {
    Alert.alert('作废资产账户', '确认将该资产账户标记为作废吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '作废',
        style: 'destructive',
        onPress: async () => {
          setInvalidatingId(id);
          const { error } = await supabase
            .from('asset_accounts')
            .update({ status: 0 })
            .eq('id', id);

          if (error) {
            Alert.alert('操作失败', error.message);
          } else {
            setAccounts((prev) => prev.filter((item) => item.id !== id));
          }
          setInvalidatingId(null);
        },
      },
    ]);
  }

  useEffect(() => {
    if (!visible || !user) return;
    fetchAccounts();
  }, [visible, user?.id]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#F5F3FF' }}>
        {/* ── Header ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: Platform.OS === 'ios' ? 20 : 16,
            paddingBottom: 16,
            backgroundColor: '#F5F3FF',
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: Colors.text.secondary }}>‹</Text>
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 17,
              fontWeight: '600',
              color: Colors.text.primary,
              marginRight: 32,
            }}
          >
            我的资产账户
          </Text>
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : accounts.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏦</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 6 }}>
              暂无资产账户
            </Text>
            <Text style={{ fontSize: 13, color: Colors.text.secondary, textAlign: 'center' }}>
              请先在"添加资产账户"中创建账户
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
          >
            {accounts.map((account) => {
              const typeMeta = TYPE_META[account.account_type] ?? TYPE_META['其他'];
              const quadrantMeta = account.asset_quadrant ? QUADRANT_META[account.asset_quadrant] : null;

              return (
                <SwipeRow
                  key={account.id}
                  onInvalidate={() => handleInvalidateAccount(account.id)}
                  invalidating={invalidatingId === account.id}
                >
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.88)',
                      borderRadius: 20,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: Colors.shadow,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 1,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    {/* Icon */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: typeMeta.bgColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{typeMeta.emoji}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: Colors.text.primary,
                          marginBottom: 2,
                        }}
                        numberOfLines={1}
                      >
                        {account.account_name}
                      </Text>
                      {account.institution ? (
                        <Text
                          style={{ fontSize: 12, color: Colors.text.secondary, marginBottom: 4 }}
                          numberOfLines={1}
                        >
                          {account.institution}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {/* Account type tag */}
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 20,
                            backgroundColor: typeMeta.bgColor,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: Colors.text.secondary }}>
                            {account.account_type}
                          </Text>
                        </View>
                        {/* Quadrant tag */}
                        {quadrantMeta ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 20,
                              backgroundColor: quadrantMeta.bgColor,
                              borderWidth: 1,
                              borderColor: quadrantMeta.borderColor,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '600', color: quadrantMeta.textColor }}>
                              {quadrantMeta.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Arrow */}
                    <Text style={{ fontSize: 18, color: '#C4B5FD', marginLeft: 8 }}>›</Text>
                  </View>
                </SwipeRow>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
