<script setup lang="ts">
// 成績をまとめて登録・更新する簡易バッチ入力フォームコンポーネントです。
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDatePicker,
  NDivider,
  NForm,
  NFormItem,
  NInputNumber,
  NSelect,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui';
import {
  createGameResult,
  patchGameResult,
  startSimpleBatch,
} from '../../api/gameResultApi';
import { getStoreMasters, type StoreMaster } from '../../api/stores';
import { getStoredUserId } from '../../api/axios';
import type { GameResult, GameType } from '../../types/gameResult';
import { SIMPLE_BATCH_STATE_EVENT, SIMPLE_BATCH_STORAGE_KEY } from '../../constants/simpleBatch';

interface SimpleBatchState {
  simpleBatchId: string;
  storeId: number;
  storeName: string;
  playedAt: string;
  lastResultId: string | null;
  entryCount: number;
  entryGameType: GameType;
}

interface SimpleBatchHistoryItem {
  id: string;
  place: number;
  createdAt: string;
  gameType: GameType;
}

const router = useRouter();
const message = useMessage();
const dialog = useDialog();

const userId = getStoredUserId();
if (!userId) {
  router.replace('/login');
}

const stores = ref<StoreMaster[]>([]);
const storesLoading = ref(false);
const storeOptions = computed(() =>
  stores.value.map((store) => ({
    label: store.storeName,
    value: store.id,
  })),
);

const simpleBatch = ref<SimpleBatchState | null>(null);
const simpleHistory = ref<SimpleBatchHistoryItem[]>([]);
const entryLoading = ref(false);
const finishPanelVisible = ref(false);
const finishSubmitting = ref(false);
const startSubmitting = ref(false);
const startFormVisible = ref(false);

const startForm = reactive({
  storeId: null as number | null,
  playedAt: dayjs().startOf('day').valueOf(),
});

const entryGameType = ref<GameType>('YONMA');
const gameTypeOptions = [
  { label: '四麻', value: 'YONMA' as GameType },
  { label: '三麻', value: 'SANMA' as GameType },
];
const gameTypeLabel: Record<GameType, string> = {
  YONMA: '四麻',
  SANMA: '三麻',
};

const finishForm = reactive({
  borrowAmount: 0,
  returnAmount: 0,
});

const isFutureDate = (value: number | null | undefined): boolean => {
  if (value == null) {
    return false;
  }
  return dayjs(value).startOf('day').isAfter(dayjs().startOf('day'));
};

const disableFutureDate = (timestamp: number) => isFutureDate(timestamp);

const resolveStoreName = (storeId: number | null | undefined): string => {
  if (storeId == null) {
    return '店舗未登録';
  }
  const found = stores.value.find((store) => store.id === storeId);
  return found?.storeName ?? '店舗未登録';
};

const emitSimpleBatchStateChange = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(SIMPLE_BATCH_STATE_EVENT, {
      detail: { active: Boolean(simpleBatch.value?.simpleBatchId) },
    }),
  );
};

const persistSimpleBatchState = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (simpleBatch.value) {
    window.localStorage.setItem(SIMPLE_BATCH_STORAGE_KEY, JSON.stringify(simpleBatch.value));
  } else {
    window.localStorage.removeItem(SIMPLE_BATCH_STORAGE_KEY);
  }
  emitSimpleBatchStateChange();
};

const restoreSimpleBatchState = () => {
  if (typeof window === 'undefined') {
    return;
  }
  const raw = window.localStorage.getItem(SIMPLE_BATCH_STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as SimpleBatchState;
    if (!parsed.entryGameType) {
      parsed.entryGameType = 'YONMA';
    }
    simpleBatch.value = parsed;
    entryGameType.value = parsed.entryGameType;
    emitSimpleBatchStateChange();
  } catch (error) {
    console.warn('[SimpleBatch] Failed to restore state', error);
    window.localStorage.removeItem(SIMPLE_BATCH_STORAGE_KEY);
    emitSimpleBatchStateChange();
  }
};

