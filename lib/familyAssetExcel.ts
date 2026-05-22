import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

interface FamilyMemberRow {
  id: number;
  user_id: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string;
}

interface AssetAccountRow {
  id: number;
  member_id: number;
  account_name: string;
  account_type: string;
  institution: string | null;
  asset_quadrant: string | null;
  status: 0 | 1;
}

interface SnapshotRow {
  account_id: number;
  snapshot_date: string;
  amount: number;
}

interface MonthlySummaryRow {
  月份: string;
  月末日期: string;
  家庭名称: string;
  币种: string;
  家庭总资产: number;
  账户数: number;
  成员数: number;
}

interface MemberMonthlySummaryRow {
  月份: string;
  月末日期: string;
  家庭名称: string;
  币种: string;
  成员ID: number;
  成员名称: string;
  用户ID: string;
  成员总资产: number;
  账户数: number;
}

interface MonthlyDetailRow {
  月份: string;
  月末日期: string;
  家庭名称: string;
  币种: string;
  成员ID: number;
  成员名称: string;
  用户ID: string;
  账户ID: number;
  账户名称: string;
  账户类型: string;
  所属机构: string;
  资产象限: string;
  金额: number;
}

type PivotDetailRow = {
  成员名称: string;
  成员ID: number;
  用户ID: string;
  账户名称: string;
  账户ID: number;
  账户类型: string;
  所属机构: string;
  资产象限: string;
} & Record<string, string | number>;

interface MemberAssetRecordRow {
  日期: string;
  家庭名称: string;
  成员ID: number;
  成员名称: string;
  用户ID: string;
  账户ID: number;
  账户名称: string;
  账户类型: string;
  所属机构: string;
  资产象限: string;
  金额: number;
}

interface ImportableDetailRow {
  月份?: string;
  月末日期?: string;
  成员ID?: number | string;
  成员名称?: string;
  用户ID?: string;
  账户ID?: number | string;
  账户名称?: string;
  账户类型?: string;
  所属机构?: string;
  资产象限?: string;
  金额?: number | string;
}

function getMonthLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthEndText(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function isIsoDateText(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeIsoDateText(value: string) {
  if (!isIsoDateText(value)) {
    return value;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12) {
    return value;
  }

  const lastDay = new Date(year, month, 0).getDate();
  const normalizedDay = Math.max(1, Math.min(day, lastDay));
  return `${yearText}-${monthText}-${String(normalizedDay).padStart(2, '0')}`;
}

function buildMonthSequence(startDateText: string, endDateText: string) {
  const startDate = new Date(`${startDateText}T00:00:00`);
  const endDate = new Date(`${endDateText}T00:00:00`);
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  const months: Array<{ label: string; monthEndText: string }> = [];

  while (cursor <= lastMonth) {
    months.push({
      label: getMonthLabel(cursor),
      monthEndText: getMonthEndText(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function getValueAtDate(snapshots: SnapshotRow[], dateText: string) {
  let lastAmount = 0;

  for (const snapshot of snapshots) {
    if (snapshot.snapshot_date <= dateText) {
      lastAmount = Number(snapshot.amount);
    } else {
      break;
    }
  }

  return lastAmount;
}

async function fetchFamilyExportScope(familyId: number) {
  const { data: memberData, error: memberError } = await supabase
    .from('family_members')
    .select('id, user_id')
    .eq('family_id', familyId)
    .eq('status', 1);

  if (memberError) throw memberError;

  const members = (memberData ?? []) as FamilyMemberRow[];
  const memberIds = members.map((member) => member.id);
  const userIds = members.map((member) => member.user_id).filter((value): value is string => Boolean(value));

  const [{ data: accountData, error: accountError }, { data: profileData, error: profileError }] = await Promise.all([
    memberIds.length
      ? supabase
        .from('asset_accounts')
        .select('id, member_id, account_name, account_type, institution, asset_quadrant, status')
        .in('member_id', memberIds)
        .eq('status', 1)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (accountError) throw accountError;
  if (profileError) throw profileError;

  const accounts = (accountData ?? []) as AssetAccountRow[];
  const accountIds = accounts.map((account) => account.id);

  const { data: snapshotData, error: snapshotError } = accountIds.length
    ? await supabase
      .from('asset_daily_snapshots')
      .select('account_id, snapshot_date, amount')
      .in('account_id', accountIds)
      .order('snapshot_date', { ascending: true })
    : { data: [], error: null };

  if (snapshotError) throw snapshotError;

  return {
    members,
    profiles: (profileData ?? []) as ProfileRow[],
    accounts,
    snapshots: ((snapshotData ?? []) as SnapshotRow[]).map((row) => ({
      ...row,
      amount: Number(row.amount),
    })),
  };
}

function buildWorkbookData({
  familyName,
  currency,
  members,
  profiles,
  accounts,
  snapshots,
}: {
  familyName: string;
  currency: string;
  members: FamilyMemberRow[];
  profiles: ProfileRow[];
  accounts: AssetAccountRow[];
  snapshots: SnapshotRow[];
}) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const snapshotsByAccount = new Map<number, SnapshotRow[]>();

  for (const snapshot of snapshots) {
    const current = snapshotsByAccount.get(snapshot.account_id) ?? [];
    current.push(snapshot);
    snapshotsByAccount.set(snapshot.account_id, current);
  }

  if (snapshots.length === 0) {
    return {
      summaryRows: [] as MonthlySummaryRow[],
      memberSummaryRows: [] as MemberMonthlySummaryRow[],
      detailRows: [] as MonthlyDetailRow[],
      memberRecordRows: [] as MemberAssetRecordRow[],
    };
  }

  const months = buildMonthSequence(snapshots[0].snapshot_date, snapshots[snapshots.length - 1].snapshot_date);
  const summaryRows: MonthlySummaryRow[] = [];
  const memberSummaryRows: MemberMonthlySummaryRow[] = [];
  const detailRows: MonthlyDetailRow[] = [];

  const getMemberDisplayName = (memberId: number) => {
    const member = memberMap.get(memberId);
    const profile = member?.user_id ? profileMap.get(member.user_id) : null;
    return profile?.display_name ?? profile?.email ?? `成员${memberId}`;
  };

  for (const month of months) {
    let totalAmount = 0;
    let activeAccountCount = 0;
    const memberTotals = new Map<number, { totalAmount: number; activeAccountCount: number }>();

    for (const account of accounts) {
      const accountSnapshots = snapshotsByAccount.get(account.id) ?? [];
      const firstSnapshotDate = accountSnapshots[0]?.snapshot_date;
      if (!firstSnapshotDate || firstSnapshotDate > month.monthEndText) {
        continue;
      }

      const member = memberMap.get(account.member_id);
      const profile = member?.user_id ? profileMap.get(member.user_id) : null;
      const amount = getValueAtDate(accountSnapshots, month.monthEndText);

      totalAmount += amount;
      activeAccountCount += 1;
      const currentMemberTotal = memberTotals.get(account.member_id) ?? {
        totalAmount: 0,
        activeAccountCount: 0,
      };
      currentMemberTotal.totalAmount += amount;
      currentMemberTotal.activeAccountCount += 1;
      memberTotals.set(account.member_id, currentMemberTotal);
      detailRows.push({
        月份: month.label,
        月末日期: month.monthEndText,
        家庭名称: familyName,
        币种: currency,
        成员ID: account.member_id,
        成员名称: profile?.display_name ?? profile?.email ?? `成员${account.member_id}`,
        用户ID: member?.user_id ?? '',
        账户ID: account.id,
        账户名称: account.account_name,
        账户类型: account.account_type,
        所属机构: account.institution ?? '',
        资产象限: account.asset_quadrant ?? '',
        金额: amount,
      });
    }

    for (const member of members) {
      const currentMemberTotal = memberTotals.get(member.id);
      if (!currentMemberTotal) {
        continue;
      }

      memberSummaryRows.push({
        月份: month.label,
        月末日期: month.monthEndText,
        家庭名称: familyName,
        币种: currency,
        成员ID: member.id,
        成员名称: getMemberDisplayName(member.id),
        用户ID: member.user_id ?? '',
        成员总资产: currentMemberTotal.totalAmount,
        账户数: currentMemberTotal.activeAccountCount,
      });
    }

    summaryRows.push({
      月份: month.label,
      月末日期: month.monthEndText,
      家庭名称: familyName,
      币种: currency,
      家庭总资产: totalAmount,
      账户数: activeAccountCount,
      成员数: members.length,
    });
  }

  const memberRecordRows: MemberAssetRecordRow[] = snapshots.map((snapshot) => {
    const account = accountMap.get(snapshot.account_id);
    const member = account ? memberMap.get(account.member_id) : null;
    const profile = member?.user_id ? profileMap.get(member.user_id) : null;

    return {
      日期: snapshot.snapshot_date,
      家庭名称: familyName,
      成员ID: account?.member_id ?? 0,
      成员名称: profile?.display_name ?? profile?.email ?? '',
      用户ID: member?.user_id ?? '',
      账户ID: snapshot.account_id,
      账户名称: account?.account_name ?? '',
      账户类型: account?.account_type ?? '',
      所属机构: account?.institution ?? '',
      资产象限: account?.asset_quadrant ?? '',
      金额: Number(snapshot.amount),
    };
  });

  return { summaryRows, memberSummaryRows, detailRows, memberRecordRows };
}

function buildPivotDetailRows(detailRows: MonthlyDetailRow[]) {
  const dateColumns = Array.from(new Set(detailRows.map((row) => row.月末日期))).sort();
  const rowMap = new Map<number, PivotDetailRow>();

  for (const row of detailRows) {
    const currentRow = rowMap.get(row.账户ID) ?? {
      成员名称: row.成员名称,
      成员ID: row.成员ID,
      用户ID: row.用户ID,
      账户名称: row.账户名称,
      账户ID: row.账户ID,
      账户类型: row.账户类型,
      所属机构: row.所属机构,
      资产象限: row.资产象限,
    };

    currentRow[row.月末日期] = row.金额;
    rowMap.set(row.账户ID, currentRow);
  }

  const pivotRows = Array.from(rowMap.values())
    .sort((left, right) => {
      if (left.成员名称 !== right.成员名称) {
        return left.成员名称.localeCompare(right.成员名称, 'zh-CN');
      }
      return left.账户名称.localeCompare(right.账户名称, 'zh-CN');
    })
    .map((row) => {
      const completedRow: PivotDetailRow = { ...row };

      for (const dateText of dateColumns) {
        if (!(dateText in completedRow)) {
          completedRow[dateText] = '';
        }
      }

      return completedRow;
    });

  return {
    pivotRows,
    dateColumns,
  };
}

function parseDetailImportRows(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, {
    header: 1,
    defval: '',
  });

  if (matrix.length === 0) {
    return [] as Array<{ account_id: number; snapshot_date: string; amount: number }>;
  }

  const headerRow = (matrix[0] ?? []).map((cell) => String(cell).trim());
  const dateColumnIndexes = headerRow
    .map((header, index) => (isIsoDateText(header) ? index : -1))
    .filter((index) => index >= 0);

  if (dateColumnIndexes.length > 0) {
    const accountIdIndex = headerRow.indexOf('账户ID');
    if (accountIdIndex < 0) {
      return [];
    }

    return matrix
      .slice(1)
      .flatMap((row) => {
        const accountId = Number(row[accountIdIndex]);
        if (!Number.isFinite(accountId)) {
          return [];
        }

        return dateColumnIndexes
          .map((columnIndex) => {
            const rawAmount = row[columnIndex];
            const amountText = typeof rawAmount === 'string' ? rawAmount.trim() : rawAmount;
            if (amountText === '') {
              return null;
            }

            const amount = Number(amountText);
            if (!Number.isFinite(amount)) {
              return null;
            }

            return {
              account_id: accountId,
              snapshot_date: normalizeIsoDateText(headerRow[columnIndex]),
              amount,
            };
          })
          .filter((item): item is { account_id: number; snapshot_date: string; amount: number } => Boolean(item));
      });
  }

  const rows = XLSX.utils.sheet_to_json<ImportableDetailRow>(sheet, {
    defval: '',
  });

  return rows
    .map((row) => {
      const accountId = Number(row.账户ID);
      const amount = Number(row.金额);
      const snapshotDate = String(row.月末日期 ?? '').trim();

      if (!Number.isFinite(accountId) || !Number.isFinite(amount) || !snapshotDate) {
        return null;
      }

      return {
        account_id: accountId,
        snapshot_date: normalizeIsoDateText(snapshotDate),
        amount,
      };
    })
    .filter((item): item is { account_id: number; snapshot_date: string; amount: number } => Boolean(item));
}

export async function exportFamilyAssetWorkbook({
  familyId,
  familyName,
  currency,
}: {
  familyId: number;
  familyName: string;
  currency: string;
}) {
  const scope = await fetchFamilyExportScope(familyId);
  const { summaryRows, memberSummaryRows, detailRows, memberRecordRows } = buildWorkbookData({
    familyName,
    currency,
    ...scope,
  });

  if (summaryRows.length === 0) {
    throw new Error('暂无可导出的历史资产数据');
  }

  const { pivotRows } = buildPivotDetailRows(detailRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), '月度汇总');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(memberSummaryRows), '成员月度汇总');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pivotRows), '账户月度明细');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(memberRecordRows), '成员资产记录');

  const fileName = `${familyName}-家庭资产历史-${new Date().toISOString().slice(0, 10)}.xlsx`;

  if (Platform.OS === 'web') {
    XLSX.writeFile(workbook, fileName, {
      bookType: 'xlsx',
    });

    return {
      fileName,
      fileUri: fileName,
      canShare: false,
      summaryCount: summaryRows.length,
      memberSummaryCount: memberSummaryRows.length,
      detailCount: pivotRows.length,
      memberRecordCount: memberRecordRows.length,
    };
  }

  const workbookBase64 = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'base64',
  });
  const targetUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${fileName}`;

  if (!targetUri) {
    throw new Error('无法创建导出文件');
  }

  await FileSystem.writeAsStringAsync(targetUri, workbookBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  return {
    fileName,
    fileUri: targetUri,
    canShare,
    summaryCount: summaryRows.length,
    memberSummaryCount: memberSummaryRows.length,
    detailCount: pivotRows.length,
    memberRecordCount: memberRecordRows.length,
  };
}

export async function shareExportedWorkbook(fileUri: string) {
  if (Platform.OS === 'web') {
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('当前设备不支持系统分享，请在支持分享的设备上导出');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: '导出家庭资产历史数据',
  });
}

export async function pickWorkbookForImport() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0];
}

export async function importFamilyAssetWorkbook({
  familyId,
  fileUri,
  onProgress,
}: {
  familyId: number;
  fileUri: string;
  onProgress?: (payload: {
    stage: 'uploading' | 'storing';
    status: 'running' | 'success';
    parsedCount?: number;
    storedCount?: number;
    sheetName?: string;
  }) => void;
  }) {
  const scope = await fetchFamilyExportScope(familyId);
  const allowedAccountIds = new Set(scope.accounts.map((account) => account.id));
  const workbook = Platform.OS === 'web'
    ? await (async () => {
      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error('无法读取所选 Excel 文件');
      }

      const workbookBuffer = await response.arrayBuffer();
      return XLSX.read(workbookBuffer, { type: 'array' });
    })()
    : await (async () => {
      const workbookBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return XLSX.read(workbookBase64, { type: 'base64' });
    })();
  const targetSheetName = workbook.SheetNames.includes('账户月度明细')
    ? '账户月度明细'
    : workbook.SheetNames[0];

  if (!targetSheetName) {
    throw new Error('未找到可导入的工作表');
  }

  const sheet = workbook.Sheets[targetSheetName];
  const records = parseDetailImportRows(sheet).filter((item) => allowedAccountIds.has(item.account_id));

  if (records.length === 0) {
    throw new Error('Excel 中未解析到可导入的账户月度数据');
  }

  onProgress?.({
    stage: 'uploading',
    status: 'success',
    parsedCount: records.length,
    sheetName: targetSheetName,
  });
  onProgress?.({
    stage: 'storing',
    status: 'running',
    parsedCount: records.length,
    storedCount: 0,
    sheetName: targetSheetName,
  });

  const chunkSize = 200;
  let storedCount = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('asset_daily_snapshots')
      .upsert(chunk, { onConflict: 'account_id,snapshot_date' });

    if (error) throw error;

    storedCount += chunk.length;
    onProgress?.({
      stage: 'storing',
      status: storedCount >= records.length ? 'success' : 'running',
      parsedCount: records.length,
      storedCount,
      sheetName: targetSheetName,
    });
  }

  return {
    importedCount: records.length,
    storedCount,
    sheetName: targetSheetName,
  };
}
