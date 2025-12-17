// ユーザー情報の取得・更新・削除を扱うAPIラッパーです。
﻿import { apiClient } from './axios';

export interface UserProfile {
  id: string;
  name: string;
  lastName?: string;
  firstName?: string;
  nickname?: string;
  nickName?: string;
  email: string;
  zooId?: number;
  role?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  storeName?: string;
  storeId?: number;
  helpStoreIds?: number[];
  prefectureCode?: string;
  isAdmin?: boolean;
  lastLoginAt?: string;
  [key: string]: unknown;
}

export type UpsertUserPayload = Omit<UserProfile, 'id'>;
export type PatchUserPayload = Partial<UpsertUserPayload> & {
  currentPassword?: string;
  newPassword?: string;
};

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

export const deleteMyAccount = async (): Promise<void> => {
  await apiClient.delete('/users/me');
};
