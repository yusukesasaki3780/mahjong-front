<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NButton,
  NButtonGroup,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpin,
  useDialog,
  useMessage,
  useNotification,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui';
import {
  createGameResult,
  deleteGameResult,
  getGameResult,
  updateGameResult,
} from '../../api/gameResultApi';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import type { GameType } from '../../types/gameResult';
import { getGameSettings, type GameSettings } from '../../api/gameSettingsApi';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

const route = useRoute();
const router = useRouter();
const dialog = useDialog();
const message = useMessage();
const notification = useNotification();

const isEdit = computed(() => route.name === 'results-edit');
const resultId = computed(() => (isEdit.value ? (route.params.id as string) : null));
const userId = getStoredUserId();
if (!userId) {
  router.replace('/login');
}

const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const submitting = ref(false);
const deleting = ref(false);
const loadingSettings = ref(false);

interface ResultFormState {
  gameType: GameType;
  playedAt: number | null;
  place: number;
  baseIncome: number;
  tipCount: number;
  tipIncome: number;
  totalIncome: number;
  note: string;
}

const createInitialState = (): ResultFormState => ({
  gameType: 'YONMA',
  playedAt: dayjs().startOf('day').valueOf(),
  place: 1,
  baseIncome: 0,
  tipCount: 0,
  tipIncome: 0,
  totalIncome: 0,
  note: '',
});

const formValue = reactive<ResultFormState>(createInitialState());
const settings = ref<GameSettings | null>(null);
const currentYonmaGameFee = computed(() => settings.value?.yonmaGameFee ?? 0);
const currentSanmaGameFee = computed(() => settings.value?.sanmaGameFee ?? 0);
const currentSanmaGameFeeBack = computed(() => settings.value?.sanmaGameFeeBack ?? 0);
const showSanmaGameFeeBack = computed(() => formValue.gameType === 'SANMA');
const sanmaGameFeeBackDisplay = computed(() => (showSanmaGameFeeBack.value ? currentSanmaGameFeeBack.value : 0));
const baseIncomeSign = ref<1 | -1>(1);

const gameTypeOptions: SelectOption[] = [
  { label: '四麻', value: 'YONMA' },
  { label: '三麻', value: 'SANMA' },
];

const placeOptions = computed<SelectOption[]>(() => {
  const max = formValue.gameType === 'SANMA' ? 3 : 4;
  return Array.from({ length: max }, (_, index) => {
    const value = index + 1;
    return { label: `${value}位`, value };
  });
});

const validateNotFutureDate = (_rule: unknown, value: number | null) => {
  if (value == null) return Promise.resolve();
  const picked = dayjs(value).startOf('day');
  if (picked.isAfter(dayjs().startOf('day'))) {
    return Promise.reject(new Error('未来の日付は登録できません'));
  }
  return Promise.resolve();
};

const rules: FormRules = {
  gameType: [{ required: true, message: '種別を選択してください', trigger: 'change' }],
  playedAt: [
    { required: true, type: 'number', message: '対局日を入力してください', trigger: 'change' },
    { validator: validateNotFutureDate, trigger: 'change' },
  ],
  place: [{ required: true, type: 'number', message: '着順を入力してください', trigger: 'change' }],
  baseIncome: [{ required: true, type: 'number', message: 'ベース収入を入力してください', trigger: 'blur' }],
  tipCount: [{ required: true, type: 'number', message: 'チップ枚数を入力してください', trigger: 'blur' }],
};

const notifyError = (error: unknown, fallback: string): void => {
  const description = isApiClientError(error) ? error.message : fallback;
  notification.error({ title: 'エラー', content: description });
};

