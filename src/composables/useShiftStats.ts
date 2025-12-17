import { ref, watch, type Ref } from 'vue';
import { getShiftStats, type ShiftStatsSummary } from '../api/shifts';
import { getStoredUserId } from '../api/axios';

interface ShiftStatsOptions {
  storeId?: Ref<number | null>;
  storeIdRequired?: Ref<boolean>;
}

export const useShiftStats = (yearMonth: Ref<string>, options?: ShiftStatsOptions) => {
  const stats = ref<ShiftStatsSummary | null>(null);
  const loading = ref(false);
  const error = ref<unknown>(null);
  const userId = getStoredUserId();

  const fetchStats = async (): Promise<void> => {
    if (!userId) {
      error.value = new Error('Please sign in again.');
      return;
    }
    const requiresStoreId = options?.storeIdRequired?.value ?? false;
    const resolvedStoreId = options?.storeId?.value ?? null;
    if (requiresStoreId && (resolvedStoreId == null || Number.isNaN(resolvedStoreId))) {
      stats.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      stats.value = await getShiftStats(
        userId,
        yearMonth.value,
        resolvedStoreId != null ? { storeId: resolvedStoreId } : undefined,
      );
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  const triggerFetch = () => {
    fetchStats().catch(() => undefined);
  };

  watch(yearMonth, triggerFetch, { immediate: true });
  if (options?.storeId) {
    watch(options.storeId, triggerFetch);
  }
  if (options?.storeIdRequired) {
    watch(options.storeIdRequired, triggerFetch);
  }

  return { stats, loading, error, fetchStats };
};
