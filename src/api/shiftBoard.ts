// シフトボード表示・要員数更新に関連するAPIを呼び出します。
import dayjs from 'dayjs';
import { apiClient } from './axios';

export type ShiftBoardHalf = 'first' | 'second';
export type ShiftBoardShiftType = 'EARLY' | 'LATE';

export interface ShiftBoardMember {
  id?: string | number;
  userId: string | number;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  zooId?: string | number | null;
  isDeleted?: boolean;
}

export interface ShiftBoardShift {
  id: string;
  userId: string;
  date: string;
  workDate?: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftBoardShiftType;
  memo?: string | null;
  editable?: boolean;
}

export interface ShiftBoardRequirement {
  id?: string | number;
  date: string;
  shiftType: ShiftBoardShiftType;
  startRequired: number;
  endRequired: number;
  startActual: number;
  endActual: number;
  editable: boolean;
}

export interface ShiftBoardRequirementRaw {
  id?: string | number;
  requirementId?: string | number;
  targetDate?: string;
  date?: string;
  shiftType: ShiftBoardShiftType;
  startRequired?: number;
  start_required?: number;
  endRequired?: number;
  end_required?: number;
  requiredStart?: number;
  requiredEnd?: number;
  startActual?: number;
  start_actual?: number;
  endActual?: number;
  end_actual?: number;
  actualCount?: number;
  editable?: boolean;
}

export interface ShiftBoardResponseRaw {
  storeId: number;
  startDate: string;
  endDate: string;
  half: ShiftBoardHalf;
  editable: boolean;
  users: ShiftBoardMember[];
  members?: ShiftBoardMember[];
  shifts: ShiftBoardShift[];
  requirements: ShiftBoardRequirementRaw[];
}

export interface ShiftBoardResponse {
  storeId: number;
  startDate: string;
  endDate: string;
  half: ShiftBoardHalf;
  editable: boolean;
  users: ShiftBoardMember[];
  members?: ShiftBoardMember[];
  shifts: ShiftBoardShift[];
  requirements: ShiftBoardRequirement[];
}

export interface FetchShiftBoardParams {
  startDate: string;
  endDate: string;
}

const normalizeNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === 'number' ? value : Number(value ?? NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeRequirements = (requirements: ShiftBoardRequirementRaw[] = []): ShiftBoardRequirement[] =>
  requirements.map((req) => {
    const date = req.targetDate ?? req.date ?? '';
    return {
      id: (req.id ?? req.requirementId) as string | number | undefined,
      date,
      shiftType: req.shiftType,
      startRequired: normalizeNumber(req.startRequired ?? req.start_required ?? req.requiredStart, 0),
      endRequired: normalizeNumber(req.endRequired ?? req.end_required ?? req.requiredEnd, 0),
      startActual: normalizeNumber(req.startActual ?? req.start_actual ?? req.actualCount, 0),
      endActual: normalizeNumber(req.endActual ?? req.end_actual ?? req.actualCount, 0),
      editable: typeof req.editable === 'boolean' ? req.editable : true,
    };
  });

export const fetchShiftBoard = async (
  storeId: number,
  params: FetchShiftBoardParams,
): Promise<ShiftBoardResponse> => {
  const { data } = await apiClient.get<ShiftBoardResponseRaw>(`/stores/${storeId}/shift-board`, {
    params,
  });
  return {
    ...data,
    requirements: normalizeRequirements(data.requirements ?? []),
  };
};

export interface ShiftRequirementUpsertRequest {
  targetDate: string;
  shiftType: ShiftBoardShiftType;
  startRequired: number;
  endRequired: number;
}

export const updateShiftRequirements = async (
  storeId: number,
  request: ShiftRequirementUpsertRequest,
): Promise<void> => {
  const payload: ShiftRequirementUpsertRequest = {
    ...request,
    targetDate: dayjs(request.targetDate).format('YYYY-MM-DD'),
  };
  await apiClient.put(`/stores/${storeId}/shift-requirements`, payload);
};
