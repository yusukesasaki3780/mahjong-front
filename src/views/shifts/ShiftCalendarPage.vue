<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  useNotification,
  NCard,
  NCalendar,
  NSkeleton,
  NTabs,
  NTabPane,
  NConfigProvider,
  dateJaJP,
  jaJP,
} from 'naive-ui';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import updateLocale from 'dayjs/plugin/updateLocale';
import AppPageHeader from '../../components/common/AppPageHeader.vue';
import { getShifts, type Shift } from '../../api/shifts';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import ShiftDayCell from '../../components/shift/ShiftDayCell.vue';
import ShiftEditorDrawer from '../../components/shift/ShiftEditorDrawer.vue';
import ShiftWeekView from './ShiftWeekView.vue';
import ShiftStatsCard from '../../components/shift/ShiftStatsCard.vue';
import { useResponsive } from '../../composables/useResponsive';

type WeekViewExpose = {
  refresh: () => Promise<void>;
};

const notification = useNotification();
const responsive = useResponsive();
const userId = getStoredUserId();

dayjs.extend(updateLocale);
dayjs.updateLocale('ja', {
  weekdays: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  weekdaysShort: ['日', '月', '火', '水', '木', '金', '土'],
  weekdaysMin: ['日', '月', '火', '水', '木', '金', '土'],
});
dayjs.locale('ja');

const activeTab = ref<'month' | 'week'>('month');
const calendarValue = ref(Date.now());
const monthShifts = ref<Record<string, Shift[]>>({});
const loadingMonth = ref(false);
const selectedDate = ref<string | null>(null);
const drawerVisible = ref(false);
const weekViewRef = ref<WeekViewExpose | null>(null);
const statsCardRef = ref<{ refetch: () => void } | null>(null);
const weekYearMonth = ref(dayjs().format('YYYY-MM'));

const currentMonthKey = computed(() => dayjs(calendarValue.value).format('YYYY-MM'));
const statsYearMonth = computed(() => (activeTab.value === 'month' ? currentMonthKey.value : weekYearMonth.value));
const monthLabelParts = computed(() => ({
  year: dayjs(calendarValue.value).format('YYYY年'),
  month: dayjs(calendarValue.value).format('M月'),
}));
const today = dayjs().format('YYYY-MM-DD');

// さまざまな日付文字列を YYYY-MM-DD の正規化した形式に変換する
const normalizeDateString = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = dayjs(trimmed);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
};

// シフト1件から最適な日付情報を抽出する
const resolveShiftDate = (shift: Shift): string => {
  const direct = normalizeDateString(shift.date) ?? normalizeDateString(shift.workDate);
  if (direct) return direct;
  const fromStart = normalizeDateString(shift.startDateTime);
  if (fromStart) return fromStart;
  const fromEnd = normalizeDateString(shift.endDateTime);
  if (fromEnd) return fromEnd;
  return '';
};

// 取得したシフトを日付ごとにグルーピングする
const groupByDate = (shifts: Shift[]): Record<string, Shift[]> => {
  const grouped: Record<string, Shift[]> = {};
  shifts.forEach((shift) => {
    const key = resolveShiftDate(shift);
    if (!key) return;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key]!.push(shift);
  });
  return grouped;
};

// 指定日付のシフト一覧を取得する
const getShiftsByDate = (date: string): Shift[] => monthShifts.value[date] ?? [];
// 今日かどうかを判定する
const isToday = (date: string): boolean => date === today;

// 日付セル選択時にドロワーを開く
const openDrawer = (payload: { date: string; shifts?: Shift[] } | string): void => {
  if (typeof payload === 'string') {
    selectedDate.value = payload;
  } else {
    selectedDate.value = payload.date;
    if (payload.shifts) {
      monthShifts.value[payload.date] = payload.shifts;
    }
  }
  drawerVisible.value = true;
};

// ドロワーを閉じる
const closeDrawer = (): void => {
  drawerVisible.value = false;
};

