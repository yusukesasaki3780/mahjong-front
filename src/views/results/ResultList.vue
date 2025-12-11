<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDialog, useMessage, useNotification, NButton, NCard, NTag } from 'naive-ui';
import { deleteGameResult, deleteSimpleBatch, getGameResults } from '../../api/gameResultApi';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import type { GameResult, GameResultQuery, GameResultResponse, GameType } from '../../types/gameResult';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

interface ResultGroupItem {
  kind: 'group';
  groupId: string;
  storeName?: string | null;
  gameType: GameType;
  playedAt: string;
  totalIncome: number;
  entries: GameResult[];
}

interface ResultSingleItem {
  kind: 'single';
  record: GameResult;
}

type ResultDisplayItem = ResultGroupItem | ResultSingleItem;

const router = useRouter();
const notification = useNotification();
const dialog = useDialog();
const message = useMessage();
const loading = ref(false);
const rows = ref<GameResult[]>([]);
const dateRange = ref<[number, number] | null>(null);

const notifyError = (error: unknown, fallback: string): void => {
  const description = isApiClientError(error) ? error.message : fallback;
  notification.error({ title: 'エラー', content: description });
};

const formatPlayedAt = (value: string): string => value.slice(0, 10);

const gameTypeLabel: Record<GameType, string> = {
  YONMA: '四麻',
  SANMA: '三麻',
};

const formatCurrency = (value?: number | null): string =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(typeof value === 'number' && Number.isFinite(value) ? value : 0);

const amountClass = (value?: number | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) {
    return 'neutral';
  }
  return value > 0 ? 'positive' : 'negative';
};

const modeTagClass = (mode: GameType): string => {
  if (mode === 'YONMA') return 'badge badge-yonma';
  if (mode === 'SANMA') return 'badge badge-sanma';
  return 'badge';
};

const buildQuery = (): GameResultQuery => {
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    const [rawStart, rawEnd] = dateRange.value;
    const start = dayjs(rawStart);
    const end = dayjs(rawEnd);
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    };
  }

  const reference = dayjs(dateRange.value?.[0] ?? Date.now());
  const startOfMonth = reference.startOf('month');
  const endOfMonth = reference.endOf('month');
  return {
    startDate: startOfMonth.format('YYYY-MM-DD'),
    endDate: endOfMonth.format('YYYY-MM-DD'),
  };
};

const loadResults = async () => {
  const userId = getStoredUserId();
  if (!userId) {
    router.replace('/login');
    return;
  }
  const query = buildQuery();
  loading.value = true;
  try {
    const response: GameResultResponse = await getGameResults(userId, query);
    rows.value = response.results;
  } catch (error) {
    console.error('[Results] getGameResults failed', error);
    notifyError(error, '成績の取得に失敗しました');
  } finally {
    loading.value = false;
  }
};

onMounted(loadResults);

const groupedItems = computed<ResultDisplayItem[]>(() => {
  const displayItems: ResultDisplayItem[] = [];
  const groupMap = new Map<string, ResultGroupItem>();

  rows.value.forEach((item) => {
    if (!item.simpleBatchId) {
      displayItems.push({ kind: 'single', record: item });
      return;
    }
    let group = groupMap.get(item.simpleBatchId);
    if (!group) {
      group = {
        kind: 'group',
        groupId: item.simpleBatchId,
        storeName: item.storeName ?? '店舗未登録',
        gameType: item.gameType,
        playedAt: item.playedAt,
        totalIncome: 0,
        entries: [],
      };
      groupMap.set(item.simpleBatchId, group);
      displayItems.push(group);
    }
    group.entries.push(item);
    group.totalIncome += item.totalIncome ?? 0;
  });

  groupMap.forEach((group) => {
    group.entries.sort((a, b) => {
      const left = dayjs(a.createdAt ?? a.playedAt).valueOf();
      const right = dayjs(b.createdAt ?? b.playedAt).valueOf();
      return left - right;
    });
    const firstEntry = group.entries[0];
    if (firstEntry?.gameType) {
      group.gameType = firstEntry.gameType;
    }
  });

  return displayItems;
});

const isEditable = (record: GameResult): boolean => !record.simpleBatchId && !record.isFinalRecord;

const handleEdit = (record: GameResult) => {
  if (!isEditable(record)) {
    message.warning('この成績は編集できません。');
    return;
  }
  router.push(`/results/${record.id}/edit`);
};

const handleReload = () => {
  loadResults();
};

const handleCreate = () => {
  router.push('/results/new');
};

const handleDeleteBatch = (simpleBatchId: string) => {
  const userId = getStoredUserId();
  if (!userId) {
    router.replace('/login');
    return;
  }
  dialog.warning({
    title: '確認',
    content: 'まとめて登録された全レコードを削除します。この操作は取り消せません。よろしいですか？',
    positiveText: '削除する',
    negativeText: 'キャンセル',
    onPositiveClick: async () => {
      try {
        const response = await deleteSimpleBatch(userId, simpleBatchId);
        notification.success({
          title: '削除しました',
          content: `まとめ登録を削除しました（${response.deletedCount} 件）`,
        });
        await loadResults();
      } catch (error) {
        console.error('[Results] delete simple batch failed', error);
        notifyError(error, 'まとめ登録の削除に失敗しました');
      }
    },
  });
};