const loadStores = async () => {
  storesLoading.value = true;
  try {
    stores.value = await getStoreMasters();
    if (simpleBatch.value && !simpleBatch.value.storeName) {
      simpleBatch.value.storeName = resolveStoreName(simpleBatch.value.storeId);
      persistSimpleBatchState();
    }
  } catch (error) {
    console.error('[SimpleBatch] Failed to load stores', error);
  } finally {
    storesLoading.value = false;
  }
};

const buildPlaceOptions = (gameType: GameType): number[] => {
  const max = gameType === 'SANMA' ? 3 : 4;
  return Array.from({ length: max }, (_, idx) => idx + 1);
};

const simpleRankOptions = computed(() => buildPlaceOptions(entryGameType.value));

const simplePlayDateDisplay = computed(() => {
  if (simpleBatch.value) {
    return dayjs(simpleBatch.value.playedAt).format('YYYY-MM-DD');
  }
  return dayjs(startForm.playedAt).format('YYYY-MM-DD');
});

const simpleStoreName = computed(() => {
  if (simpleBatch.value) {
    return simpleBatch.value.storeName;
  }
  if (startForm.storeId != null) {
    return resolveStoreName(startForm.storeId);
  }
  return '';
});

const simpleDifference = computed(() => finishForm.returnAmount - finishForm.borrowAmount);

const handleStartBatch = async () => {
  if (!userId) {
    router.replace('/login');
    return;
  }
  if (simpleBatch.value) {
    message.warning('まとめて簡単入力モードが進行中です。終了してから新しく開始してください。');
    return;
  }
  if (startForm.storeId == null) {
    message.error('店舗を選択してください');
    return;
  }
  if (isFutureDate(startForm.playedAt)) {
    message.error('未来の日付は選択できません');
    startForm.playedAt = dayjs().startOf('day').valueOf();
    return;
  }
  const selectedStoreId = startForm.storeId;
  startSubmitting.value = true;
  try {
    const payload = {
      storeId: selectedStoreId,
      playedAt: dayjs(startForm.playedAt ?? Date.now()).format('YYYY-MM-DD'),
    };
    const response = await startSimpleBatch(userId, payload);
    simpleBatch.value = {
      simpleBatchId: response.simpleBatchId,
      storeId: response.storeId ?? selectedStoreId,
      storeName: response.storeName ?? resolveStoreName(response.storeId ?? selectedStoreId),
      playedAt: response.playedAt ?? payload.playedAt,
      lastResultId: null,
      entryCount: 0,
      entryGameType: entryGameType.value,
    };
    simpleHistory.value = [];
    persistSimpleBatchState();
    startFormVisible.value = false;
    message.success('まとめて簡単入力モードを開始しました');
  } catch (error) {
    console.error('[SimpleBatch] start failed', error);
    message.error('まとめて簡単入力モードの開始に失敗しました');
  } finally {
    startSubmitting.value = false;
  }
};

const handleSubmitRank = async (place: number) => {
  if (!userId || !simpleBatch.value) {
    return;
  }
  if (!entryGameType.value) {
    message.error('種別を選択してください');
    return;
  }
  entryLoading.value = true;
  try {
    const payload = {
      gameType: entryGameType.value,
      playedAt: simpleBatch.value.playedAt,
      place,
      baseIncome: 0,
      tipCount: 0,
      tipIncome: 0,
      otherIncome: 0,
      totalIncome: 0,
      storeId: simpleBatch.value.storeId,
      simpleBatchId: simpleBatch.value.simpleBatchId,
    };
    const result: GameResult = await createGameResult(userId, payload);
    simpleBatch.value.lastResultId = result.id;
    simpleBatch.value.entryCount += 1;
    persistSimpleBatchState();
    simpleHistory.value.unshift({
      id: result.id,
      place: result.place,
      createdAt: result.playedAt,
      gameType: result.gameType,
    });
    if (simpleHistory.value.length > 10) {
      simpleHistory.value.pop();
    }
    message.success(`着順 ${place} を登録しました`);
  } catch (error) {
    console.error('[SimpleBatch] submit rank failed', error);
    message.error('着順の登録に失敗しました');
  } finally {
    entryLoading.value = false;
  }
};

const resetFinishForm = () => {
  finishForm.borrowAmount = 0;
  finishForm.returnAmount = 0;
};

