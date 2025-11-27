import { apiClient } from './axios';

export interface GameSettings {
  id?: string;
  userId: string;
  defaultRate?: number;
  tipPercentage?: number;
  allowNegativeSalary?: boolean;
  theme?: string;
  notifications?: Record<string, boolean>;
  [key: string]: unknown;
}

export type UpdateSettingsPayload = Omit<GameSettings, 'userId' | 'id'>;
export type PatchSettingsPayload = Partial<UpdateSettingsPayload>;

// ゲーム設定 API のパスを生成する
const settingsPath = (userId: string): string => `/users/${userId}/settings`;

// ユーザーのゲーム設定を取得する
export const getGameSettings = async (userId: string): Promise<GameSettings> => {
  const { data } = await apiClient.get<GameSettings>(settingsPath(userId));
  return data;
};

// ゲーム設定を全項目置き換える
export const replaceGameSettings = async (
  userId: string,
  payload: UpdateSettingsPayload,
): Promise<GameSettings> => {
  const { data } = await apiClient.put<GameSettings>(settingsPath(userId), payload);
  return data;
};

// ゲーム設定の一部項目を更新する
export const updateGameSettings = async (
  userId: string,
  payload: PatchSettingsPayload,
): Promise<GameSettings> => {
  const { data } = await apiClient.patch<GameSettings>(settingsPath(userId), payload);
  return data;
};
