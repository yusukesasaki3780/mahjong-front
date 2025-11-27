import { apiClient } from './axios';

export type WageType = 'HOURLY' | 'FIXED';

export interface GameSettings {
  yonmaGameFee: number;
  sanmaGameFee: number;
  sanmaGameFeeBack: number;
  yonmaTipUnit: number;
  sanmaTipUnit: number;
  wageType: WageType;
  hourlyWage: number;
  fixedSalary: number;
  nightRateMultiplier: number;
  baseMinWage: number;
  incomeTaxRate: number;
  transportPerShift: number;
}

// ゲーム設定 API のベースパスを生成する
const basePath = (userId: string): string => `/users/${userId}/settings`;

// ユーザーのゲーム設定を取得する
export const getGameSettings = async (userId: string): Promise<GameSettings> => {
  const { data } = await apiClient.get<GameSettings>(basePath(userId));
  return data;
};

// ゲーム設定を全項目更新する
export const updateGameSettings = async (
  userId: string,
  payload: GameSettings,
): Promise<GameSettings> => {
  const { data } = await apiClient.put<GameSettings>(basePath(userId), payload);
  return data;
};

// ゲーム設定の一部項目のみ更新する
export const patchGameSettings = async (
  userId: string,
  payload: Partial<GameSettings>,
): Promise<GameSettings> => {
  const { data } = await apiClient.patch<GameSettings>(basePath(userId), payload);
  return data;
};
