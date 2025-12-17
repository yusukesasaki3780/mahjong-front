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
import { getStoredIsAdmin, getStoredUserId, isApiClientError } from '../../api/axios';
import { getUser } from '../../api/users';
import ShiftDayCell from '../../components/shift/ShiftDayCell.vue';
import ShiftEditorDrawer from '../../components/shift/ShiftEditorDrawer.vue';
import ShiftWeekView from './ShiftWeekView.vue';
import ShiftStatsCard from '../../components/shift/ShiftStatsCard.vue';
import ShiftBoardTab from '../../components/shift/board/ShiftBoardTab.vue';
import type { ShiftBoardShift } from '../../api/shiftBoard';
import { useResponsive } from '../../composables/useResponsive';
import { resolveShiftStoreId } from '../../utils/shiftStore';
import {
  getNotifications,
  markNotificationRead,
  deleteNotification,
  type ShiftNotification,
} from '../../api/notifications';

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

const activeTab = ref<'month' | 'week' | 'board'>('month');
const calendarValue = ref(Date.now());
const monthShifts = ref<Record<string, Shift[]>>({});
const loadingMonth = ref(false);
const selectedDate = ref<string | null>(null);
const drawerVisible = ref(false);
const weekViewRef = ref<WeekViewExpose | null>(null);
const statsCardRef = ref<{ refetch: () => void } | null>(null);
const boardTabRef = ref<{ refresh: () => Promise<void> } | null>(null);
const weekYearMonth = ref(dayjs().format('YYYY-MM'));
const notifications = ref<ShiftNotification[]>([]);
const notificationsLoading = ref(false);

const currentMonthKey = computed(() => dayjs(calendarValue.value).format('YYYY-MM'));
const statsYearMonth = computed(() => (activeTab.value === 'month' ? currentMonthKey.value : weekYearMonth.value));
const monthLabelParts = computed(() => ({
  year: dayjs(calendarValue.value).format('YYYY年'),
  month: dayjs(calendarValue.value).format('M月'),
}));
const weekdayStrip = ['月', '火', '水', '木', '金', '土', '日'];
const today = dayjs().format('YYYY-MM-DD');
const isAdminUser = getStoredIsAdmin();

type DrawerContext =
  | {
      source: 'self';
      storeId: number | null;
    }
  | {
      source: 'board';
      userId: string;
      shifts: Shift[];
      storeId: number;
    };

const drawerContext = ref<DrawerContext | null>(null);
const selfStoreId = ref<number | null>(null);
const adminStoreId = computed<number | null>(() => {
  if (!isAdminUser) {
    return null;
  }
  try {
    return resolveShiftStoreId({
      role: 'ADMIN',
      selectedStoreId: selfStoreId.value,
      fallbackStoreId: selfStoreId.value,
    });
  } catch {
    return null;
  }
});

const loadSelfStoreId = async (): Promise<void> => {
  if (!userId) {
    return;
  }
  try {
    const profile = await getUser(userId);
    const rawStoreId = profile.storeId;
    selfStoreId.value =
      typeof rawStoreId === 'number' && !Number.isNaN(rawStoreId) ? rawStoreId : null;
  } catch (error) {
    console.error('Failed to load user profile storeId', error);
  }
};

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
type DrawerOpenPayload =
  | string
  | {
      date: string;
      shifts?: Shift[];
      userId?: string | null;
      source?: 'self' | 'board';
      storeId?: number | null;
    };

const openDrawer = (payload: DrawerOpenPayload): void => {
  let date: string;
  let shifts: Shift[] | undefined;
  let userId: string | null | undefined;
  let source: 'self' | 'board' = 'self';
  let storeIdParam: number | null = null;

  if (typeof payload === 'string') {
    date = payload;
  } else {
    date = payload.date;
    shifts = payload.shifts;
    userId = payload.userId;
    source = payload.source ?? (payload.userId ? 'board' : 'self');
    if (typeof payload.storeId === 'number' && !Number.isNaN(payload.storeId)) {
      storeIdParam = payload.storeId;
    }
  }

  selectedDate.value = date;
  let resolvedStoreId: number | null = null;
  if (source === 'board') {
    try {
      resolvedStoreId = resolveShiftStoreId({
        role: 'ADMIN',
        selectedStoreId: storeIdParam,
        fallbackStoreId: selfStoreId.value,
      });
    } catch (error) {
      notification.error({
        title: '店舗が特定できません',
        content: '対象店舗を選択してからシフトを編集してください。',
      });
      return;
    }
  }

  if (source === 'self' && shifts) {
    monthShifts.value[date] = shifts;
  }

  if (source === 'board' && userId && resolvedStoreId != null) {
    drawerContext.value = {
      source: 'board',
      userId,
      shifts: shifts ?? [],
      storeId: resolvedStoreId,
    };
  } else {
    drawerContext.value = {
      source: 'self',
      storeId: resolvedStoreId,
    };
  }
  drawerVisible.value = true;
};

