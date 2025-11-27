export interface ShiftSummary {
  id: string;
  startTime: string;
  endTime: string;
  location?: string;
  note?: string;
}

export interface GameResultSummary {
  id: string;
  playedAt: string;
  tableName?: string;
  score: number;
  rank: number;
}

export interface DashboardSummary {
  userId: string;
  month: string;
  hours: number;
  salary: number;
  avgPlace: number;
  gameCount: number;
  todayShift?: ShiftSummary | null;
  recentResults: GameResultSummary[];
}
