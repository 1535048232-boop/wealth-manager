import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type DbAccountType =
  | '银行卡' | '支付宝' | '微信' | '公积金' | '股票'
  | '期权'   | '现金'   | '保险' | '基金'   | '其他';

type DbAssetQuadrant = 'A类保值' | 'B类消费' | 'C类投资' | 'D类保障';

interface MemberInfo {
  id: number;
  display_name: string;
  avatar_url: string | null;
}

interface AccountItem {
  id: number;
  account_name: string;
  account_type: DbAccountType;
  institution: string | null;
  asset_quadrant: DbAssetQuadrant | null;
  member_id: number;
  member_name: string;
}

// ─── Static maps ─────────────────────────────────────────────────────────────

const FILTER_TYPES: (DbAccountType | '全部')[] = [
  '全部', '银行卡', '股票', '公积金', '期权', '基金', '支付宝', '微信', '现金', '保险', '其他',
];

const TYPE_ICON_COLOR: Record<string, string> = {
  银行卡: '#6D28D9',
  支付宝: '#3B82F6',
  微信:   '#22C55E',
  公积金: '#7C3AED',
  股票:   '#F97316',
  期权:   '#EAB308',
  现金:   '#84CC16',
  保险:   '#0EA5E9',
  基金:   '#8B5CF6',
  其他:   '#9CA3AF',
};

