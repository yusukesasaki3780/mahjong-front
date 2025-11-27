<script setup lang="ts">
import { computed, watch } from 'vue';
import { NCard, NStatistic, NIcon, useNotification } from 'naive-ui';
import { TimeOutline, MoonOutline, StatsChartOutline, CalendarOutline } from '@vicons/ionicons5';
import { useShiftStats } from '../../composables/useShiftStats';
import { isApiClientError } from '../../api/axios';

const props = defineProps<{ yearMonth: string }>();
const notification = useNotification();

const { stats, loading, error, fetchStats } = useShiftStats(computed(() => props.yearMonth));

watch(error, (err) => {
  if (!err) return;
  notification.error({
    title: 'Shift stats',
    content: isApiClientError(err) ? err.message : '勤務統計の取得に失敗しました',
  });
});

const cards = computed(() => [
  {
    title: '総勤務時間',
    icon: TimeOutline,
    value: stats.value?.totalHours ?? 0,
    suffix: 'h',
  },
  {
    title: '深夜時間',
    icon: MoonOutline,
    value: stats.value?.nightHours ?? 0,
    suffix: 'h',
  },
  {
    title: '平均勤務',
    icon: StatsChartOutline,
    value: stats.value?.avgHours ?? 0,
    suffix: 'h/shift',
  },
  {
    title: 'シフト件数',
    icon: CalendarOutline,
    value: stats.value?.count ?? 0,
    suffix: '件',
  },
]);

const refresh = (): void => {
  fetchStats().catch(() => undefined);
};

defineExpose({ refetch: refresh });
</script>

<template>
  <n-card title="勤務統計" size="small">
    <div class="stats-grid">
      <n-card
        v-for="card in cards"
        :key="card.title"
        size="small"
        :title="card.title"
        :loading="loading"
      >
        <div class="stat-item">
          <n-icon :component="card.icon" size="20" />
          <n-statistic :value="card.value" :suffix="card.suffix" />
        </div>
      </n-card>
    </div>
  </n-card>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