const completeSimpleBatch = async () => {
  if (!userId || !simpleBatch.value) {
    return;
  }
  if (!simpleBatch.value.lastResultId) {
    message.error('まずは1局以上登録してください');
    return;
  }
  if (finishForm.borrowAmount % 10000 !== 0) {
    message.error('本日の借入は1万円単位で入力してください');
    return;
  }
  finishSubmitting.value = true;
  try {
    const difference = simpleDifference.value;
    await patchGameResult(userId, simpleBatch.value.lastResultId, {
      baseIncome: difference,
      totalIncome: difference,
      simpleBatchId: simpleBatch.value.simpleBatchId,
    });
    message.success('本日の結果を反映しました');
    simpleBatch.value = null;
    simpleHistory.value = [];
    finishPanelVisible.value = false;
    resetFinishForm();
    persistSimpleBatchState();
  } catch (error) {
    console.error('[SimpleBatch] finalize failed', error);
    message.error('本日の結果の反映に失敗しました');
  } finally {
    finishSubmitting.value = false;
  }
};

const confirmCancelBatch = () => {
  if (!simpleBatch.value) {
    return;
  }
  dialog.warning({
    title: 'モードを終了しますか？',
    content: '登録途中の簡単入力モードを破棄します。よろしいですか？',
    positiveText: '終了する',
    negativeText: 'キャンセル',
    onPositiveClick: () => {
      simpleBatch.value = null;
      simpleHistory.value = [];
      persistSimpleBatchState();
      message.info('まとめて簡単入力モードを終了しました');
    },
  });
};

onMounted(() => {
  restoreSimpleBatchState();
  loadStores().catch(() => undefined);
});

watch(
  () => simpleBatch.value?.storeId,
  (storeId) => {
    if (storeId != null && simpleBatch.value) {
      simpleBatch.value.storeName = resolveStoreName(storeId);
      persistSimpleBatchState();
    }
  },
);

watch(
  () => entryGameType.value,
  (value) => {
    if (simpleBatch.value) {
      simpleBatch.value.entryGameType = value;
      persistSimpleBatchState();
    }
  },
);
</script>

