import { apiClient } from './axios';
import type { RankingItem } from '../types/ranking';
import type { GameType } from '../types/gameResult';

export interface RankingQueryParams {
  type: GameType;
  start: string;
  end: string;
  label?: string;
}

interface RankingApiResponseItem {
  userId: number;
  name: string;
  totalIncome: number;
  gameCount: number;
  averagePlace: number | null;
}

// API で取得したランキングデータをフロント用の型に整形する
const normalizeRanking = (items: RankingApiResponseItem[]): RankingItem[] =>
  items.map((item) => ({
    userId: item.userId,
    name: item.name,
    totalIncome: item.totalIncome,
    gameCount: item.gameCount,
    averagePlace: item.averagePlace,
  }));

// 期間・種別を指定してランキングを取得する
export const getRanking = async (params: RankingQueryParams): Promise<RankingItem[]> => {
  const { data } = await apiClient.get<RankingApiResponseItem[]>('/ranking', {
    params,
  });
  return normalizeRanking(data);
};
