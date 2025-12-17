// 対局成績の取得・登録・更新・削除APIをまとめたモジュールです。
﻿import { apiClient } from './axios';
import dayjs from 'dayjs';
import type {
  GameResult,
  GameResultPayload,
  GameResultQuery,
  GameResultResponse,
  PartialGameResultPayload,
} from '../types/gameResult';

// 成績 API のベースパスを生成する
const basePath = (userId: string): string => `/users/${userId}/results`;
// 成績詳細 API のパスを生成する
const detailPath = (userId: string, resultId: string): string => `${basePath(userId)}/${resultId}`;
// まとめて簡単入力 API のパス
const simpleBatchPath = (userId: string): string => `${basePath(userId)}/simple-batch`;

export interface SimpleBatchStartPayload {
  storeId: number;
  playedAt: string;
}

export interface SimpleBatchStartResponse {
  simpleBatchId: string;
  storeId: number;
  storeName?: string;
  playedAt: string;
}

// YYYY-MM 形式から月初〜月末の検索期間を算出する
const buildMonthRangeFromYearMonth = (yearMonth: string): { startDate: string; endDate: string } => {
  const parsed = dayjs(`${yearMonth}-01`);
  const reference = parsed.isValid() ? parsed : dayjs();
  const start = reference.startOf('month');
  const end = reference.endOf('month');
  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
  };
};

// API が必要とする日付範囲パラメータを必ず組み立てる
const ensureRangeQuery = (query: GameResultQuery = {}): Pick<GameResultQuery, 'startDate' | 'endDate'> => {
  if (query.startDate && query.endDate) {
    return { startDate: query.startDate, endDate: query.endDate };
  }

  if (query.yearMonth) {
    return buildMonthRangeFromYearMonth(query.yearMonth);
  }

  const now = dayjs();
  return buildMonthRangeFromYearMonth(now.format('YYYY-MM'));
};

// 指定期間の成績一覧を取得する
export const getGameResults = async (
  userId: string,
  query: GameResultQuery = {},
): Promise<GameResultResponse> => {
  const normalizedQuery = ensureRangeQuery(query);
  const url = basePath(userId);
  console.log('[GameResults] GET request', {
    url,
    query: normalizedQuery,
    authHeader: apiClient.defaults.headers.common.Authorization,
  });
  const { data, status } = await apiClient.get<GameResultResponse>(url, { params: normalizedQuery });
  console.log('[GameResults] response', { url, status, received: data.results.length });
  return data;
};

// 成績一件を取得する
export const getGameResult = async (
  userId: string,
  resultId: string,
): Promise<GameResult> => {
  const { data } = await apiClient.get<GameResult>(detailPath(userId, resultId));
  return data;
};

// 成績を新規作成する
export const createGameResult = async (
  userId: string,
  payload: GameResultPayload,
): Promise<GameResult> => {
  const { data } = await apiClient.post<GameResult>(basePath(userId), payload);
  return data;
};

export const startSimpleBatch = async (
  userId: string,
  payload: SimpleBatchStartPayload,
): Promise<SimpleBatchStartResponse> => {
  const { data } = await apiClient.post<SimpleBatchStartResponse>(`${simpleBatchPath(userId)}/start`, payload);
  return data;
};

export const deleteSimpleBatch = async (
  userId: string,
  simpleBatchId: string,
): Promise<{ deletedCount: number }> => {
  const { data } = await apiClient.delete<{ deletedCount: number }>(
    `${simpleBatchPath(userId)}/${simpleBatchId}`,
  );
  return data;
};

// 成績を完全更新する
export const updateGameResult = async (
  userId: string,
  resultId: string,
  payload: GameResultPayload,
): Promise<GameResult> => {
  const { data } = await apiClient.put<GameResult>(detailPath(userId, resultId), payload);
  return data;
};

// 成績を部分更新する
export const patchGameResult = async (
  userId: string,
  resultId: string,
  payload: PartialGameResultPayload,
): Promise<GameResult> => {
  const { data } = await apiClient.patch<GameResult>(detailPath(userId, resultId), payload);
  return data;
};

// 成績を削除する
export const deleteGameResult = async (userId: string, resultId: string): Promise<void> => {
  await apiClient.delete(detailPath(userId, resultId));
};
