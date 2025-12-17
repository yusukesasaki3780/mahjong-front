import dayjs from "dayjs";
import { apiClient } from './axios';

export interface ShiftBreak {
  startTime: string;
  endTime: string;
}

export interface Shift {
  id: string;
  userId: string;
  date?: string;
  workDate?: string;
  startTime?: string;
  endTime?: string;
  startDateTime?: string;
  endDateTime?: string;
  breakMinutes?: number;
  memo?: string;
  breaks?: ShiftBreak[];
  specialHourlyWageId?: number | null;
  specialWageId?: number | null;
  [key: string]: unknown;
}

export interface CreateShiftPayload {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  memo?: string;
  breaks?: ShiftBreak[];
  specialHourlyWageId?: number | null;
  specialWageId?: number | null;
}

export type UpdateShiftPayload = Partial<CreateShiftPayload>;

export interface ShiftStatsSummary {
  totalHours: number;
  nightHours: number;
  avgHours: number;
  count: number;
}

type ShiftRequestOptions = {
  storeId?: number | string | null;
};

// シフト API のベースパスを生成する
const basePath = (userId: string): string => `/users/${userId}/shifts`;
// シフト詳細 API のパスを生成する
const shiftDetailPath = (userId: string, shiftId: string): string =>
  `${basePath(userId)}/${shiftId}`;

const resolveStoreIdParam = (options?: ShiftRequestOptions, caller?: string): number | null => {
  if (options?.storeId == null) {
    return null;
  }
  const numeric = Number(options.storeId);
  if (!Number.isFinite(numeric)) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[ShiftAPI] ${caller ?? 'shift'} invalid storeId`, {
        storeId: options.storeId,
      });
    }
    return null;
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[ShiftAPI] ${caller ?? 'shift'} storeId resolved`, {
      storeId: numeric,
      raw: options.storeId,
    });
  }
  return numeric;
};

// シフトデータの日付やメモを扱いやすい形に整形する
const normalizeShift = (shift: Shift): Shift => {
  const normalized: Shift = { ...shift };

  if (!normalized.date) {
    const source = shift.workDate ?? shift.startTime ?? shift.date;
    if (source) {
      const parsed = dayjs(source);
      if (parsed.isValid()) {
        normalized.date = parsed.format('YYYY-MM-DD');
      }
    }
  }

  if (Array.isArray(shift.breaks)) {
    normalized.breaks = shift.breaks.map((item) => ({ ...item }));
  }

  if (typeof shift.memo === 'string') {
    normalized.memo = shift.memo;
  } else if (typeof normalized.memo === 'undefined') {
    normalized.memo = '';
  }

  return normalized;
};

// 取得した複数シフトをまとめて整形する
const normalizeShiftList = (shifts: Shift[]): Shift[] => shifts.map(normalizeShift);

type MonthShiftParams = {
  rangeType: 'month';
  yearMonth: string;
};

type WeekShiftParams = {
  rangeType: 'week';
  start: string;
  end: string;
};

type DayShiftParams = {
  rangeType: 'day';
  date: string;
};

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

// 日付と時間の組み合わせを ISO 文字列に補正する
const toDateTimeWithOffset = (
  date: string,
  timeValue?: string,
  reference?: dayjs.Dayjs,
): string | undefined => {
  if (!timeValue) {
    return undefined;
  }
  const trimmed = timeValue.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsedValue = dayjs(trimmed);
  if (trimmed.includes('T') && parsedValue.isValid()) {
    return parsedValue.format(DATE_TIME_FORMAT);
  }

  const baseDate = dayjs(date);
  if (!baseDate.isValid()) {
    return timeValue;
  }

  const [hoursStr, minutesStr = '0'] = trimmed.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return timeValue;
  }

  let composed = baseDate.hour(hours).minute(minutes).second(0).millisecond(0);
  if (reference && composed.isBefore(reference)) {
    composed = composed.add(1, 'day');
  }

  return composed.format(DATE_TIME_FORMAT);
};

// API 送信用に開始・終了時刻や休憩を ISO 形式へ変換する
const prepareShiftPayload = <T extends Partial<CreateShiftPayload>>(payload: T): T => {
  if (!payload.date) {
    return payload;
  }

  const startIso = payload.startTime ? toDateTimeWithOffset(payload.date, payload.startTime) : undefined;
  const startMoment = startIso ? dayjs(startIso) : undefined;

  const endIso = payload.endTime
    ? toDateTimeWithOffset(payload.date, payload.endTime, startMoment)
    : undefined;

  let convertedBreaks: ShiftBreak[] | undefined;
  if (payload.breaks) {
    convertedBreaks = payload.breaks.map((item) => {
      const breakStartIso = item.startTime
        ? toDateTimeWithOffset(payload.date!, item.startTime, startMoment)
        : item.startTime;
      const breakStartMoment = breakStartIso ? dayjs(breakStartIso) : startMoment;
      const breakEndIso = item.endTime
        ? toDateTimeWithOffset(payload.date!, item.endTime, breakStartMoment)
        : item.endTime;
      return {
        ...item,
        startTime: breakStartIso ?? item.startTime,
        endTime: breakEndIso ?? item.endTime,
      };
    });
  }

  return {
    ...payload,
    startTime: startIso ?? payload.startTime,
    endTime: endIso ?? payload.endTime,
    breaks: convertedBreaks ?? payload.breaks,
  };
};

