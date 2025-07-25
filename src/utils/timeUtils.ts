export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function formatDurationShort(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  } else {
    return `${minutes}分`;
  }
}

export function getPeriodRange(period: 'today' | 'week' | 'month' | 'all'): { start: Date, end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
    case 'month':
      start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      break;
    case 'all':
    default:
      start = new Date(0);
      break;
  }

  return { start, end };
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function getPeriodDisplayName(period: 'today' | 'week' | 'month' | 'all'): string {
  switch (period) {
    case 'today':
      return '今日';
    case 'week':
      return '過去7日間';
    case 'month':
      return '過去30日間';
    case 'all':
      return '全期間';
    default:
      return '過去7日間';
  }
}