<script setup lang="ts">
// シフトの新規作成や編集を行うドロワーフォームを提供するコンポーネントです。
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NList,
  NListItem,
  NRadio,
  NRadioGroup,
  NSelect,
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
import { getSpecialHourlyWages, type SpecialHourlyWage } from '../../api/specialWages';

type BreakRange = { id: string; start: string; end: string };
// 勤務帯を一意に表す識別子です。
type WorkTypeValue =
  | 'EARLY_FULL'
  | 'EARLY_HALF_1'
  | 'EARLY_HALF_2'
  | 'LATE_FULL'
  | 'LATE_HALF_1'
  | 'LATE_HALF_2';

// 勤務帯ごとの表示ラベルと開始・終了時刻プリセットです。
const WORK_TYPES: { value: WorkTypeValue; label: string; start: string; end: string }[] = [
  { value: 'EARLY_FULL', label: '早〇 (10:00-22:00)', start: '10:00', end: '22:00' },
  { value: 'EARLY_HALF_1', label: '早ハーフ1 (10:00-17:00)', start: '10:00', end: '17:00' },
  { value: 'EARLY_HALF_2', label: '早ハーフ2 (17:00-22:00)', start: '17:00', end: '22:00' },
  { value: 'LATE_FULL', label: '遅〇 (22:00-10:00)', start: '22:00', end: '10:00' },
  { value: 'LATE_HALF_1', label: '遅ハーフ1 (22:00-05:00)', start: '22:00', end: '05:00' },
  { value: 'LATE_HALF_2', label: '遅ハーフ2 (05:00-10:00)', start: '05:00', end: '10:00' },
];
// 勤務帯識別子から即座に時間帯を参照できるマップです。
const WORK_TYPE_MAP = WORK_TYPES.reduce<Record<WorkTypeValue, { start: string; end: string }>>((acc, type) => {
  acc[type.value] = { start: type.start, end: type.end };
  return acc;
}, {} as Record<WorkTypeValue, { start: string; end: string }>);
// セレクトコンポーネントに渡す勤務帯オプションです。
const WORK_TYPE_SELECT_OPTIONS = WORK_TYPES.map((type) => ({
  label: type.label,
  value: type.value,
}));

const props = defineProps<{
  visible: boolean;
  date: string | null;
  shifts: Shift[];
  isFullScreen?: boolean;
  userIdOverride?: string | null;
  storeIdOverride?: number | null;
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'refresh'): void }>();

const notification = useNotification();
const storedUserId = getStoredUserId();
// 操作対象となるユーザーIDを props と保存済みIDから解決
const activeUserId = computed(() => props.userIdOverride ?? storedUserId);
const formRef = ref<FormInst | null>(null);
const saving = ref(false);
const editingShiftId = ref<string | null>(null);
const existingBreakSummary = ref<number | null>(null);
const specialWages = ref<SpecialHourlyWage[]>([]);
const specialWagesLoading = ref(false);
const SPECIAL_WAGE_NONE = null as unknown as number;
// バリデーションエラー表示に使うフィールド名
const shiftFieldLabels = {
  date: '日付',
  startTime: '開始時間',
  endTime: '終了時間',
  breakMinutes: '休憩時間',
  breaks: '休憩時間',
  memo: 'メモ',
};

// 休憩入力行用の空データを生成
const createBreakRange = (): BreakRange => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  start: '',
  end: '',
});

// ドロワーフォーム全体の状態
const form = reactive({
  start: '09:00',
  end: '18:00',
  breaks: [createBreakRange()] as BreakRange[],
  memo: '',
});
const selectedSpecialWageId = ref<number | null>(null);
const selectedWorkType = ref<WorkTypeValue | null>(null);
let isApplyingWorkType = false;

// 店舗を指定する必要がある場合に API オプションを組み立てる
const getStoreRequestOptions = (): { storeId: number } | undefined => {
  if (typeof props.storeIdOverride === 'number' && !Number.isNaN(props.storeIdOverride)) {
    return { storeId: Number(props.storeIdOverride) };
  }
  return undefined;
};

