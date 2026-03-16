import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
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

// ─── SwipeRow ─────────────────────────────────────────────────────────────────
// Card + action button move together via translateX.
// actionWidth (non-native driver) clips the button from 0 → ACTION_WIDTH so
// it is invisible until the user actually swipes left.

function SwipeRow({ children, onInvalidate, invalidating }: SwipeRowProps) {
  const translateX  = useRef(new Animated.Value(0)).current;
  const actionWidth = useRef(new Animated.Value(0)).current;
  const openedRef   = useRef(false);

  function animateTo(open: boolean) {
    openedRef.current = open;
    Animated.spring(translateX, {
      toValue: open ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
    Animated.spring(actionWidth, {
      toValue: open ? ACTION_WIDTH : 0,
      useNativeDriver: false,
      bounciness: 0,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_evt, gesture) => {
        const dx = Math.max(-ACTION_WIDTH, Math.min(0, gesture.dx));
        translateX.setValue(dx);
        actionWidth.setValue(-dx);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const shouldOpen = gesture.dx < -40 || (gesture.vx < -0.5 && gesture.dx < -10);
        animateTo(shouldOpen);
      },
      onPanResponderTerminate: () => {
        animateTo(openedRef.current);
      },
    })
  ).current;

  const handleInvalidate = () => {
    openedRef.current = false;
    onInvalidate();
    Animated.timing(translateX,  { toValue: 0, duration: 120, useNativeDriver: true  }).start();
    Animated.timing(actionWidth, { toValue: 0, duration: 120, useNativeDriver: false }).start();
  };

  return (
    <View style={{ overflow: 'hidden', borderRadius: 20 }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ flexDirection: 'row', transform: [{ translateX }] }}
      >
        {/* Card content */}
        <View style={{ flex: 1 }}>
          {children}
        </View>

        {/* Action button — clipped to 0 width until swipe */}
        <Animated.View style={{ width: actionWidth, overflow: 'hidden' }}>
          <TouchableOpacity
            onPress={handleInvalidate}
            disabled={invalidating}
            style={{
              width: ACTION_WIDTH,
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
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssetAccountListModal({ visible, onClose }: Props) {
  const { user } = useAuthStore();

  const [accounts, setAccounts]         = useState<AssetAccount[]>([]);
  const [loading, setLoading]           = useState(false);
  const [invalidatingId, setInvalidatingId] = useState<number | null>(null);
  const [confirmId, setConfirmId]       = useState<number | null>(null);

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
      const activeAccounts = (data as unknown as AssetAccount[]).filter((item) => item.status === 1);
      setAccounts(activeAccounts);
    }

    setLoading(false);
  }

  function handleInvalidateAccount(id: number) {
    setConfirmId(id);
  }

  async function confirmInvalidate() {
    if (confirmId === null) return;
    const id = confirmId;
    setConfirmId(null);
    setInvalidatingId(id);

    const { error } = await supabase
      .from('asset_accounts')
      .update({ status: 0 })
      .eq('id', id)
      .eq('status', 1);

    if (!error) {
      setAccounts((prev) => prev.filter((item) => item.id !== id));
    }
    setInvalidatingId(null);
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
              const typeMeta     = TYPE_META[account.account_type] ?? TYPE_META['其他'];
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
                        style={{ fontSize: 15, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 }}
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
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: typeMeta.bgColor }}>
                          <Text style={{ fontSize: 11, color: Colors.text.secondary }}>{account.account_type}</Text>
                        </View>
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

        {/* ── Inline confirm dialog ── */}
        {confirmId !== null && (
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 24,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
                elevation: 12,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.text.primary, marginBottom: 8 }}>
                作废资产账户
              </Text>
              <Text style={{ fontSize: 14, color: Colors.text.secondary, marginBottom: 24, lineHeight: 20 }}>
                确认将该资产账户标记为作废吗？此操作不可撤销。
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setConfirmId(null)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: '#F3F4F6',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.text.primary }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmInvalidate}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: '#EF4444',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>作废</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