<template>
  <n-card class="simple-batch-card">
    <div class="simple-batch-header">
      <div>
        <p class="simple-batch-eyebrow">まとめて簡単入力</p>
        <h3 class="simple-batch-title">
          {{ simpleBatch ? 'モード進行中' : 'ワンタップで着順登録' }}
        </h3>
        <p class="simple-batch-desc">
          店舗と日付を選ぶだけで、着順をタップするだけの高速入力モードです。
        </p>
      </div>
      <div class="simple-batch-header-actions">
        <n-button
          v-if="!simpleBatch"
          type="primary"
          :loading="startSubmitting"
          @click="startFormVisible = !startFormVisible"
        >
          まとめて簡単入力モードを開始
        </n-button>
        <n-button
          v-else
          quaternary
          type="error"
          size="small"
          @click="confirmCancelBatch"
        >
          モードを終了
        </n-button>
      </div>
    </div>

    <transition name="fade">
      <div v-if="!simpleBatch && startFormVisible" class="simple-batch-start">
        <n-form label-placement="top" size="large" class="start-form">
          <n-form-item label="店舗" required>
            <n-select
              v-model:value="startForm.storeId"
              :options="storeOptions"
              placeholder="店舗を選択"
              :loading="storesLoading"
            />
          </n-form-item>
          <n-form-item label="対局日" required>
            <n-date-picker
              v-model:value="startForm.playedAt"
              type="date"
              :is-date-disabled="disableFutureDate"
            />
          </n-form-item>
          <div class="start-form-actions">
            <n-button secondary @click="startFormVisible = false">閉じる</n-button>
            <n-button type="primary" :loading="startSubmitting" @click="handleStartBatch">モード開始</n-button>
          </div>
        </n-form>
      </div>
    </transition>

    <div v-if="simpleBatch" class="simple-batch-active">
      <div class="simple-batch-meta">
        <div>
          <p class="meta-label">店舗</p>
          <p class="meta-value">{{ simpleStoreName }}</p>
        </div>
        <div>
          <p class="meta-label">対局日</p>
          <p class="meta-value">{{ simplePlayDateDisplay }}</p>
        </div>
        <div class="entry-game-type">
          <p class="meta-label">登録する種別</p>
          <n-select
            v-model:value="entryGameType"
            :options="gameTypeOptions"
            size="small"
          />
        </div>
        <div>
          <p class="meta-label">登録局数</p>
          <p class="meta-value">{{ simpleBatch.entryCount }} 局</p>
        </div>
        <n-tag type="info" size="small">まとめ登録</n-tag>
      </div>

      <div class="simple-rank-panel">
        <h4>着順をタップして登録</h4>
        <div class="rank-buttons">
          <n-button
            v-for="rank in simpleRankOptions"
            :key="rank"
            size="large"
            type="primary"
            ghost
            :loading="entryLoading"
            @click="handleSubmitRank(rank)"
          >
            {{ rank }}位
          </n-button>
        </div>
      </div>

      <div v-if="simpleHistory.length" class="simple-history">
        <h4>最近の登録</h4>
        <ul>
          <li v-for="history in simpleHistory" :key="history.id">
            <span>{{ dayjs(history.createdAt).format('HH:mm') }}</span>
            <span>{{ history.place }}位</span>
            <span class="history-type">{{ gameTypeLabel[history.gameType] }}</span>
          </li>
        </ul>
      </div>

      <n-divider />

      <div class="simple-finish-panel">
        <div class="finish-header">
          <div>
            <h4>本日の麻雀を終わる</h4>
            <p>借入と戻しを入力すると差額を自動計算し、最後の成績に反映します。</p>
          </div>
          <n-button type="primary" tertiary @click="finishPanelVisible = !finishPanelVisible">
            {{ finishPanelVisible ? '閉じる' : '入力する' }}
          </n-button>
        </div>
        <div v-if="finishPanelVisible" class="finish-form">
          <n-form label-placement="top" size="large">
            <n-form-item label="本日の借入 (1万円単位)">
              <n-input-number
                v-model:value="finishForm.borrowAmount"
                :min="0"
                :step="10000"
                placeholder="例: 20000"
              />
            </n-form-item>
            <n-form-item label="本日の戻し">
              <n-input-number
                v-model:value="finishForm.returnAmount"
                :min="0"
                :step="1000"
                placeholder="例: 12500"
              />
            </n-form-item>
            <div class="difference-preview">
              <span>差額</span>
              <strong :class="{ positive: simpleDifference >= 0, negative: simpleDifference < 0 }">
                {{ simpleDifference >= 0 ? '+' : '' }}{{ simpleDifference.toLocaleString() }} 円
              </strong>
            </div>
            <div class="finish-actions">
              <n-button secondary @click="resetFinishForm">リセット</n-button>
              <n-button
                type="primary"
                :loading="finishSubmitting"
                @click="completeSimpleBatch"
              >
                反映して終了
              </n-button>
            </div>
          </n-form>
        </div>
      </div>
    </div>
  </n-card>
</template>

<style scoped>
.simple-batch-card {
  margin-bottom: 24px;
}

.simple-batch-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.simple-batch-eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #0f8ae5;
  text-transform: uppercase;
}

.simple-batch-title {
  margin: 4px 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.simple-batch-desc {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.simple-batch-header-actions {
  display: flex;
  gap: 8px;
}

.simple-batch-start {
  margin-top: 16px;
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.start-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.start-form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.simple-batch-active {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.simple-batch-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  align-items: flex-end;
}

.meta-label {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.meta-value {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.entry-game-type :deep(.n-select) {
  width: 100%;
}

.simple-rank-panel h4,
.simple-history h4,
.simple-finish-panel h4 {
  margin: 0 0 8px;
  font-size: 16px;
}

.rank-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.simple-history ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.simple-history li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 14px;
}

.history-type {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.simple-finish-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.finish-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.finish-form {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  background: #f8fafc;
}

.difference-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  padding: 8px 0;
}

.difference-preview strong.positive {
  color: #16a34a;
}
.difference-preview strong.negative {
  color: #dc2626;
}

.finish-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 640px) {
  .simple-batch-header {
    flex-direction: column;
  }

  .rank-buttons :deep(.n-button) {
    flex: 1 1 100px;
  }

  .finish-header {
    flex-direction: column;
  }
}
</style>
