<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NCard, NDivider, NScrollbar, useNotification } from 'naive-ui';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ja';
dayjs.locale('ja');
import { getWeekShifts, type Shift } from '../../api/shifts';
import { getStoredUserId, isApiClientError } from '../../api/axios';

const emit = defineEmits<{
  (e: 'select-date', payload: { date: string; shifts: Shift[] }): void;
  (e: 'month-change', payload: string): void;
}>();

const notification = useNotification();
const userId = getStoredUserId();
const referenceDate = ref<Dayjs>(dayjs());
const loading = ref(false);
const weekShifts = ref<Record<string, Shift[]>>({});
const weekdayShortLabels = ['日', '月', '火', '水', '木', '金', '土'];

const weekStart = computed<Dayjs>(() => referenceDate.value.startOf('week').add(1, 'day'));
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, idx) => weekStart.value.add(idx, 'day')),
);

const formatDateKey = (day: Dayjs): string => day.format('YYYY-MM-DD');

const formatTime = (value?: string): string => {
  if (!value) {
    return '';
  }
  if (value.includes('T')) {
    const parsed = dayjs(value);
    if (parsed.isValid()) {
      return parsed.format('HH:mm');
    }
  }
  return value.slice(0, 5);
};

const resolveShiftDate = (shift: Shift): string => {
  const source = shift.date ?? shift.startTime ?? shift.startDateTime ?? shift.endDateTime ?? '';
  const parsed = source ? dayjs(source) : dayjs();
  return parsed.format('YYYY-MM-DD');
};

const groupByDate = (shifts: Shift[]): Record<string, Shift[]> => {
  const grouped: Record<string, Shift[]> = {};
  shifts.forEach((shift) => {
    const key = resolveShiftDate(shift);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key]!.push(shift);
  });
  return grouped;
};

const fetchWeek = async (): Promise<void> => {
  if (!userId) {
    notification.error({ title: 'Authentication', content: 'Please sign in again.' });
    return;
  }
  loading.value = true;
  try {
    const start = weekStart.value;
    const end = start.add(6, 'day');
    const startKey = start.format('YYYY-MM-DD');
    const endKey = end.format('YYYY-MM-DD');
    const data = await getWeekShifts(userId, startKey, endKey);
    weekShifts.value = groupByDate(data);
    emit('month-change', start.format('YYYY-MM'));
  } catch (error) {
    notification.error({
      title: 'Shift week view',
      content: isApiClientError(error) ? error.message : 'Failed to load weekly shifts',
    });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchWeek().catch(() => undefined);
});

watch(
  () => referenceDate.value.valueOf(),
  () => {
    fetchWeek().catch(() => undefined);
  },
);

const selectDay = (day: Dayjs): void => {
  const date = formatDateKey(day);
  emit('select-date', { date, shifts: weekShifts.value[date] ?? [] });
};

const formatWeekdayLabel = (day: Dayjs): string => weekdayShortLabels[day.day()] ?? '';

const prevWeek = (): void => {
  referenceDate.value = referenceDate.value.subtract(1, 'week');
};
const nextWeek = (): void => {
  referenceDate.value = referenceDate.value.add(1, 'week');
};
const goToday = (): void => {
  referenceDate.value = dayjs();
};

defineExpose({ refresh: fetchWeek });
</script>

<template>
  <n-card class="week-card" :bordered="false">
    <div class="week-header">
      <div>
        <p class="label">週間カレンダー</p>
        <h3>
          {{ weekStart.format('YYYY/MM/DD') }} -
          {{ weekStart.add(6, 'day').format('MM/DD') }}
        </h3>
      </div>
      <div class="actions">
        <n-button size="small" quaternary @click="goToday">今週</n-button>
        <n-button size="small" tertiary @click="prevWeek">前週</n-button>
        <n-button size="small" tertiary @click="nextWeek">翌週</n-button>
      </div>
    </div>

    <n-divider />

    <n-scrollbar class="week-scroll">
      <div class="week-grid">
        <div
          v-for="day in weekDays"
          :key="day.toISOString()"
          class="week-day"
          @click="selectDay(day)"
        >
          <p class="week-day__label">
            {{ formatWeekdayLabel(day) }}
         </p>
          <p class="week-day__date">{{ day.format('MM/DD') }}</p>
          <ul class="week-day__shifts">
            <li v-for="shift in weekShifts[formatDateKey(day)] || []" :key="shift.id">
              {{ formatTime(shift.startTime) }} - {{ formatTime(shift.endTime) }}
            </li>
            <li v-if="!(weekShifts[formatDateKey(day)] || []).length" class="empty">
              未登録
            </li>
          </ul>
        </div>
      </div>
    </n-scrollbar>
    <div v-if="loading" class="loading">週間シフトを読み込み中…</div>
  </n-card>
</template>

<style scoped>
.week-card {
  min-height: 420px;
  width: 100%;
  overflow: hidden;
}

.week-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.week-header h3 {
  margin: 0;
}

.label {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1 1 160px;
}

.week-scroll {
  max-height: 420px;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  width: 100%;
}

.week-day {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
}

.week-day__label {
  margin: 0;
  font-weight: 600;
  color: #10b981;
}

.week-day__date {
  margin: 0 0 8px;
  font-size: 13px;
  color: #475569;
}

.week-day__shifts {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
  color: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.week-day__shifts .empty {
  color: #94a3b8;
}

.loading {
  margin-top: 12px;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
}

@media (max-width: 520px) {
  .week-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>