// 指定月のシフト一覧を取得する
export const getShifts = async (
  userId: string,
  params: MonthShiftParams,
  options?: ShiftRequestOptions,
): Promise<Shift[]> => {
  const storeId = resolveStoreIdParam(options, 'getShifts');
  const requestParams: Record<string, unknown> = { ...params };
  if (storeId != null) {
    requestParams.storeId = storeId;
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ShiftAPI] getShifts params', requestParams);
  }
  const { data } = await apiClient.get<Shift[]>(basePath(userId), {
    params: requestParams,
  });
  return normalizeShiftList(data);
};

// 週単位のシフト一覧を取得する
export const getWeekShifts = async (
  userId: string,
  start: string,
  end: string,
  options?: ShiftRequestOptions,
): Promise<Shift[]> => {
  const storeId = resolveStoreIdParam(options, 'getWeekShifts');
  const requestParams: WeekShiftParams & Record<string, unknown> = {
    rangeType: 'week',
    start,
    end,
  };
  if (storeId != null) {
    requestParams.storeId = storeId;
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ShiftAPI] getWeekShifts params', requestParams);
  }
  const { data } = await apiClient.get<Shift[]>(basePath(userId), {
    params: requestParams satisfies WeekShiftParams & Record<string, unknown>,
  });
  return normalizeShiftList(data);
};

// 1 日単位のシフト一覧を取得する
export const getDailyShifts = async (
  userId: string,
  date: string,
  options?: ShiftRequestOptions,
): Promise<Shift[]> => {
  const storeId = resolveStoreIdParam(options, 'getDailyShifts');
  const requestParams: DayShiftParams & Record<string, unknown> = {
    rangeType: 'day',
    date,
  };
  if (storeId != null) {
    requestParams.storeId = storeId;
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ShiftAPI] getDailyShifts params', requestParams);
  }
  const { data } = await apiClient.get<Shift[]>(basePath(userId), {
    params: requestParams satisfies DayShiftParams & Record<string, unknown>,
  });
  return normalizeShiftList(data);
};

// 指定月のシフト統計情報を取得する
export const getShiftStats = async (
  userId: string,
  yearMonth: string,
  options?: ShiftRequestOptions,
): Promise<ShiftStatsSummary> => {
  const storeId = resolveStoreIdParam(options, 'getShiftStats');
  const requestParams: Record<string, unknown> = { yearMonth };
  if (storeId != null) {
    requestParams.storeId = storeId;
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ShiftAPI] getShiftStats params', requestParams);
  }
  const { data } = await apiClient.get<ShiftStatsSummary>(`${basePath(userId)}/stats`, {
    params: requestParams,
  });
  return data;
};

// シフトを新規作成する
export const createShift = async (
  userId: string,
  payload: CreateShiftPayload,
  options?: ShiftRequestOptions,
): Promise<Shift> => {
  const nextPayload = prepareShiftPayload(payload);
  const storeId = resolveStoreIdParam(options, 'createShift');
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('[ShiftAPI] createShift params', { storeId });
  }
  const { data } = await apiClient.post<Shift>(basePath(userId), nextPayload, {
    params: storeId != null ? { storeId } : undefined,
  });
  return normalizeShift(data);
};

// シフトを全ての項目で更新する
export const replaceShift = async (
  userId: string,
  shiftId: string,
  payload: CreateShiftPayload,
  options?: ShiftRequestOptions,
): Promise<Shift> => {
  const nextPayload = prepareShiftPayload(payload);
  const storeId = resolveStoreIdParam(options, 'replaceShift');
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('[ShiftAPI] replaceShift params', { storeId });
  }
  const { data } = await apiClient.put<Shift>(shiftDetailPath(userId, shiftId), nextPayload, {
    params: storeId != null ? { storeId } : undefined,
  });
  return normalizeShift(data);
};

// シフトを部分更新する
export const updateShift = async (
  userId: string,
  shiftId: string,
  payload: UpdateShiftPayload,
  options?: ShiftRequestOptions,
): Promise<Shift> => {
  const nextPayload = prepareShiftPayload(payload);
  const storeId = resolveStoreIdParam(options, 'updateShift');
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('[ShiftAPI] updateShift params', { storeId });
  }
  const { data } = await apiClient.patch<Shift>(shiftDetailPath(userId, shiftId), nextPayload, {
    params: storeId != null ? { storeId } : undefined,
  });
  return normalizeShift(data);
};

// シフトを削除する
export const deleteShift = async (
  userId: string,
  shiftId: string,
  options?: ShiftRequestOptions,
): Promise<void> => {
  const storeId = resolveStoreIdParam(options, 'deleteShift');
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('[ShiftAPI] deleteShift params', { storeId });
  }
  await apiClient.delete(shiftDetailPath(userId, shiftId), {
    params: storeId != null ? { storeId } : undefined,
  });
};
