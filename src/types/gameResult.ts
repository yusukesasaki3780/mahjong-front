export type GameType = 'YONMA' | 'SANMA';

export interface GameResult {
  id: string;
  userId: string;
  gameType: GameType;
  playedAt: string;
  place: number;
  baseIncome: number;
  tipCount: number;
  tipIncome: number;
  totalIncome: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GameResultPayload {
  gameType: GameType;
  playedAt: string;
  place: number;
  baseIncome: number;
  tipCount: number;
  tipIncome: number;
  totalIncome: number;
  note?: string;
}

export type PartialGameResultPayload = Partial<GameResultPayload>;

export interface GameResultQuery {
  startDate?: string;
  endDate?: string;
  yearMonth?: string;
  limit?: number;
}

export interface GameResultResponse {
  userId: string;
  averagePlace: number | null;
  totalGames: number;
  totalIncome: number;
  results: GameResult[];
}
