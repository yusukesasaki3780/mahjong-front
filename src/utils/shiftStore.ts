export type ShiftUserRole = 'ADMIN' | 'MEMBER';

export interface ShiftStoreResolutionInput {
  role: ShiftUserRole;
  selectedStoreId?: number | null;
  fallbackStoreId?: number | null;
}

export const isValidStoreId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const resolveShiftStoreId = ({
  role,
  selectedStoreId,
  fallbackStoreId,
}: ShiftStoreResolutionInput): number => {
  if (role === 'ADMIN') {
    if (isValidStoreId(selectedStoreId)) {
      return selectedStoreId;
    }
    throw new Error('STORE_SELECTION_REQUIRED');
  }

  if (isValidStoreId(fallbackStoreId)) {
    return fallbackStoreId;
  }

  throw new Error('HOME_STORE_UNAVAILABLE');
};

export const tryResolveShiftStoreId = (input: ShiftStoreResolutionInput): number | null => {
  try {
    return resolveShiftStoreId(input);
  } catch {
    return null;
  }
};

export const buildStoreRequestOptions = (storeId?: number | null) =>
  isValidStoreId(storeId) ? { storeId } : null;

export const ensureStoreRequestOptions = (storeId?: number | null) => {
  const options = buildStoreRequestOptions(storeId);
  if (!options) {
    throw new Error('STORE_ID_REQUIRED');
  }
  return options;
};