// 選択中の月のシフト情報を取得する
const loadMonth = async (): Promise<void> => {
  if (!userId) {
    notification.error({ title: '認証エラー', content: '再度ログインしてください。' });
    return;
  }
  loadingMonth.value = true;
  try {
    const data = await getShifts(userId, { rangeType: 'month', yearMonth: currentMonthKey.value });
    monthShifts.value = groupByDate(data);
  } catch (error) {
    const message = isApiClientError(error) ? error.message : 'シフトの取得に失敗しました';
    notification.error({ title: 'シフト管理', content: message });
  } finally {
    loadingMonth.value = false;
  }
};

watch(
  () => currentMonthKey.value,
  () => {
    void loadMonth();
  },
  { immediate: true },
);

onMounted(() => {
  void loadMonth();
});

// 月表示・週表示それぞれのデータをまとめて再取得する
const refreshAll = async (): Promise<void> => {
  await loadMonth();
  if (weekViewRef.value) {
    await weekViewRef.value.refresh();
  }
  statsCardRef.value?.refetch();
};

// 週表示コンポーネントから渡される年月を統計カードに反映する
const handleWeekMonthChange = (yearMonth: string): void => {
  weekYearMonth.value = yearMonth;
};

const isMobile = computed(() => responsive.current.value === 'mobile');

type CalendarSlotProps = {
  year?: number;
  month?: number;
  date?: number;
  [key: string]: unknown;
};

// 表示用の年月日情報から YYYY-MM-DD 文字列を生成する
const formatFromParts = (year: number, monthIndex: number, day: number): string => {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');
  return dayjs(`${year}-${month}-${date}`).format('YYYY-MM-DD');
};

// カレンダースロットが保持する情報から日付文字列を決定する
const resolveDate = (slotProps: CalendarSlotProps): string => {
  if (typeof slotProps?.year === 'number' && typeof slotProps?.month === 'number' && typeof slotProps?.date === 'number') {
    const monthIndex = Math.max(0, slotProps.month - 1);
    return formatFromParts(slotProps.year, monthIndex, slotProps.date);
  }
  const base = dayjs(calendarValue.value);
  return formatFromParts(base.year(), base.month(), base.date());
};

// ShiftDayCell に渡すプロパティを構築する
const buildCellProps = (slotProps: CalendarSlotProps) => {
  const date = resolveDate(slotProps);
  return {
    date,
    shifts: getShiftsByDate(date),
    isToday: isToday(date),
  };
};

// カレンダーで日付が選択された際にドロワーを開く
const handleDateSelect = (value: number): void => {
  calendarValue.value = value;
  const date = dayjs(value).format('YYYY-MM-DD');
  openDrawer(date);
};

// カレンダーの月が切り替わったときにデータを再取得する
const handlePanelChange = (panel: { year: number; month: number }): void => {
  const next = dayjs(calendarValue.value).year(panel.year).month(panel.month - 1);
  calendarValue.value = next.valueOf();
  void loadMonth();
  statsCardRef.value?.refetch();
};

// 一ヶ月前へ移動してシフトを読み込む
const goPrevMonth = (): void => {
  calendarValue.value = dayjs(calendarValue.value).subtract(1, 'month').valueOf();
  void loadMonth();
  statsCardRef.value?.refetch();
};

// 一ヶ月先へ移動してシフトを読み込む
const goNextMonth = (): void => {
  calendarValue.value = dayjs(calendarValue.value).add(1, 'month').valueOf();
  void loadMonth();
  statsCardRef.value?.refetch();
};

// 今日の日付にジャンプして最新データを読み込む
const goToday = (): void => {
  calendarValue.value = dayjs().valueOf();
  void loadMonth();
  statsCardRef.value?.refetch();
};

const calendarLocale = dateJaJP;
const uiLocale = jaJP;
</script>