const QUADRANT_META: Record<DbAssetQuadrant, { short: string; color: string; bg: string; border: string }> = {
  A类保值: { short: 'A类', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
  B类消费: { short: 'B类', color: '#EA580C', bg: '#FFEDD5', border: '#FDBA74' },
  C类投资: { short: 'C类', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
  D类保障: { short: 'D类', color: '#0D9488', bg: '#CCFBF1', border: '#5EEAD4' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function EntryScreen() {
  const { user } = useAuthStore();
  const profileVersion = useAppStore((state) => state.profileVersion);

  const [accounts, setAccounts]               = useState<AccountItem[]>([]);
  const [members, setMembers]                 = useState<MemberInfo[]>([]);
  const [loading, setLoading]                 = useState(false);

  const [searchText, setSearchText]           = useState('');
  const [selectedType, setSelectedType]       = useState<DbAccountType | '全部'>('全部');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedQuadrant, setSelectedQuadrant] = useState<DbAssetQuadrant | null>(null);

  // ── Snapshot state ───────────────────────────────────────────────────────
  // Maps account_id → today's saved amount (string for display)
  const [snapshotMap, setSnapshotMap]         = useState<Record<number, string>>({});
  const [editingId, setEditingId]             = useState<number | null>(null);
  const [inputAmount, setInputAmount]         = useState('');
  const [saving, setSaving]                   = useState(false);
  const inputRef                              = useRef<TextInput>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

      const [accountsRes, snapshotsRes] = await Promise.all([
        supabase
          .from('asset_accounts')
          .select(`
            id,
            account_name,
            account_type,
            institution,
            asset_quadrant,
            member_id,
            family_members!inner(
              id,
              profiles!profile_id(display_name, avatar_url)
            )
          `)
          .eq('status', 1)
          .order('created_at', { ascending: false }),
        supabase
          .from('asset_daily_snapshots')
          .select('account_id, amount')
          .eq('snapshot_date', today),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (snapshotsRes.error) throw snapshotsRes.error;

      // Build snapshot map: account_id → formatted amount string
      const newSnapshotMap: Record<number, string> = {};
      for (const row of snapshotsRes.data ?? []) {
        newSnapshotMap[row.account_id] = String(row.amount);
      }
      setSnapshotMap(newSnapshotMap);

      const memberMap = new Map<number, MemberInfo>();
      const items: AccountItem[] = (accountsRes.data ?? []).map((row: any) => {
        const fm      = Array.isArray(row.family_members) ? row.family_members[0] : row.family_members;
        const profile = fm?.profiles ? (Array.isArray(fm.profiles) ? fm.profiles[0] : fm.profiles) : null;
        const memberId   = row.member_id as number;
        const memberName = profile?.display_name ?? `成员${memberId}`;

        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            id:           memberId,
            display_name: memberName,
            avatar_url:   profile?.avatar_url ?? null,
          });
        }

        return {
          id:             row.id,
          account_name:   row.account_name,
          account_type:   row.account_type,
          institution:    row.institution,
          asset_quadrant: row.asset_quadrant,
          member_id:      memberId,
          member_name:    memberName,
        };
      });

      setAccounts(items);
      setMembers(Array.from(memberMap.values()));
    } catch (e) {
      console.error('[EntryScreen] fetchData error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profileVersion]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Snapshot save ─────────────────────────────────────────────────────────

  const openEdit = useCallback((account: AccountItem) => {
    const current = snapshotMap[account.id] ?? '';
    setEditingId(account.id);
    setInputAmount(current);
    // Focus after state flush
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [snapshotMap]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setInputAmount('');
  }, []);

  const saveSnapshot = useCallback(async (accountId: number) => {
    const trimmed = inputAmount.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    const numeric = parseFloat(trimmed);
    if (isNaN(numeric)) {
      Alert.alert('格式错误', '请输入有效的金额数字');
      return;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('asset_daily_snapshots')
        .upsert(
          { account_id: accountId, snapshot_date: today, amount: numeric },
          { onConflict: 'account_id,snapshot_date' },
        );
      if (error) throw error;

      setSnapshotMap(prev => ({ ...prev, [accountId]: String(numeric) }));
      setEditingId(null);
      setInputAmount('');
    } catch (e) {
      console.error('[EntryScreen] saveSnapshot error:', e);
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [inputAmount, cancelEdit]);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = accounts;

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        a =>
          a.account_name.toLowerCase().includes(q) ||
          (a.institution?.toLowerCase().includes(q) ?? false) ||
          a.member_name.toLowerCase().includes(q),
      );
    }

    if (selectedType !== '全部') {
      list = list.filter(a => a.account_type === selectedType);
    }

    if (selectedMemberId !== null) {
      list = list.filter(a => a.member_id === selectedMemberId);
    }

    if (selectedQuadrant !== null) {
      list = list.filter(a => a.asset_quadrant === selectedQuadrant);
    }

    return list;
  }, [accounts, searchText, selectedType, selectedMemberId, selectedQuadrant]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const iconChar = (account: AccountItem) => {
    const src = account.institution ?? account.account_name;
    return src.charAt(0).toUpperCase();
  };

  // ── Sub-renders ───────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View>
      {/* Member filter */}
      {members.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>成员筛选</Text>
          <View style={styles.pillRow}>
            {/* "全部" pill */}
            <FilterPill
              label="全部"
              active={selectedMemberId === null}
              onPress={() => setSelectedMemberId(null)}
            />
            {members.map(m => (
              <FilterPill
                key={m.id}
                label={m.display_name}
                active={selectedMemberId === m.id}
                onPress={() =>
                  setSelectedMemberId(prev => (prev === m.id ? null : m.id))
                }
              />
            ))}
          </View>
        </View>
      )}

      {/* Asset quadrant filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>资产分类</Text>
        <View style={styles.pillRow}>
          <FilterPill
            label="全部"
            active={selectedQuadrant === null}
            onPress={() => setSelectedQuadrant(null)}
          />
          {(Object.keys(QUADRANT_META) as DbAssetQuadrant[]).map(q => {
            const meta   = QUADRANT_META[q];
            const active = selectedQuadrant === q;
            return (
              <TouchableOpacity
                key={q}
                onPress={() => setSelectedQuadrant(prev => (prev === q ? null : q))}
                style={[
                  styles.pill,
                  active
                    ? { backgroundColor: meta.bg, borderColor: meta.border }
                    : { backgroundColor: '#fff', borderColor: Colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: active ? meta.color : Colors.text.secondary, fontWeight: active ? '600' : '400' },
                  ]}
                >
                  {q}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Loading or empty */}
      {loading && (
        <View style={styles.centeredMsg}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}
      {!loading && accounts.length === 0 && (
        <View style={styles.centeredMsg}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🏦</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 }}>
            暂无资产账户
          </Text>
          <Text style={{ fontSize: 13, color: Colors.text.secondary, textAlign: 'center' }}>
            在首页添加账户后，将在此处显示
          </Text>
        </View>
      )}
      {!loading && accounts.length > 0 && filtered.length === 0 && (
        <View style={styles.centeredMsg}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🔍</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.text.primary }}>
            暂无匹配项
          </Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () =>
    !loading && filtered.length > 0 ? (
      <Text style={styles.footerCount}>找到 {filtered.length} 项结果</Text>
    ) : null;

  const renderItem = ({ item }: { item: AccountItem }) => {
    const qMeta     = item.asset_quadrant ? QUADRANT_META[item.asset_quadrant] : null;
    const iconColor = TYPE_ICON_COLOR[item.account_type] ?? '#9CA3AF';
    const char      = iconChar(item);
    const isEditing = editingId === item.id;
    const savedAmt  = snapshotMap[item.id];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={isEditing ? 1 : 0.75}
        onPress={() => !isEditing && openEdit(item)}
      >
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '22' }]}>
          <Text style={[styles.iconChar, { color: iconColor }]}>{char}</Text>
        </View>

        {/* Text block */}
        <View style={{ flex: 1 }}>
          <View style={styles.cardRow}>
            <Text style={styles.accountName} numberOfLines={1}>
              {item.account_name}
            </Text>
            <Text style={styles.memberName}>{item.member_name}</Text>
          </View>

          {isEditing ? (
            /* ── Inline amount input ── */
            <View style={styles.inlineInputRow}>
              <Text style={styles.currencySymbol}>¥</Text>
              <TextInput
                ref={inputRef}
                value={inputAmount}
                onChangeText={setInputAmount}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={() => saveSnapshot(item.id)}
                placeholder="输入金额"
                placeholderTextColor={Colors.text.tertiary}
                style={styles.inlineInput}
                selectTextOnFocus
              />
              <TouchableOpacity
                onPress={() => saveSnapshot(item.id)}
                disabled={saving}
                style={styles.saveBtn}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>保存</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Balance display row ── */
            <View style={styles.cardRow}>
              <Text style={[styles.balancePlaceholder, savedAmt !== undefined && styles.balanceSaved]}>
                {savedAmt !== undefined ? `¥ ${Number(savedAmt).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '¥ — 点击录入'}
              </Text>
              {qMeta && (
                <View style={[styles.quadrantBadge, { backgroundColor: qMeta.bg, borderColor: qMeta.border }]}>
                  <Text style={[styles.quadrantBadgeText, { color: qMeta.color }]}>
                    {qMeta.short}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      {/* ── Page title ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>录入</Text>
        <Text style={styles.pageSubtitle}>点击账户录入今日金额</Text>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索账户、交易、资产..."
            placeholderTextColor={Colors.text.tertiary}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── Account type horizontal tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeTabsContent}
        style={styles.typeTabsRow}
      >
        {FILTER_TYPES.map(type => {
          const active = selectedType === type;
          return (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedType(type)}
              style={[
                styles.typeTab,
                active
                  ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                  : { backgroundColor: '#fff', borderColor: Colors.border },
              ]}
            >
              <Text
                style={[
                  styles.typeTabText,
                  { color: active ? '#fff' : Colors.text.secondary, fontWeight: active ? '600' : '400' },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Main list ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </ScreenWrapper>
  );
}

// ─── FilterPill helper ────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        active
          ? { backgroundColor: Colors.primaryMid, borderColor: Colors.primary }
          : { backgroundColor: '#fff', borderColor: Colors.border },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: active ? Colors.primary : Colors.text.secondary, fontWeight: active ? '600' : '400' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    padding: 0,
  },

  // Type filter tabs
  typeTabsRow: {
    flexGrow: 0,
    marginBottom: 4,
  },
  typeTabsContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  typeTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  typeTabText: {
    fontSize: 14,
  },

  // Filters
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 13,
  },

  // List
  listContent: {
    paddingBottom: 100,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconChar: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  accountName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginRight: 8,
  },
  memberName: {
    fontSize: 12,
    color: Colors.text.secondary,
    flexShrink: 0,
  },
  balancePlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  balanceSaved: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  quadrantBadge: {
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  quadrantBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Footer
  footerCount: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.text.tertiary,
    marginTop: 16,
    marginBottom: 8,
  },

  // Empty / loading
  centeredMsg: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },

  // Inline snapshot input
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  inlineInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    padding: 0,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelBtnText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
});