// ドロワーを閉じる
const closeDrawer = (): void => {
  drawerVisible.value = false;
  drawerContext.value = null;
};

// 選択中の月のシフト情報を取得する
const loadMonth = async (): Promise<void> => {
  if (!userId) {
    notification.error({ title: '認証エラー', content: '再度ログインしてください。' });
    return;
  }
  if (isAdminUser && adminStoreId.value == null) {
    return;
  }
  loadingMonth.value = true;
  try {
    const storeOptions =
      isAdminUser && adminStoreId.value != null ? { storeId: adminStoreId.value } : undefined;
    const data = await getShifts(
      userId,
      { rangeType: 'month', yearMonth: currentMonthKey.value },
      storeOptions,
    );
    monthShifts.value = groupByDate(data);
  } catch (error) {
    const message = isApiClientError(error) ? error.message : 'シフトの取得に失敗しました';
    notification.error({ title: 'シフト管理', content: message });
  } finally {
    loadingMonth.value = false;
  }
};

watch(
  () => [currentMonthKey.value, adminStoreId.value],
  () => {
    void loadMonth();
  },
  { immediate: true },
);

onMounted(() => {
  void loadSelfStoreId();
  void loadNotifications();
});

// 月表示・週表示それぞれのデータをまとめて再取得する
const refreshAll = async (): Promise<void> => {
  await loadMonth();
  if (weekViewRef.value) {
    await weekViewRef.value.refresh();
  }
  statsCardRef.value?.refetch();
  if (boardTabRef.value) {
    await boardTabRef.value.refresh();
  }
  await loadNotifications();
};

const hasNotifications = computed(() => notifications.value.length > 0);

const loadNotifications = async (): Promise<void> => {
  notificationsLoading.value = true;
  try {
    notifications.value = await getNotifications({ onlyUnread: true });
  } catch (error) {
    console.error('Failed to load notifications', error);
    notification.error({
      title: '通知',
      content: isApiClientError(error) ? error.message : '通知の取得に失敗しました。',
    });
  } finally {
    notificationsLoading.value = false;
  }
};

const removeNotificationLocally = (id: ShiftNotification['id']) => {
  notifications.value = notifications.value.filter((item) => item.id !== id);
};

const handleNotificationRead = async (id: ShiftNotification['id']): Promise<void> => {
  try {
    await markNotificationRead(id);
    removeNotificationLocally(id);
    notification.success({ title: '通知', content: '通知を既読にしました。' });
  } catch (error) {
    notification.error({
      title: '通知',
      content: isApiClientError(error) ? error.message : '通知の更新に失敗しました。',
    });
  }
};

const handleNotificationDelete = async (id: ShiftNotification['id']): Promise<void> => {
  try {
    await deleteNotification(id);
    removeNotificationLocally(id);
    notification.success({ title: '通知', content: '通知を削除しました。' });
  } catch (error) {
    notification.error({
      title: '通知',
      content: isApiClientError(error) ? error.message : '通知の削除に失敗しました。',
    });
  }
};

const formatNotificationDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MM/DD HH:mm') : value;
};

// 週表示コンポーネントから渡される年月を統計カードに反映する
const handleWeekMonthChange = (yearMonth: string): void => {
  weekYearMonth.value = yearMonth;
};

const isMobile = computed(() => responsive.current.value === 'mobile');

const drawerShifts = computed<Shift[]>(() => {
  if (drawerContext.value?.source === 'board') {
    return drawerContext.value.shifts;
  }
  return selectedDate.value ? getShiftsByDate(selectedDate.value) : [];
});

const drawerUserIdOverride = computed(() =>
  drawerContext.value?.source === 'board' ? drawerContext.value.userId : null,
);

const drawerStoreIdOverride = computed<number | null>(() =>
  drawerContext.value?.source === 'board' ? drawerContext.value.storeId : null,
);

