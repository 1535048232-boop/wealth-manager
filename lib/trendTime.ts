export type TrendGranularity = 'month' | 'year';

export interface TrendPeriodPoint {
  key: string;
  label: string;
  dateText: string;
}

function parseDateText(dateText: string) {
  const [yearText, monthText, dayText] = dateText.split('-');
  return new Date(
    Number(yearText),
    Math.max(Number(monthText) - 1, 0),
    Math.max(Number(dayText), 1),
  );
}

export function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getMonthLabel(date: Date) {
  return `${date.getMonth() + 1}月`;
}

function getYearEnd(date: Date) {
  return new Date(date.getFullYear(), 11, 31);
}

function toDateText(date: Date) {
  return date.toISOString().split('T')[0];
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function isSameYear(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear();
}

export function buildTrendPeriods(snapshotDates: string[], granularity: TrendGranularity): TrendPeriodPoint[] {
  if (snapshotDates.length === 0) return [];

  const sortedDates = [...snapshotDates].sort();
  const firstDate = parseDateText(sortedDates[0]);
  const today = new Date();
  const periods: TrendPeriodPoint[] = [];

  if (granularity === 'month') {
    const cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);

    while (cursor <= end) {
      const pointDate = isSameMonth(cursor, today) ? today : getMonthEnd(cursor);
      periods.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: `${String(cursor.getFullYear()).slice(-2)}/${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        dateText: toDateText(pointDate),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return periods;
  }

  const cursor = new Date(firstDate.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 0, 1);

  while (cursor <= end) {
    const pointDate = isSameYear(cursor, today) ? today : getYearEnd(cursor);
    periods.push({
      key: `${cursor.getFullYear()}`,
      label: `${cursor.getFullYear()}`,
      dateText: toDateText(pointDate),
    });
    cursor.setFullYear(cursor.getFullYear() + 1);
  }

  return periods;
}

export function getValueAtDate<T extends { snapshot_date: string; amount: number }>(snapshots: T[], dateText: string) {
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

export function getScrollableChartWidth(
  viewportWidth: number,
  pointCount: number,
  pointGap: number,
  horizontalPadding: number,
) {
  if (pointCount <= 1) return viewportWidth;
  return Math.max(
    viewportWidth,
    horizontalPadding * 2 + (pointCount - 1) * pointGap,
  );
}
