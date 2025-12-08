<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { NBadge } from 'naive-ui';
import type { Shift } from '../../api/shifts';

const props = defineProps<{
  date: string;
  shifts: Shift[];
  isToday?: boolean;
  weekdayLabel?: string;
  showWeekdayLabel?: boolean;
  isWeekend?: boolean;
}>();
const emit = defineEmits<{ (e: 'select', payload: { date: string; shifts?: Shift[] }): void }>();

const safeDate = computed(() => (typeof props.date === 'string' ? props.date : ''));

const dayNumber = computed(() => {
  try {
    if (!safeDate.value) return '';
    const parts = safeDate.value.split('-');
    if (parts.length === 3) {
      const num = Number(parts[2]);
      return Number.isNaN(num) ? '' : num;
    }
    return safeDate.value;
  } catch {
    return '';
  }
});

const hasShifts = computed(() => props.shifts.length > 0);

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

const handleClick = (): void => {
  if (!safeDate.value) return;
  emit('select', { date: safeDate.value, shifts: props.shifts });
};
</script>

<template>
  <div class="day-cell" :class="{ today: isToday }" @click="handleClick">
    <div class="day-number">
      <small
        v-if="showWeekdayLabel"
        class="weekday-label"
        :class="{ weekend: isWeekend }"
      >
        {{ weekdayLabel }}
      </small>
      <n-badge v-if="hasShifts" dot type="success">
        <span>{{ dayNumber }}</span>
      </n-badge>
      <span v-else>{{ dayNumber }}</span>
    </div>
    <ul v-if="hasShifts" class="shift-list">
      <li v-for="shift in shifts" :key="shift.id">
        {{ formatTime(shift.startTime) }} - {{ formatTime(shift.endTime) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.day-cell {
  min-height: 80px;
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.day-cell:hover {
  background: rgba(16, 185, 129, 0.08);
}

.day-cell.today {
  border: 1px solid rgba(16, 185, 129, 0.8);
}

.day-number {
  font-weight: 600;
  margin-bottom: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weekday-label {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.weekday-label.weekend {
  color: #dc2626;
}

.shift-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  color: #475569;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