const handleBoardEditShift = (payload: {
  date: string;
  userId: string;
  storeId: number | null;
  shift?: ShiftBoardShift | null;
}): void => {
  let resolvedStoreId: number;
  try {
    resolvedStoreId = resolveShiftStoreId({
      role: 'ADMIN',
      selectedStoreId: payload.storeId,
      fallbackStoreId: selfStoreId.value,
    });
  } catch {
    notification.error({
      title: '店舗が特定できません',
      content: '対象店舗を選択してからシフトを編集してください。',
    });
    return;
  }

  const shifts: Shift[] =
    payload.shift && payload.shift.id
      ? [
          {
            id: payload.shift.id,
            userId: payload.userId,
            date: payload.shift.date,
            startTime: payload.shift.startTime,
            endTime: payload.shift.endTime,
            memo: payload.shift.memo ?? '',
          },
        ]
      : [];
  drawerContext.value = {
    source: 'board',
    userId: payload.userId,
    shifts,
    storeId: resolvedStoreId,
  };
  selectedDate.value = payload.date;
  drawerVisible.value = true;
};

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

      <div
        v-if="notificationsLoading || hasNotifications"
        class="notification-stack"
      >
        <n-card class="notification-card">
          <div class="notification-header">
            <div>
              <span class="notification-title">通知</span>
              <small v-if="notifications.length" class="notification-count">
                {{ notifications.length }}件
              </small>
            </div>
            <n-button text size="tiny" :loading="notificationsLoading" @click="loadNotifications">
              再読み込み
            </n-button>
          </div>
          <div v-if="notificationsLoading && !notifications.length" class="notification-loading">
            <n-skeleton text :repeat="2" />
          </div>
          <div v-else-if="!notifications.length" class="notification-empty">
            未読の通知はありません
          </div>
          <ul v-else class="notification-list">
            <li
              v-for="notificationItem in notifications"
              :key="notificationItem.id"
              class="notification-item"
            >
              <div class="notification-body">
                <p class="notification-message">{{ notificationItem.message }}</p>
                <div class="notification-meta">
                  <span class="notification-time">
                    {{ formatNotificationDate(notificationItem.createdAt) }}
                  </span>
                  <div class="notification-actions">
                    <n-button
                      text
                      size="tiny"
                      @click="handleNotificationRead(notificationItem.id)"
                    >
                      既読にする
                    </n-button>
                    <n-button
                      text
                      size="tiny"
                      type="error"
                      @click="handleNotificationDelete(notificationItem.id)"
                    >
                      削除
                    </n-button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </n-card>
      </div>

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
                  <div class="weekday-strip">
                    <span
                      v-for="label in weekdayStrip"
                      :key="label"
                      class="weekday-strip__item"
                      :class="{
                        weekend: label === '土' || label === '日',
                        sunday: label === '日'
                      }"
                    >
                      {{ label }}
                    </span>
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
                :store-id="adminStoreId"
                :store-id-required="Boolean(isAdminUser)"
                @select-date="openDrawer"
                @month-change="handleWeekMonthChange"
              />
            </n-tab-pane>

            <n-tab-pane name="board" tab="メンバー間シフト確認">
              <ShiftBoardTab
                ref="boardTabRef"
                :is-admin="Boolean(isAdminUser)"
                @edit-shift-request="handleBoardEditShift"
              />
            </n-tab-pane>
          </n-tabs>
        </n-card>

        <ShiftStatsCard
          class="stats-card"
          ref="statsCardRef"
          :year-month="statsYearMonth"
          :store-id="adminStoreId"
          :store-id-required="Boolean(isAdminUser)"
        />
      </div>

      <ShiftEditorDrawer
        :visible="drawerVisible"
        :date="selectedDate"
        :shifts="drawerShifts"
        :is-full-screen="isMobile"
        :user-id-override="drawerUserIdOverride"
        :store-id-override="drawerStoreIdOverride"
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
  margin: 0 0 8px;
  color: var(--color-subtle);
  font-size: 14px;
  margin-left: clamp(12px, 8vw, 160px);
  margin-right: clamp(12px, 4vw, 48px);
  max-width: 520px;
}

.shift-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.notification-stack {
  margin-left: clamp(12px, 8vw, 160px);
  margin-right: clamp(12px, 4vw, 48px);
}

.notification-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
}

.notification-count {
  margin-left: 8px;
  color: #94a3b8;
  font-size: 12px;
}

.notification-empty {
  font-size: 13px;
  color: #94a3b8;
}

.notification-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  background: #f8fafc;
}

.notification-message {
  margin: 0 0 8px;
  font-size: 14px;
  color: #0f172a;
  line-height: 1.4;
}

.notification-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.notification-actions {
  display: flex;
  gap: 8px;
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

.weekday-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: var(--color-subtle);
  padding: 0 8px;
  margin-bottom: 6px;
}

.weekday-strip__item.weekend {
  color: #dc2626;
}

.weekday-strip__item.sunday {
  color: #dc2626;
  font-weight: 600;
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
  display: none !important;
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
  display: flex;
  align-items: flex-start;
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

@media (max-width: 768px) {
  .subtitle {
    margin-left: clamp(12px, 6vw, 24px);
    margin-right: clamp(12px, 6vw, 24px);
    max-width: 100%;
  }
}
</style>
