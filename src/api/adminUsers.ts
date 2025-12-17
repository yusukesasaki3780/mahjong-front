// 管理者ページで使うユーザー管理系API呼び出しを集約したモジュールです。
import { apiClient } from './axios';

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  storeId?: number;
  storeName?: string;
  nickname?: string;
  nickName?: string;
  prefectureCode?: string;
  lastLoginAt?: string | null;
  isAdmin: boolean;
  isDeleted: boolean;
  [key: string]: unknown;
}

export interface AdminUserDetail extends AdminUserSummary {
  zooId?: number;
  storeId?: number;
  createdAt?: string;
  updatedAt?: string;
  firstName?: string;
  lastName?: string;
}

export interface PasswordResetPayload {
  newPassword: string;
}

export const fetchAdminUsers = async (): Promise<AdminUserSummary[]> => {
  const { data } = await apiClient.get<AdminUserSummary[]>('/admin/users');
  return data;
};

export const fetchAdminUser = async (userId: string): Promise<AdminUserDetail> => {
  const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${userId}`);
  return data;
};

export const deleteAdminUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/admin/users/${userId}`);
};

export const restoreAdminUser = async (userId: string): Promise<void> => {
  await apiClient.patch(`/admin/users/${userId}/restore`);
};

export const resetAdminUserPassword = async (userId: string, payload: PasswordResetPayload): Promise<void> => {
  await apiClient.post(`/admin/users/${userId}/password-reset`, payload);
};

export const updateAdminUserAdminFlag = async (
  userId: string,
  isAdmin: boolean,
): Promise<AdminUserSummary> => {
  const { data } = await apiClient.patch<AdminUserSummary>(`/admin/users/${userId}/admin`, { isAdmin });
  return data;
};