// ネストしたレスポンスから時間帯重複エラーを探索
const containsOverlapError = (source: unknown): boolean => {
  if (!source) {
    return false;
  }
  if (Array.isArray(source)) {
    return source.some((item) => containsOverlapError(item));
  }
  if (typeof source === 'object') {
    const record = source as Record<string, unknown>;
    const field = typeof record.field === 'string' ? record.field : undefined;
    const code = typeof record.code === 'string' ? record.code : undefined;
    if (field === 'timeRange' && code === 'OVERLAP') {
      return true;
    }
    return Object.values(record).some((value) => containsOverlapError(value));
  }
  return false;
};

// API エラーが時間帯重複かどうか判定
const isOverlapTimeRangeError = (error: unknown): boolean => {
  if (!isApiClientError(error)) {
    return false;
  }
  return containsOverlapError(error.details);
};

// 編集対象や入力値を初期状態に戻す
const resetForm = (): void => {
  editingShiftId.value = null;
  form.start = '09:00';
  form.end = '18:00';
  form.breaks.splice(0, form.breaks.length, createBreakRange());
  existingBreakSummary.value = null;
  form.memo = '';
  selectedSpecialWageId.value = null;
  selectedWorkType.value = null;
};

// 特別手当のマスタ一覧を取得しフォームに反映
const fetchSpecialWages = async (): Promise<void> => {
  specialWagesLoading.value = true;
  try {
    specialWages.value = await getSpecialHourlyWages();
    if (
      selectedSpecialWageId.value !== null &&
      !specialWages.value.some((item) => item.id === selectedSpecialWageId.value)
    ) {
      selectedSpecialWageId.value = null;
    }
  } catch (error) {
    notification.error({
      title: '特別手当',
      content: isApiClientError(error) ? error.message : '特別手当の取得に失敗しました。',
    });
  } finally {
    specialWagesLoading.value = false;
  }
};

watch(
  () => props.date,
  () => {
    resetForm();
  },
);

onMounted(() => {
  fetchSpecialWages().catch(() => undefined);
});

watch(selectedWorkType, (value) => {
  if (!value) {
    return;
  }
  const preset = WORK_TYPE_MAP[value];
  if (preset) {
    isApplyingWorkType = true;
    form.start = preset.start;
    form.end = preset.end;
    isApplyingWorkType = false;
  }
});

watch<[string, string]>(
  () => [form.start, form.end],
  ([start, end]) => {
    if (isApplyingWorkType) {
      return;
    }
    const matched = matchWorkType(start, end);
    selectedWorkType.value = matched;
  },
);

// サーバー値を入力用のHH:mmへ整形
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

// 画面表示用にHH:mmへ整形
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

// 現在の時間帯がどの勤務帯プリセットに該当するか判定
const matchWorkType = (start: string, end: string): WorkTypeValue | null => {
  const matched = WORK_TYPES.find((type) => type.start === start && type.end === end);
  return matched ? matched.value : null;
};

// 既存シフトをクリックした際にフォームへ値を流し込む
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
  const incomingSpecialId =
    (shift as Shift & { specialWageId?: number | null }).specialWageId ??
    shift.specialHourlyWageId ??
    null;
  selectedSpecialWageId.value = typeof incomingSpecialId === 'number' ? incomingSpecialId : null;
  selectedWorkType.value = matchWorkType(form.start, form.end);
};

// 入力値を分単位に変換し計算しやすくする
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

// 単一休憩の長さを算出（翌日跨ぎは24h加算）
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

// 休憩の合計分数を返す算出プロパティ
const totalBreakMinutes = computed(() =>
  form.breaks.reduce((sum, range) => {
    const duration = getBreakDuration(range);
    if (duration === null) {
      return sum;
    }
    return sum + duration;
  }, 0),
);

// 入力がそろった休憩だけをAPI送信用に整形
const getValidBreaks = (): ShiftBreak[] =>
  form.breaks
    .filter((range) => range.start && range.end)
    .map((range) => ({
      startTime: range.start,
      endTime: range.end,
    }));

// API へ送るシフト登録ペイロードを作成
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
    specialHourlyWageId: selectedSpecialWageId.value ?? null,
    specialWageId: selectedSpecialWageId.value ?? null,
  };
};

