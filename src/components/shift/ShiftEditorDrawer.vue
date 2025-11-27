<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NList,
  NListItem,
  useNotification,
  type FormInst,
} from 'naive-ui';
import dayjs from 'dayjs';
import {
  createShift,
  updateShift,
  deleteShift,
  type Shift,
  type ShiftBreak,
  type CreateShiftPayload,
} from '../../api/shifts';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import { extractErrorMessages } from '../../utils/validationMessages';

type BreakRange = { id: string; start: string; end: string };

const props = defineProps<{
  visible: boolean;
  date: string | null;
  shifts: Shift[];
  isFullScreen?: boolean;
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'refresh'): void }>();

const notification = useNotification();
const userId = getStoredUserId();
const formRef = ref<FormInst | null>(null);
const saving = ref(false);
const editingShiftId = ref<string | null>(null);
const existingBreakSummary = ref<number | null>(null);
const shiftFieldLabels = {
  date: '日付',
  startTime: '開始時間',
  endTime: '終了時間',
  breakMinutes: '休憩時間',
  breaks: '休憩時間',
  memo: 'メモ',
};

const createBreakRange = (): BreakRange => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  start: '',
  end: '',
});

const form = reactive({
  start: '09:00',
  end: '18:00',
  breaks: [createBreakRange()] as BreakRange[],
  memo: '',
});

const resetForm = (): void => {
  editingShiftId.value = null;
  form.start = '09:00';
  form.end = '18:00';
  form.breaks.splice(0, form.breaks.length, createBreakRange());
  existingBreakSummary.value = null;
  form.memo = '';
};

watch(
  () => props.date,
  () => {
    resetForm();
  },
);

