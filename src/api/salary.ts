import { apiClient } from './axios';

export interface SalarySummary {
  userId?: string;
  yearMonth: string;
  totalWorkMinutes: number;
  totalDayMinutes: number;
  totalNightMinutes: number;
  baseWageTotal: number;
  nightExtraTotal: number;
  gameIncomeTotal: number;
  transportTotal: number;
  grossSalary: number;
  incomeTax: number;
  netSalary: number;
  advanceAmount?: number;
  specialAllowanceTotal?: number;
  specialAllowances?: SpecialAllowance[];
}

export interface SpecialAllowance {
  type: 'special_hourly_wage' | 'night_bonus' | string;
  label: string;
  unitPrice: number;
  hours?: number;
  amount: number;
  specialHourlyWageId?: number | null;
}

// 給与詳細の API パスを生成する
const salaryPath = (userId: string, yearMonth: string): string =>
  `/users/${userId}/salary/${yearMonth}`;

// 指定年月の給与サマリーを取得する
export const getSalary = async (
  userId: string,
  yearMonth: string,
): Promise<SalarySummary> => {
  const { data } = await apiClient.get<SalarySummary>(salaryPath(userId, yearMonth));
  return data;
};

export interface AdvancePaymentResponse {
  amount: number;
}

// 前借額を扱う API パスを生成する
const advancePath = (userId: string, yearMonth: string): string =>
  `/users/${userId}/advance/${yearMonth}`;

// 指定年月の前借額を取得する
export const getAdvancePayment = async (
  userId: string,
  yearMonth: string,
): Promise<AdvancePaymentResponse> => {
  const { data } = await apiClient.get<AdvancePaymentResponse>(advancePath(userId, yearMonth));
  return data;
};

// 前借額を更新する
export const updateAdvancePayment = async (
  userId: string,
  yearMonth: string,
  payload: AdvancePaymentResponse,
): Promise<AdvancePaymentResponse> => {
  const { data } = await apiClient.put<AdvancePaymentResponse>(advancePath(userId, yearMonth), payload);
  return data;
};
