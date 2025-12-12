import { apiClient } from './axios';
import type { GameType } from '../types/gameResult';
import type { PersonalRanking, RankingItem, RankingRange } from '../types/ranking';

export interface RankingQueryParams {
  type: GameType;
  start: string;
  end: string;
  label?: string;
}

interface RankingApiResponseItem {
  userId: number;
  name: string;
  zooId?: number | null;
  totalIncome: number;
  gameCount: number;
  averagePlace: number | null;
}

interface RankingApiResponse {
  ranking?: RankingApiResponseItem[] | null;
  myRank?: number | null;
  totalPlayers?: number;
  myStats?: unknown;
}

export interface PersonalRankingParams {
  mode: 'four' | 'three';
  range: RankingRange;
  targetDate: string;
}

interface PersonalRankingApiResponse {
  myRank?: number | null;
  totalPlayers?: number;
  myStats?:
    | {
        averageRank?: number | null;
        gameIncome?: number;
        gameCount?: number;
        user?: {
          id: number | string;
          nickname?: string | null;
        };
      }
    | null;
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeRanking = (items: unknown): RankingItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  return (items as RankingApiResponseItem[]).map((item) => ({
    userId: item.userId,
    name: item.name,
    zooId: item.zooId,
    totalIncome: toFiniteNumber(item.totalIncome, 0),
    gameCount: toFiniteNumber(item.gameCount, 0),
    averagePlace: toNullableNumber(item.averagePlace),
  }));
};

export const getRanking = async (params: RankingQueryParams): Promise<RankingItem[]> => {
  const { data } = await apiClient.get<RankingApiResponse>('/ranking', {
    params,
  });
  return normalizeRanking(data?.ranking ?? []);
};

const normalizePersonalRanking = (payload?: PersonalRankingApiResponse | null): PersonalRanking | null => {
  if (!payload || !payload.myStats) {
    return null;
  }
  return {
    rank: toNullableNumber(payload.myRank),
    totalPlayers: toFiniteNumber(payload.totalPlayers, 0),
    averageRank: toNullableNumber(payload.myStats.averageRank),
    gameIncome: toFiniteNumber(payload.myStats.gameIncome, 0),
    gameCount: toFiniteNumber(payload.myStats.gameCount, 0),
    user: payload.myStats.user ?? null,
  };
};

export const getMyRanking = async (params: PersonalRankingParams): Promise<PersonalRanking | null> => {
  const { data } = await apiClient.get<PersonalRankingApiResponse>('/ranking/me', {
    params,
  });
  return normalizePersonalRanking(data);
};