const coerceNumber = (value: number | null | undefined, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const hydrateForm = (payload: Partial<ResultFormState>) => {
  formValue.gameType = payload.gameType ?? formValue.gameType;
  formValue.playedAt = payload.playedAt ?? formValue.playedAt;
  formValue.place = coerceNumber(payload.place, formValue.place);
  formValue.baseIncome = coerceNumber(payload.baseIncome);
  formValue.tipCount = coerceNumber(payload.tipCount);
  formValue.tipIncome = coerceNumber(payload.tipIncome);
  formValue.totalIncome = coerceNumber(payload.totalIncome);
  formValue.note = payload.note ?? '';
};

const fetchDetail = async (): Promise<void> => {
  if (!userId || !resultId.value) {
    return;
  }
  loading.value = true;
  try {
    const result = await getGameResult(userId, resultId.value);
    hydrateForm({
      gameType: result.gameType,
      playedAt: dayjs(result.playedAt).valueOf(),
      place: result.place ?? undefined,
      baseIncome: result.baseIncome ?? undefined,
      tipCount: result.tipCount ?? undefined,
      tipIncome: result.tipIncome ?? undefined,
      totalIncome: result.totalIncome ?? undefined,
      note: result.note ?? '',
    });
  } catch (error) {
    notifyError(error, '成績の取得に失敗しました');
  } finally {
    loading.value = false;
  }
};

const fetchSettings = async (): Promise<void> => {
  if (!userId) {
    return;
  }
  loadingSettings.value = true;
  try {
    settings.value = await getGameSettings(userId);
  } catch (error) {
    notifyError(error, 'ゲーム設定の取得に失敗しました（デフォルト単価を使用します）');
    settings.value = null;
  } finally {
    loadingSettings.value = false;
  }
};

onMounted(() => {
  fetchSettings().catch(() => undefined);
  if (isEdit.value) {
    fetchDetail().catch(() => undefined);
  }
});

const currentTipUnit = computed(() => {
  if (formValue.gameType === 'SANMA') {
    return settings.value?.sanmaTipUnit ?? 500;
  }
  return settings.value?.yonmaTipUnit ?? 500;
});

const tipIncomeDisplay = computed(() => formValue.tipIncome ?? 0);
const totalIncomeDisplay = computed(() => formValue.totalIncome ?? 0);

const baseIncomeInput = computed<number>({
  get: () => Math.abs(formValue.baseIncome ?? 0),
  set: (value) => {
    const normalized = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    formValue.baseIncome = normalized * baseIncomeSign.value;
  },
});

const setBaseIncomeSign = (sign: 1 | -1) => {
  baseIncomeSign.value = sign;
  formValue.baseIncome = Math.abs(formValue.baseIncome ?? 0) * sign;
};

const adjustTipCount = (delta: number) => {
  const current = Number(formValue.tipCount ?? 0);
  formValue.tipCount = current + delta;
};

watch(
  () => formValue.gameType,
  () => {
    const max = formValue.gameType === 'SANMA' ? 3 : 4;
    if (!formValue.place || formValue.place > max) {
      formValue.place = max;
    }
  },
  { immediate: true },
);

watch(
  () => formValue.baseIncome,
  (value) => {
    if (value == null || value === 0) {
      return;
    }
    baseIncomeSign.value = value >= 0 ? 1 : -1;
  },
  { immediate: true },
);

const recalcTipIncome = () => {
  const count = formValue.tipCount;
  formValue.tipIncome = count * (currentTipUnit.value ?? 0);
};

watch([() => formValue.tipCount, currentTipUnit], recalcTipIncome, { immediate: true });

const recalcTotalIncome = () => {
  const baseValue = Number(formValue.baseIncome);
  const tipValue = Number(formValue.tipIncome);
  const place = Number(formValue.place ?? 0);
  let total = baseValue + tipValue;

  if (formValue.gameType === 'YONMA') {
    if (place === 1) {
      total -= currentYonmaGameFee.value;
    }
  } else if (formValue.gameType === 'SANMA') {
    if (place === 1) {
      total -= currentSanmaGameFee.value;
    }
    total += currentSanmaGameFeeBack.value;
  }

  formValue.totalIncome = total;
};

watch(
  [
    () => formValue.baseIncome,
    () => formValue.tipIncome,
    () => formValue.place,
    () => formValue.gameType,
    () => currentYonmaGameFee.value,
    () => currentSanmaGameFee.value,
    () => currentSanmaGameFeeBack.value,
  ],
  recalcTotalIncome,
  { immediate: true },
);

const toPayload = () => ({
  gameType: formValue.gameType,
  playedAt: dayjs(formValue.playedAt ?? dayjs().valueOf()).format('YYYY-MM-DD'),
  place: Number(formValue.place ?? 1),
  baseIncome: Number(formValue.baseIncome),
  tipCount: Number(formValue.tipCount),
  tipIncome: Number(formValue.tipIncome),
  totalIncome: Number(formValue.totalIncome),
  note: formValue.note.trim() ? formValue.note : undefined,
});

const handleSubmit = async () => {
  if (!formRef.value || !userId) {
    return;
  }
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const payload = toPayload();
    if (isEdit.value && resultId.value) {
      await updateGameResult(userId, resultId.value, payload);
      message.success('成績を更新しました');
    } else {
      await createGameResult(userId, payload);
      message.success('成績を登録しました');
    }
    router.push('/results');
  } catch (error) {
    notifyError(error, isEdit.value ? '成績の更新に失敗しました' : '成績の登録に失敗しました');
  } finally {
    submitting.value = false;
  }
};