const toInputTime = (value?: string): string => {
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

const formatDisplayTime = (value?: string): string => {
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

const selectShift = (shift: Shift): void => {
  editingShiftId.value = shift.id;
  form.start = toInputTime(shift.startTime);
  form.end = toInputTime(shift.endTime);

  if (Array.isArray(shift.breaks) && shift.breaks.length > 0) {
    form.breaks.splice(
      0,
      form.breaks.length,
      ...shift.breaks.map((item) => ({
        id: `${item.startTime}-${item.endTime}-${Math.random().toString(36).slice(2, 6)}`,
        start: toInputTime(item.startTime),
        end: toInputTime(item.endTime),
      })),
    );
  } else {
    form.breaks.splice(0, form.breaks.length, createBreakRange());
  }

  existingBreakSummary.value = shift.breakMinutes ?? null;
  form.memo = shift.memo ?? '';
};

const parseTimeToMinutes = (value: string): number | null => {
  if (!value) return null;
  if (value.includes('T')) {
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
      return null;
    }
    return parsed.hour() * 60 + parsed.minute();
  }
  const parts = value.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const ONE_DAY_MINUTES = 24 * 60;

const getBreakDuration = (range: BreakRange): number | null => {
  const start = parseTimeToMinutes(range.start);
  const end = parseTimeToMinutes(range.end);
  if (start === null || end === null) {
    return null;
  }
  let duration = end - start;
  if (duration <= 0) {
    duration += ONE_DAY_MINUTES;
  }
  return duration;
};

const totalBreakMinutes = computed(() =>
  form.breaks.reduce((sum, range) => {
    const duration = getBreakDuration(range);
    if (duration === null) {
      return sum;
    }
    return sum + duration;
  }, 0),
);

const getValidBreaks = (): ShiftBreak[] =>
  form.breaks
    .filter((range) => range.start && range.end)
    .map((range) => ({
      startTime: range.start,
      endTime: range.end,
    }));

const buildPayload = (): CreateShiftPayload => {
  if (!props.date) {
    throw new Error('日付が設定されていません');
  }

  const breaks = getValidBreaks();
  return {
    date: props.date,
    startTime: form.start,
    endTime: form.end,
    breakMinutes: totalBreakMinutes.value,
    memo: form.memo.trim() || undefined,
    breaks: breaks.length > 0 ? breaks : undefined,
  };
};

const validateBreaks = (): boolean => {
  const invalid = form.breaks.find((range) => {
    if (!range.start && !range.end) {
      return false;
    }
    const duration = getBreakDuration(range);
    return duration === null;
  });

  if (invalid) {
    notification.error({
      title: '休憩入力エラー',
      content: '休憩は開始・終了時刻を正しく入力してください（日付をまたぐ場合は終了が翌日でも構いません）。',
    });
    return false;
  }
  return true;
};

const addBreakRange = (): void => {
  form.breaks.push(createBreakRange());
};

const removeBreakRange = (id: string): void => {
  if (form.breaks.length === 1) {
    form.breaks.splice(0, 1, createBreakRange());
    return;
  }
  const index = form.breaks.findIndex((range) => range.id === id);
  if (index >= 0) {
    form.breaks.splice(index, 1);
  }
};

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value || !props.date) {
    return;
  }

  if (!userId) {
    notification.error({ title: 'Authentication', content: 'ログイン情報が取得できませんでした。' });
    return;
  }

  if (!validateBreaks()) {
    return;
  }

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    const payload = buildPayload();
    if (editingShiftId.value) {
      await updateShift(userId, editingShiftId.value, payload);
      notification.success({ title: 'シフト', content: 'シフトを更新しました。' });
    } else {
      await createShift(userId, payload);
      notification.success({ title: 'シフト', content: 'シフトを作成しました。' });
    }
    emit('refresh');
    resetForm();
  } catch (error) {
    const content = extractErrorMessages(error, {
      fieldLabels: shiftFieldLabels,
      fallbackMessage: 'シフトの保存に失敗しました。',
    }).join('\n');
    notification.error({
      title: 'シフトエラー',
      content,
    });
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (shiftId: string): Promise<void> => {
  if (!userId) {
    notification.error({ title: 'Authentication', content: 'ログイン情報が取得できませんでした。' });
    return;
  }

  try {
    await deleteShift(userId, shiftId);
    notification.success({ title: 'シフト', content: 'シフトを削除しました。' });
    emit('refresh');
    if (editingShiftId.value === shiftId) {
      resetForm();
    }
  } catch (error) {
    notification.error({
      title: 'シフトエラー',
      content: isApiClientError(error) ? error.message : 'シフトの削除に失敗しました。',
    });
  }
};

const closeDrawer = (): void => {
  emit('close');
};

const goBack = (): void => {
  closeDrawer();
};
</script>

<template>
  <n-drawer
    :show="visible"
    :placement="isFullScreen ? 'bottom' : 'right'"
    :width="isFullScreen ? '100%' : 480"
    :height="isFullScreen ? '100%' : undefined"
    @update:show="(val) => !val && closeDrawer()"
  >
    <n-drawer-content :native-scrollbar="false" title="シフト編集">
      <div class="back-row">
        <n-button tertiary size="small" @click="goBack">前の画面に戻る</n-button>
      </div>
      <template v-if="date">
        <p class="drawer-date">{{ date }}</p>
        <n-list bordered>
          <template v-if="shifts.length">
            <n-list-item v-for="shift in shifts" :key="shift.id" @click="selectShift(shift)">
              <div class="shift-item">
                <div>
                  <strong>{{ formatDisplayTime(shift.startTime) }} - {{ formatDisplayTime(shift.endTime) }}</strong>
                  <p class="shift-notes">{{ shift.memo || 'メモはありません' }}</p>
                </div>
                <n-button quaternary size="tiny" type="error" @click.stop="handleDelete(shift.id)">
                  削除
                </n-button>
              </div>
            </n-list-item>
          </template>
          <n-list-item v-else>
            <div class="empty">この日のシフトはありません</div>
          </n-list-item>
        </n-list>
      </template>

      <section class="form-section">
        <h3>{{ editingShiftId ? 'シフト編集' : 'シフト追加' }}</h3>
        <n-form ref="formRef" :model="form" label-placement="top">
          <n-form-item label="開始" path="start" :rule="{ required: true, message: '開始時刻を入力してください' }">
            <input v-model="form.start" type="time" class="time-input" />
          </n-form-item>
          <n-form-item label="終了" path="end" :rule="{ required: true, message: '終了時刻を入力してください' }">
            <input v-model="form.end" type="time" class="time-input" />
          </n-form-item>
        </n-form>

        <section class="break-section">
          <div class="breaks-header">
            <label>休憩</label>
            <n-button size="small" quaternary @click="addBreakRange">追加</n-button>
          </div>
          <p v-if="existingBreakSummary" class="break-summary">
            前回保存済みの休憩: {{ existingBreakSummary }} 分（旧データは自動変換されないため再入力してください）
          </p>
          <div v-for="range in form.breaks" :key="range.id" class="break-row">
            <input v-model="range.start" type="time" class="time-input" aria-label="休憩開始" />
            <span class="break-separator">~</span>
            <input v-model="range.end" type="time" class="time-input" aria-label="休憩終了" />
            <n-button
              circle
              quaternary
              size="small"
              class="break-remove"
              @click="removeBreakRange(range.id)"
            >
              削除
            </n-button>
          </div>
          <p class="break-total">総休憩: {{ totalBreakMinutes }} 分</p>
        </section>

        <n-form label-placement="top">
          <n-form-item label="メモ" path="memo">
            <n-input v-model:value="form.memo" type="textarea" rows="3" />
          </n-form-item>
        </n-form>

        <div class="drawer-actions">
          <n-button type="primary" :loading="saving" @click="handleSubmit">
            {{ editingShiftId ? '更新する' : '追加する' }}
          </n-button>
          <n-button quaternary @click="resetForm">クリア</n-button>
        </div>
      </section>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.drawer-date {
  font-weight: 600;
  margin-bottom: 12px;
}

.shift-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.back-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.shift-notes {
  font-size: 12px;
  color: #64748b;
  margin: 4 px 0 0;
}

.break-section {
  margin-top: 16px;
  padding: 12px;
  border: 1px dashed #cbd5f5;
  border-radius: 12px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breaks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.break-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.break-separator {
  color: #475569;
}

.break-remove {
  min-width: 0;
}

.break-total,
.break-summary {
  font-size: 12px;
  color: #475569;
}

.empty {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.form-section {
  margin-top: 24px;
}

.drawer-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.time-input {
  width: 100%;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
  height: 36px;
  padding: 0 12px;
}
</style>
