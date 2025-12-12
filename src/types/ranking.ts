export type RankingRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RankingItem {
  userId: number;
  name: string;
  zooId?: number | null;
  totalIncome: number;
  gameCount: number;
  averagePlace: number | null;
}

export interface PersonalRanking {
  rank: number | null;
  totalPlayers: number;
  averageRank: number | null;
  gameIncome: number;
  gameCount: number;
  user?: {
    id: number | string;
    nickname?: string | null;
  } | null;
}