const handleDelete = () => {
  if (!userId || !resultId.value) {
    return;
  }
  dialog.warning({
    title: '削除確認',
    content: 'この成績を削除しますか？',
    positiveText: '削除',
    negativeText: 'キャンセル',
    onPositiveClick: async () => {
      deleting.value = true;
      try {
        await deleteGameResult(userId, resultId.value!);
        message.success('成績を削除しました');
        router.push('/results');
      } catch (error) {
        notifyError(error, '成績の削除に失敗しました');
      } finally {
        deleting.value = false;
      }
    },
  });
};

const pageTitle = computed(() => (isEdit.value ? '成績を編集' : '成績を登録'));
</script>

<template>
  <div class="result-form-page app-page">
    <AppPageHeader :title="pageTitle" back-to="/results" />
    <n-card class="form-card">
      <n-spin :show="loading || loadingSettings">
        <n-form
          ref="formRef"
          :model="formValue"
          :rules="rules"
          label-placement="top"
          size="large"
          class="result-form"
        >
          <section class="form-section">
            <h3>ゲーム情報</h3>
            <n-form-item label="種別" path="gameType">
              <n-select v-model:value="formValue.gameType" :options="gameTypeOptions" placeholder="選択" />
            </n-form-item>
            <n-form-item label="対局日" path="playedAt">
              <n-date-picker v-model:value="formValue.playedAt" type="date" />
            </n-form-item>
            <n-form-item label="着順" path="place">
              <n-button-group size="small" class="place-button-group">
                <n-button
                  v-for="option in placeOptions"
                  :key="option.value"
                  :type="option.value === formValue.place ? 'primary' : 'default'"
                  :ghost="option.value !== formValue.place"
                  @click="formValue.place = option.value as number"
                >
                  {{ option.label }}
                </n-button>
              </n-button-group>
            </n-form-item>
          </section>

          <section class="form-section">
            <h3>収入情報</h3>
            <n-form-item label="ベース収入" path="baseIncome">
              <div class="base-income-row">
                <n-button-group size="small" class="income-sign-toggle">
                  <n-button
                    type="primary"
                    :ghost="baseIncomeSign !== 1"
                    @click="setBaseIncomeSign(1)"
                  >
                    ＋
                  </n-button>
                  <n-button
                    type="primary"
                    :ghost="baseIncomeSign !== -1"
                    @click="setBaseIncomeSign(-1)"
                  >
                    －
                  </n-button>
                </n-button-group>
                <n-input-number
                  v-model:value="baseIncomeInput"
                  :show-button="false"
                  inputmode="numeric"
                  placeholder="例: 3400"
                  :max="10000000"
                  :input-props="{ inputmode: 'numeric', pattern: '[0-9]*', type: 'tel' }"
                />
              </div>
            </n-form-item>
            <n-form-item label="チップ枚数" path="tipCount">
              <div class="tip-input-row">
                <n-input-number
                  v-model:value="formValue.tipCount"
                  :show-button="false"
                  inputmode="numeric"
                  placeholder="例: 5"
                  :min="0"
                />
                <div class="tip-adjust-buttons">
                  <n-button size="small" @click="adjustTipCount(-5)">-5</n-button>
                  <n-button size="small" @click="adjustTipCount(-1)">-1</n-button>
                  <n-button size="small" @click="adjustTipCount(1)">+1</n-button>
                  <n-button size="small" @click="adjustTipCount(5)">+5</n-button>
                </div>
              </div>
              <p class="tip-unit">
                単価: ¥{{ currentTipUnit.toFixed(0) }} / 枚
                <span v-if="loadingSettings" class="tip-unit__loading">（設定を読み込み中…）</span>
              </p>
            </n-form-item>
            <n-form-item label="チップ収入">
              <div class="readonly-field">¥{{ tipIncomeDisplay.toLocaleString() }}</div>
            </n-form-item>
            <n-form-item v-if="showSanmaGameFeeBack" label="ゲーム代バック">
              <div class="readonly-field">¥{{ sanmaGameFeeBackDisplay.toLocaleString() }}</div>
            </n-form-item>
            <n-form-item label="合計収入">
              <div class="readonly-field total">¥{{ totalIncomeDisplay.toLocaleString() }}</div>
            </n-form-item>
          </section>

          <section class="form-section">
            <h3>メモ</h3>
            <n-form-item path="note">
              <n-input v-model:value="formValue.note" type="textarea" rows="3" placeholder="メモ（任意）" />
            </n-form-item>
          </section>
        </n-form>
      </n-spin>
    </n-card>
    <div class="actions actions--sticky">
      <n-button quaternary class="action-btn" @click="router.push('/results')">戻る</n-button>
      <n-button v-if="isEdit" class="action-btn" type="error" :loading="deleting" @click="handleDelete">削除</n-button>
      <n-button class="action-btn" type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '更新' : '登録' }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.result-form-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 48px;
}

