import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';

export interface MemberSummary {
  memberId: number;
  displayName: string | null;
  avatarUrl: string | null;
  totalAmount: number;
  percent: number;
}

export interface AssetSegmentData {
  label: string;
  percent: number;
  color: string;
}

export interface HomeData {
  totalAssets: number;
  monthGrowth: number;
  disposableAmount: number;
  disposablePercent: number;
  members: MemberSummary[];
  segments: AssetSegmentData[];
}

// Colors assigned to each account_type
const TYPE_COLORS: Record<string, string> = {
  '银行卡':  '#A78BFA',
  '支付宝':  '#A78BFA',
  '微信':    '#C4B5FD',
  '公积金':  '#6EE7B7',
  '股票':    '#FDBA74',
  '期权':    '#FCA5A5',
  '现金':    '#FCD34D',
  '保险':    '#F9A8D4',
  '基金':    '#67E8F9',
  '其他':    '#D1D5DB',
};

// Types that are generally locked / non-disposable
const LOCKED_TYPES = new Set(['公积金', '期权']);

export function useHomeData() {
  const profileVersion = useAppStore((state) => state.profileVersion);
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date();
      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      // Fetch snapshots starting from the previous month so we have start-of-month baseline
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        .toISOString()
        .split('T')[0];

      // Parallel: family members, asset accounts, recent snapshots
      const [membersRes, accountsRes, snapshotsRes] = await Promise.all([
        supabase
          .from('family_members')
          .select('id, user_id')
          .eq('status', 1),
        supabase
          .from('asset_accounts')
          .select('id, member_id, account_type, asset_quadrant')
          .eq('status', 1),
        supabase
          .from('asset_daily_snapshots')
          .select('account_id, snapshot_date, amount')
          .gte('snapshot_date', prevMonthStart)
          .order('snapshot_date', { ascending: false }),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (snapshotsRes.error) throw snapshotsRes.error;

      const familyMembers = membersRes.data ?? [];
      const accounts = accountsRes.data ?? [];
      const snapshots = snapshotsRes.data ?? [];

      // Fetch profiles for members that have a user_id
      const userIds = familyMembers
        .map((m) => m.user_id)
        .filter((id): id is string => Boolean(id));

      const profilesRes =
        userIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .in('id', userIds)
          : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[], error: null };

      if (profilesRes.error) throw profilesRes.error;

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, p])
      );

      // Build latest amount per account (snapshots already sorted DESC by date)
      const latestByAccount = new Map<number, number>();
      const startOfMonthByAccount = new Map<number, number>();

      for (const snap of snapshots) {
        const aid = snap.account_id;
        if (!latestByAccount.has(aid)) {
          latestByAccount.set(aid, Number(snap.amount));
        }
      }

      // For start-of-month baseline: iterate ascending, keep last value <= firstOfMonth
      for (const snap of [...snapshots].reverse()) {
        if (snap.snapshot_date <= firstOfMonth) {
          startOfMonthByAccount.set(snap.account_id, Number(snap.amount));
        }
      }

      // Aggregate totals
      let totalAssets = 0;
      let lockedAmount = 0;
      const typeAmounts = new Map<string, number>();
      const memberAmounts = new Map<number, number>();

      for (const acc of accounts) {
        const amount = latestByAccount.get(acc.id) ?? 0;
        totalAssets += amount;

        // Locked = 公积金 / 期权 type OR D类保障 quadrant
        if (LOCKED_TYPES.has(acc.account_type) || acc.asset_quadrant === 'D类保障') {
          lockedAmount += amount;
        }

        typeAmounts.set(
          acc.account_type,
          (typeAmounts.get(acc.account_type) ?? 0) + amount
        );
        memberAmounts.set(
          acc.member_id,
          (memberAmounts.get(acc.member_id) ?? 0) + amount
        );
      }

      // Monthly growth
      let startTotal = 0;
      for (const amount of startOfMonthByAccount.values()) {
        startTotal += amount;
      }
      const monthGrowth = totalAssets - startTotal;

      // Disposable
      const disposableAmount = totalAssets - lockedAmount;
      const disposablePercent =
        totalAssets > 0 ? Math.round((disposableAmount / totalAssets) * 100) : 0;

      // Asset type segments (only non-zero, sorted by amount desc)
      const segments: AssetSegmentData[] = [];
      for (const [type, amount] of typeAmounts) {
        if (amount <= 0) continue;
        segments.push({
          label: type,
          percent:
            totalAssets > 0
              ? parseFloat(((amount / totalAssets) * 100).toFixed(1))
              : 0,
          color: TYPE_COLORS[type] ?? '#D1D5DB',
        });
      }
      segments.sort((a, b) => b.percent - a.percent);

      // Member summaries
      const members: MemberSummary[] = familyMembers
        .map((fm) => {
          const amount = memberAmounts.get(fm.id) ?? 0;
          const profile = fm.user_id ? profileMap.get(fm.user_id) : undefined;
          return {
            memberId: fm.id,
            displayName: profile?.display_name ?? null,
            avatarUrl: profile?.avatar_url ?? null,
            totalAmount: amount,
            percent:
              totalAssets > 0
                ? parseFloat(((amount / totalAssets) * 100).toFixed(1))
                : 0,
          };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount);

      setData({
        totalAssets,
        monthGrowth,
        disposableAmount,
        disposablePercent,
        members,
        segments,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [profileVersion]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
