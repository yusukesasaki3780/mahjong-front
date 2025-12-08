<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { NBadge } from 'naive-ui';
import type { Shift } from '../../api/shifts';

const props = defineProps<{
  date: string;
  shifts: Shift[];
  isToday?: boolean;
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
  min-height: 100%;
  height: 100%;
  border-radius: 8px;
  padding: 6px 4px 4px;
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
  margin-bottom: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shift-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 11px;
  color: #475569;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 34px;
  overflow: hidden;
  width: 100%;
}

.shift-list li {
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
  width: 100%;
}
</style>
