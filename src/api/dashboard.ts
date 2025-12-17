// ダッシュボード画面用の集計データを取得するAPIラッパーです。
﻿import { apiClient } from './axios';
import type { DashboardSummary } from '../types/dashboard';

// ダッシュボードサマリー取得 API のパスを生成する
const dashboardSummaryPath = (userId: string): string =>
  `/users/${userId}/dashboard/summary`;

// ダッシュボードで表示するサマリーデータを取得する
export const getDashboardSummary = async (
  userId: string,
): Promise<DashboardSummary> => {
  const { data } = await apiClient.get<DashboardSummary>(dashboardSummaryPath(userId));
  return data;
};