// 休憩入力の整合性チェックを行いエラーを通知
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

// 休憩行を追加
const addBreakRange = (): void => {
  form.breaks.push(createBreakRange());
};

// 指定IDの休憩行を削除（最低1行は残す）
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


// フォーム検証後にシフトを保存して一覧を更新
const handleSubmit = async (): Promise<void> => {
  if (!formRef.value || !props.date) {
    return;
  }

  const targetUserId = activeUserId.value;
  if (!targetUserId) {
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

  const storeOptions = getStoreRequestOptions();

  saving.value = true;
  try {
    const payload = buildPayload();
    if (editingShiftId.value) {
      await updateShift(targetUserId, editingShiftId.value, payload, storeOptions);
      notification.success({ title: 'シフト', content: 'シフトを更新しました。' });
    } else {
      await createShift(targetUserId, payload, storeOptions);
      notification.success({ title: 'シフト', content: 'シフトを作成しました。' });
    }
    emit('refresh');
    resetForm();
  } catch (error) {
    if (isOverlapTimeRangeError(error)) {
      notification.error({
        title: 'シフトエラー',
        content: '同じ日に時間が重複するシフトは登録できません',
      });
    } else {
      const content = extractErrorMessages(error, {
        fieldLabels: shiftFieldLabels,
        fallbackMessage: 'シフトの保存に失敗しました。',
      }).join('\n');
      notification.error({
        title: 'シフトエラー',
        content,
      });
    }
  } finally {
    saving.value = false;
  }
};

// 選択したシフトを削除し編集状態をリセット
const handleDelete = async (shiftId: string): Promise<void> => {
  const targetUserId = activeUserId.value;
  if (!targetUserId) {
    notification.error({ title: 'Authentication', content: 'ログイン情報が取得できませんでした。' });
    return;
  }

  const storeOptions = getStoreRequestOptions();

  try {
    await deleteShift(targetUserId, shiftId, storeOptions);
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

// 親へ close イベントを通知
const closeDrawer = (): void => {
  emit('close');
};

// 「戻る」ボタン押下時の処理（実質クローズ）
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
                <n-button
                  quaternary
                  size="tiny"
                  type="error"
                  @click.stop="handleDelete(shift.id)"
                >
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
          <n-form-item label="勤務タイプ">
            <n-select
              v-model:value="selectedWorkType"
              :options="WORK_TYPE_SELECT_OPTIONS"
              placeholder="勤務タイプを選択"
              clearable
            />
          </n-form-item>
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

        <section class="special-wage-section">
          <div class="special-wage-header">
            <label>特別手当</label>
            <n-button size="tiny" quaternary :loading="specialWagesLoading" @click="fetchSpecialWages">
              再読み込み
            </n-button>
          </div>
          <div v-if="specialWagesLoading" class="special-wage-hint">読み込み中です…</div>
          <n-radio-group v-model:value="selectedSpecialWageId" name="special-wage">
            <n-radio :value="SPECIAL_WAGE_NONE" class="special-wage-option">特別手当なし</n-radio>
            <n-radio
              v-for="wage in specialWages"
              :key="wage.id"
              :value="wage.id"
              class="special-wage-option"
            >
              {{ wage.label }}（{{ wage.hourlyWage.toLocaleString() }}円）
            </n-radio>
          </n-radio-group>
          <p v-if="!specialWagesLoading && !specialWages.length" class="special-wage-hint">
            ゲーム設定から特別手当を追加するとここに表示されます。
          </p>
        </section>

        <n-form label-placement="top">
          <n-form-item label="メモ" path="memo">
            <n-input v-model:value="form.memo" type="textarea" rows="3" />
          </n-form-item>
        </n-form>

        <div class="drawer-actions">
          <n-button
            type="primary"
            :loading="saving"
            :disabled="saving"
            @click="handleSubmit"
          >
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

.special-wage-section {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.special-wage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.special-wage-option {
  display: block;
  margin-top: 6px;
}

.special-wage-hint {
  font-size: 12px;
  color: #64748b;
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