.form-card {
  padding: 16px;
}

:deep(.app-page-header) {
  margin-bottom: 12px;
}

.form-section {
  margin-bottom: 24px;
}

.form-section h3 {
  font-size: 16px;
  margin: 0 0 12px;
  color: #0f172a;
}

.result-form :deep(.n-form-item) {
  margin-bottom: 16px;
}

.base-income-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.income-sign-toggle :deep(.n-button) {
  min-width: 56px;
  border-radius: 12px;
}

.tip-input-row {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.tip-adjust-buttons {
  display: flex;
  gap: 8px;
}
.tip-adjust-buttons :deep(.n-button) {
  min-width: 48px;
  border-radius: 10px;
}

.tip-unit {
  margin: 4px 0 0;
  font-size: 12px;
  color: #475569;
}

.tip-unit__loading {
  margin-left: 8px;
  color: #f97316;
}

.readonly-field {
  padding: 12px;
  border-radius: 10px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  min-height: 44px;
  display: flex;
  align-items: center;
  font-size: 16px;
}

.readonly-field.total {
  font-weight: 600;
  color: #0f172a;
}

.place-button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.place-button-group :deep(.n-button) {
  flex: 1 1 calc(50% - 8px);
  min-width: 110px;
  border-radius: 999px;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.actions--sticky {
  position: sticky;
  bottom: 0;
  padding: 16px 0 8px;
  background: linear-gradient(180deg, rgba(245, 247, 250, 0) 0%, rgba(245, 247, 250, 0.95) 40%, rgba(245, 247, 250, 1) 100%);
}
.action-btn {
  flex: 1;
  width: 100%;
}

@media (max-width: 420px) {
  .base-income-row,
  .tip-input-row {
    flex-direction: column;
    align-items: stretch;
  }

  .income-sign-toggle {
    width: 100%;
    display: flex;
    gap: 8px;
  }
  .income-sign-toggle :deep(.n-button) {
    flex: 1;
    min-width: auto;
  }

  .tip-adjust-buttons {
    width: 100%;
    justify-content: space-between;
  }
  .tip-adjust-buttons :deep(.n-button) {
    flex: 1;
    min-width: auto;
  }

  .place-button-group :deep(.n-button) {
    flex: 1 1 100%;
    min-width: auto;
  }
}
</style>