const handleDeleteSingle = (record: GameResult) => {
  const userId = getStoredUserId();
  if (!userId) {
    router.replace('/login');
    return;
  }
  dialog.warning({
    title: '確認',
    content: 'この成績を削除します。よろしいですか？',
    positiveText: '削除する',
    negativeText: 'キャンセル',
    onPositiveClick: async () => {
      try {
        await deleteGameResult(userId, record.id);
        notification.success({
          title: '削除しました',
          content: '成績を削除しました。',
        });
        await loadResults();
      } catch (error) {
        console.error('[Results] delete single failed', error);
        notifyError(error, '成績の削除に失敗しました');
      }
    },
  });
};
</script>

<template>
  <div class="results-page app-page">
    <AppPageHeader title="成績一覧" back-to="/dashboard">
      <template #right>
        <div class="create-button-wrapper">
          <n-button type="primary" size="small" @click="handleCreate">新規作成</n-button>
        </div>
      </template>
    </AppPageHeader>
    <p class="subtitle">期間を絞って直近の成績を確認できます。</p>
    <n-card class="filters-card">
      <div class="filters">
        <label class="filter-label">表示期間</label>
        <div class="filter-inputs">
          <n-date-picker
            v-model:value="dateRange"
            type="daterange"
            clearable
            size="medium"
            class="range-picker"
            :to="false"
            start-placeholder="開始日"
            end-placeholder="終了日"
          />
          <n-button tertiary size="medium" @click="handleReload">更新</n-button>
        </div>
      </div>
    </n-card>

    <div v-if="groupedItems.length" class="result-card-list">
      <template v-for="item in groupedItems" :key="item.kind === 'group' ? `group-${item.groupId}` : item.record.id">
        <n-card
          v-if="item.kind === 'single'"
          class="result-card"
          :class="{ 'result-card--disabled': !isEditable(item.record) }"
          tabindex="0"
          role="button"
          @click="handleEdit(item.record)"
        >
          <div class="result-card__row">
            <span class="label">対局日</span>
            <span class="value">{{ formatPlayedAt(item.record.playedAt) }}</span>
          </div>
          <div class="result-card__row result-card__tags">
            <span class="label">ステータス</span>
            <div class="tag-list">
              <n-tag v-if="item.record.simpleBatchId" type="info" size="small">まとめ</n-tag>
              <n-tag v-if="item.record.isFinalRecord" type="success" size="small">最終収支</n-tag>
              <n-tag v-if="!item.record.simpleBatchId && !item.record.isFinalRecord" size="small" type="default">
                通常
              </n-tag>
            </div>
          </div>
          <div class="result-card__row">
            <span class="label">種別</span>
            <span :class="modeTagClass(item.record.gameType)">
              {{ gameTypeLabel[item.record.gameType] ?? item.record.gameType }}
            </span>
          </div>
          <div class="result-card__split">
            <div>
              <span class="label">ベース収入</span>
              <p class="value strong" :class="amountClass(item.record.baseIncome)">
                {{ formatCurrency(item.record.baseIncome ?? 0) }}
              </p>
            </div>
            <div>
              <span class="label">チップ収入</span>
              <p class="value strong" :class="amountClass(item.record.tipIncome)">
                {{ formatCurrency(item.record.tipIncome ?? 0) }}
              </p>
            </div>
          </div>
          <div class="result-card__split">
            <div>
              <span class="label">着順</span>
              <p class="value strong">{{ item.record.place }}位</p>
            </div>
            <div>
              <span class="label">合計収支</span>
              <p class="value highlight" :class="amountClass(item.record.totalIncome)">
                {{ formatCurrency(item.record.totalIncome ?? 0) }}
              </p>
            </div>
          </div>
          <div class="result-card__actions">
            <template v-if="isEditable(item.record)">
              <n-button text size="small" @click.stop="handleEdit(item.record)">編集</n-button>
            </template>
            <template v-else>
              <n-tag type="warning" size="small">編集不可</n-tag>
              <n-button
                v-if="item.record.isFinalRecord && !item.record.simpleBatchId"
                text
                size="small"
                type="error"
                @click.stop="handleDeleteSingle(item.record)"
              >
                削除
              </n-button>
            </template>
          </div>
        </n-card>

        <n-card v-else class="result-card result-card--group">
          <div class="group-header">
            <div>
              <div class="group-header__title">
                <n-tag type="info" size="small">まとめ登録</n-tag>
                <strong>{{ item.storeName ?? '店舗未登録' }}</strong>
              </div>
              <p class="group-header__meta">
                日付: {{ formatPlayedAt(item.playedAt) }} ／ 種別: {{ gameTypeLabel[item.gameType] }}
              </p>
            </div>
            <div class="group-header__actions">
              <n-button type="error" size="small" quaternary @click="handleDeleteBatch(item.groupId)">
                まとめて削除
              </n-button>
              <div class="group-total" :class="amountClass(item.totalIncome)">
                <span>最終収支</span>
                <strong>{{ formatCurrency(item.totalIncome) }}</strong>
              </div>
            </div>
          </div>
          <div class="group-entries">
            <div
              v-for="entry in item.entries"
              :key="entry.id"
              class="group-entry"
            >
              <div class="group-entry__info">
                <span class="rank">{{ entry.place }}位</span>
                <span class="amount" :class="amountClass(entry.totalIncome)">
                  {{ formatCurrency(entry.totalIncome ?? 0) }}
                </span>
              </div>
              <span class="entry-mode" :class="modeTagClass(entry.gameType)">
                {{ gameTypeLabel[entry.gameType] ?? entry.gameType }}
              </span>
            </div>
          </div>
        </n-card>
      </template>
    </div>
    <n-card v-else-if="!loading" class="empty-card">
      <p>成績がまだありません。まずは1件登録してみましょう。</p>
    </n-card>
  </div>