<template>
  <n-config-provider :locale="uiLocale" :date-locale="calendarLocale">
    <div class="shift-page app-page">
      <AppPageHeader title="シフト管理" back-to="/dashboard" />
      <p class="subtitle">月表示・週表示を切り替えてシフトを確認・編集できます。</p>

      <div class="shift-stack">
        <n-card class="calendar-card">
          <n-tabs v-model:value="activeTab" type="line">
            <n-tab-pane name="month" tab="月表示">
              <div v-if="loadingMonth" class="skeleton-wrapper">
                <n-skeleton text :repeat="4" />
              </div>
              <n-calendar
                v-else
                v-model:value="calendarValue"
                size="large"
                value-format="timestamp"
                :locale="uiLocale"
                :date-locale="calendarLocale"
                @update:value="handleDateSelect"
                @panel-change="handlePanelChange"
              >
                <template #header>
                  <div class="month-controls">
                    <div class="month-label">
                      <span class="month-label__year">{{ monthLabelParts.year }}</span>
                      <span class="month-label__separator">/</span>
                      <span class="month-label__month">{{ monthLabelParts.month }}</span>
                    </div>
                    <div class="month-actions">
                      <button class="month-button" type="button" @click="goPrevMonth">前月</button>
                      <button class="month-button today" type="button" @click="goToday">今日</button>
                      <button class="month-button" type="button" @click="goNextMonth">翌月</button>
                    </div>
                  </div>
                </template>
                <template #default="slotProps">
                  <ShiftDayCell v-bind="buildCellProps(slotProps as CalendarSlotProps)" @select="openDrawer" />
                </template>
              </n-calendar>
            </n-tab-pane>

            <n-tab-pane name="week" tab="週表示">
              <ShiftWeekView
                ref="weekViewRef"
                @select-date="openDrawer"
                @month-change="handleWeekMonthChange"
              />
            </n-tab-pane>
          </n-tabs>
        </n-card>

        <ShiftStatsCard class="stats-card" ref="statsCardRef" :year-month="statsYearMonth" />
      </div>

      <ShiftEditorDrawer
        :visible="drawerVisible"
        :date="selectedDate"
        :shifts="selectedDate ? getShiftsByDate(selectedDate) : []"
        :is-full-screen="isMobile"
        @close="closeDrawer"
        @refresh="refreshAll"
      />
    </div>
  </n-config-provider>
</template>

<style scoped>
.shift-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 32px;
  overflow-x: hidden;
}

.subtitle {
  margin: 0;
  color: var(--color-subtle);
  font-size: 14px;
}

.shift-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.calendar-card {
  padding: 8px;
  width: 100%;
  height: auto;
  overflow-x: hidden;
}

.stats-card {
  padding: 0;
  width: 100%;
}

.month-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px 8px;
  gap: 12px;
}

.month-label {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-weight: 600;
  font-size: 18px;
  white-space: nowrap;
}

.month-label__separator {
  font-size: 12px;
  color: var(--color-subtle);
}

.month-actions {
  display: flex;
  gap: 8px;
}

.month-button {
  border: 1px solid rgba(45, 101, 255, 0.3);
  background: #fff;
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  min-width: 64px;
}

.month-button.today {
  border-color: var(--color-brand);
  color: var(--color-brand);
}

:deep(.n-calendar) {
  width: 100%;
  height: auto !important;
  padding: 0 4px 8px;
}

:deep(.n-calendar-dates) {
  height: auto !important;
  gap: 2px;
}

:deep(.n-calendar-weekdays) {
  padding: 0 4px 4px;
  font-size: 12px;
}

:deep(.n-calendar-date__date),
:deep(.n-calendar-date__day) {
  display: none !important;
}

:deep(.n-calendar-header__extra) {
  display: none !important;
}

:deep(.n-calendar-cell) {
  padding: 2px;
  height: 56px !important;
  min-height: 56px;
}

:deep(.day-cell) {
  min-height: 52px;
  padding: 4px;
}

:deep(.day-number) {
  font-size: 13px;
}

:deep(.shift-list) {
  font-size: 11px;
}

.skeleton-wrapper {
  padding: 16px;
}

@media (min-width: 900px) {
  .shift-stack {
    flex-direction: row;
    align-items: flex-start;
  }

  .calendar-card {
    flex: 1 1 60%;
  }

  .stats-card {
    width: 320px;
  }
}
</style>
