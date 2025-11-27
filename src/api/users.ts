import { apiClient } from './axios';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type UpsertUserPayload = Omit<UserProfile, 'id'>;
export type PatchUserPayload = Partial<UpsertUserPayload>;

// ユーザー API のパスを生成する
const userPath = (userId: string, suffix = ''): string => `/users/${userId}${suffix}`;

// ユーザープロフィールを取得する
export const getUser = async (userId: string): Promise<UserProfile> => {
  const { data } = await apiClient.get<UserProfile>(userPath(userId));
  return data;
};

// ユーザープロフィールを完全更新する
export const updateUser = async (
  userId: string,
  payload: UpsertUserPayload,
): Promise<UserProfile> => {
  const { data } = await apiClient.put<UserProfile>(userPath(userId), payload);
  return data;
};

// ユーザープロフィールを部分更新する
export const patchUser = async (
  userId: string,
  payload: PatchUserPayload,
): Promise<UserProfile> => {
  const { data } = await apiClient.patch<UserProfile>(userPath(userId), payload);
  return data;
};

// ユーザーを削除する
export const deleteUser = async (userId: string): Promise<void> => {
  await apiClient.delete(userPath(userId));
};