</template>

<style scoped>
.results-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.subtitle {
  margin: 4px 0 12px;
  color: #94a3b8;
  font-size: 13px;
  padding-left: 0;
  margin-left: clamp(12px, 8vw, 150px);
  margin-right: clamp(12px, 4vw, 48px);
  max-width: 480px;
}

.filters-card {
  padding: 12px;
}
.filters {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  color: #64748b;
}

.filter-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.range-picker {
  min-width: 260px;
  flex: 1 1 200px;
}

.result-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-card {
  cursor: pointer;
  transition: transform 0.2s ease;
  padding: 16px;
}

.result-card:hover {
  transform: translateY(-2px);
}

.result-card__row,
.result-card__split {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 12px;
}

.result-card__split > div {
  flex: 1;
}

.result-card__tags {
  align-items: flex-start;
}

.tag-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.result-card--disabled {
  cursor: not-allowed;
  opacity: 0.9;
}

.label {
  font-size: 13px;
  color: #94a3b8;
}

.value {
  font-size: 16px;
  color: var(--color-text);
}

.value.positive {
  color: #16a34a;
}

.value.negative {
  color: #dc2626;
}

.value.neutral {
  color: #1f2937;
}

.value.strong {
  font-weight: 600;
}

.value.highlight {
  font-weight: 700;
}

.badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.badge-yonma {
  background: rgba(59, 130, 246, 0.15);
  color: #1d4ed8;
}

.badge-sanma {
  background: rgba(192, 132, 252, 0.2);
  color: #7e22ce;
}

.result-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.result-card--group {
  cursor: default;
}

.group-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
}

.group-header__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-header__title strong {
  font-size: 16px;
}

.group-header__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.group-header__actions :deep(.n-button) {
  align-self: flex-end;
}

.group-header__meta {
  margin: 4px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.group-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: 700;
}

.group-total span {
  font-size: 12px;
  color: #94a3b8;
}

.group-entries {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.group-entry__info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-entry:last-of-type {
  border-bottom: none;
}

.group-entry .rank {
  font-weight: 600;
}

.group-entry .amount {
  font-weight: 600;
}

.group-entry .amount.positive {
  color: #16a34a;
}

.group-entry .amount.negative {
  color: #dc2626;
}

.group-entry .entry-mode {
  flex-shrink: 0;
}

.empty-card {
  text-align: center;
  color: #94a3b8;
}

:deep(.app-page-header) {
  margin-bottom: 4px;
}

.create-button-wrapper {
  margin-right: clamp(12px, 6vw, 48px);
}

@media (max-width: 768px) {
  .subtitle {
    margin-left: clamp(12px, 6vw, 24px);
    margin-right: clamp(12px, 6vw, 24px);
    max-width: 100%;
  }
  .create-button-wrapper {
    margin-right: clamp(12px, 6vw, 24px);
  }
}

@media (max-width: 768px) {
  :global(.n-date-panel.n-date-panel--daterange) {
    display: flex;
    flex-direction: column;
    min-width: 280px;
  }

  :global(.n-date-panel.n-date-panel--daterange .n-date-panel__vertical-divider) {
    display: none;
  }

  :global(.n-date-panel.n-date-panel--daterange .n-date-panel-calendar) {
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    margin-top: 8px;
  }

  :global(.n-date-panel.n-date-panel--daterange .n-date-panel-calendar:first-of-type) {
    border-top: none;
    margin-top: 0;
  }
}
</style>
const handleDeleteSingle = (record: GameResult) => {
  const userId = getStoredUserId();
  if (!userId) {
    router.replace('/login');
    return;
  }
  dialog.warning({
    title: '確認',
    content: 'この成績を削除します。よろしいですか？',
    positiveText: '削除する',
    negativeText: 'キャンセル',
    onPositiveClick: async () => {
      try {
        await deleteGameResult(userId, record.id);
        notification.success({
          title: '削除しました',
          content: '成績を削除しました。',
        });
        await loadResults();
      } catch (error) {
        console.error('[Results] delete single failed', error);
        notifyError(error, '成績の削除に失敗しました');
      }
    },
  });
};
