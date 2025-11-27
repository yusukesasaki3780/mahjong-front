import dayjs from 'dayjs';
import { apiClient, getStoredUserId } from './axios';
import type {
  StatsResponse,
  DailyTrendItem,
  MonthlySummary,
  YearlySummary,
  GameType,
  PlaceCounts,
} from '../types/statistics';
import type { GameResultResponse, GameResult } from '../types/gameResult';

export type RangePreset = '7d' | '30d' | '90d' | '1y';

const rangeDays: Record<RangePreset, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

// API から返る種別文字列をフロントで扱う定義にそろえる
const normalizeGameType = (value?: string): GameType =>
  value && value.toUpperCase() === 'SANMA' ? 'SANMA' : 'YONMA';

// 着順ごとの出現数を集計する
const buildPlaceCounts = (results: GameResult[]): PlaceCounts => {
  const counts: PlaceCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  results.forEach((result) => {
    if (result.place === 1 || result.place === 2 || result.place === 3 || result.place === 4) {
      counts[result.place] += 1;
    }
  });
  return counts;
};

// 収支推移グラフ用の配列を組み立てる
const buildDailyTrend = (results: GameResult[]): DailyTrendItem[] =>
  results.map((result) => ({
    date: result.playedAt?.slice(0, 10) ?? '',
    income: result.totalIncome ?? 0,
    gameType: normalizeGameType(result.gameType),
  }));

// プリセットに応じた検索期間（開始日・終了日）を算出する
const buildRange = (preset: RangePreset): { start: string; end: string } => {
  const endDate = dayjs().startOf('day');
  const span = Math.max(rangeDays[preset] - 1, 0);
  const startDate = endDate.subtract(span, 'day');

  return {
    start: startDate.format('YYYY-MM-DD'),
    end: endDate.format('YYYY-MM-DD'),
  };
};

// 指定期間の成績一覧を取得し、統計表示用のデータへ整形する
export const getStatistics = async (preset: RangePreset): Promise<StatsResponse> => {
  const userId = getStoredUserId();
  if (!userId) {
    throw new Error('ユーザー情報が見つかりません。再ログインしてください。');
  }
  const { start, end } = buildRange(preset);
  const { data } = await apiClient.get<GameResultResponse>(`/users/${userId}/results`, {
    params: { start, end },
  });

  const placeCounts = buildPlaceCounts(data.results);
  const dailyTrend = buildDailyTrend(data.results);
  const totalIncome =
    typeof data.totalIncome === 'number'
      ? data.totalIncome
      : data.results.reduce((sum, item) => sum + (item.totalIncome ?? 0), 0);
  const totalGames = typeof data.totalGames === 'number' ? data.totalGames : data.results.length;

  return {
    totalGames,
    totalIncome,
    placeCounts,
    dailyTrend,
  };
};

// 収支推移データを日付ごと・ゲーム種別ごとに再構成する
export const groupTrendByGameType = (
  trend: DailyTrendItem[],
): { dates: string[]; values: Record<GameType, number[]> } => {
  const dates = Array.from(new Set(trend.map((item) => item.date))).sort();
  const indexMap = dates.reduce<Record<string, number>>((acc, date, idx) => {
    acc[date] = idx;
    return acc;
  }, {});

  const values: Record<GameType, number[]> = {
    YONMA: Array(dates.length).fill(0),
    SANMA: Array(dates.length).fill(0),
  };

  trend.forEach((item) => {
    const type = normalizeGameType(item.gameType);
    const idx = indexMap[item.date];
    if (idx !== undefined) {
      values[type][idx] = (values[type][idx] ?? 0) + item.income;
    }
  });

  return { dates, values };
};

// 当年の月次サマリーを作成する
export const buildMonthlySummary = (trend: DailyTrendItem[]): MonthlySummary[] => {
  const currentYear = new Date().getFullYear();
  const result: MonthlySummary[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 0,
  }));

  trend.forEach((item) => {
    const date = new Date(item.date);
    if (date.getFullYear() !== currentYear) {
      return;
    }
    const monthIndex = date.getMonth();
    const target = result[monthIndex];
    if (target) {
      target.income += item.income;
    }
  });

  return result;
};

// 年単位のサマリーを作成し昇順で返す
export const buildYearlySummary = (trend: DailyTrendItem[]): YearlySummary[] => {
  const map = new Map<number, YearlySummary>();

  trend.forEach((item) => {
    const date = new Date(item.date);
    const year = date.getFullYear();
    const summary = map.get(year) ?? { year, income: 0, games: 0 };
    summary.income += item.income;
    summary.games += 1;
    map.set(year, summary);
  });

  return Array.from(map.values()).sort((a, b) => a.year - b.year);
};
