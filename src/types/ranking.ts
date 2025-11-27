export type RankingRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RankingItem {
  userId: number;
  name: string;
  totalIncome: number;
  gameCount: number;
  averagePlace: number | null;
}
