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
  otherIncome: number;
  totalIncome: number;
  simpleBatchId?: string | null;
  storeId?: number | null;
  storeName?: string | null;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  isFinalRecord?: boolean;
}

export interface GameResultPayload {
  gameType: GameType;
  playedAt: string;
  place: number;
  baseIncome: number;
  tipCount: number;
  tipIncome: number;
  otherIncome: number;
  totalIncome: number;
  simpleBatchId?: string | null;
  storeId?: number | null;
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
