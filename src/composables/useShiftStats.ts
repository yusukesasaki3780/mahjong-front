import { ref, watch, type Ref } from 'vue';
import { getShiftStats, type ShiftStatsSummary } from '../api/shifts';
import { getStoredUserId } from '../api/axios';

export const useShiftStats = (yearMonth: Ref<string>) => {
  const stats = ref<ShiftStatsSummary | null>(null);
  const loading = ref(false);
  const error = ref<unknown>(null);
  const userId = getStoredUserId();

  const fetchStats = async (): Promise<void> => {
    if (!userId) {
      error.value = new Error('Please sign in again.');
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      stats.value = await getShiftStats(userId, yearMonth.value);
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  watch(
    yearMonth,
    () => {
      fetchStats().catch(() => undefined);
    },
    { immediate: true },
  );

  return { stats, loading, error, fetchStats };
};
