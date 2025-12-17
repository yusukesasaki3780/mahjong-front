import { apiClient } from './axios';

export interface ShiftNotification {
  id: number | string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface FetchNotificationOptions {
  onlyUnread?: boolean;
}

export const getNotifications = async (
  options: FetchNotificationOptions = {},
): Promise<ShiftNotification[]> => {
  const params = options.onlyUnread ? { status: 'UNREAD' } : undefined;
  const { data } = await apiClient.get<ShiftNotification[]>('/notifications', { params });
  return data;
};

export const markNotificationRead = async (id: number | string): Promise<void> => {
  await apiClient.patch(`/notifications/${id}/read`);
};

export const deleteNotification = async (id: number | string): Promise<void> => {
  await apiClient.delete(`/notifications/${id}`);
};
