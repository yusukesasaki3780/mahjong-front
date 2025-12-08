<script setup lang="ts">
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotification, NButton, NCard } from 'naive-ui';
import {
  getGameResults,
} from '../../api/gameResultApi';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import type { GameResult, GameResultQuery, GameResultResponse } from '../../types/gameResult';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

const router = useRouter();
const notification = useNotification();
const loading = ref(false);
const rows = ref<GameResult[]>([]);
const dateRange = ref<[number, number] | null>(null);

const notifyError = (error: unknown, fallback: string): void => {
  const description = isApiClientError(error) ? error.message : fallback;
  notification.error({ title: 'エラー', content: description });
};

const formatPlayedAt = (value: string): string => value.slice(0, 10);

const gameTypeLabel: Record<string, string> = {
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

const modeTagClass = (mode: string): string => {
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
  console.log('[Results] loadResults invoked', { userId });
  if (!userId) {
    router.replace('/login');
    return;
  }
  const query = buildQuery();
  console.log('[Results] calling getGameResults', { userId, query });
  loading.value = true;
  try {
    const response: GameResultResponse = await getGameResults(userId, query);
    rows.value = response.results;
    console.log('[Results] getGameResults success', { count: rows.value.length });
  } catch (error) {
    console.error('[Results] getGameResults failed', error);
    notifyError(error, '成績の取得に失敗しました');
  } finally {
    loading.value = false;
  }
};

onMounted(loadResults);

const handleEdit = (id: string) => {
  router.push(`/results/${id}/edit`);
};

const handleReload = () => {
  loadResults();
};

const handleCreate = () => {
  router.push('/results/new');
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
    <p class="subtitle">期間で絞り込んでください</p>
    <n-card class="filters-card">
      <div class="filters">
        <label class="filter-label">期間</label>
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
          <n-button tertiary size="medium" @click="handleReload">再読み込み</n-button>
        </div>
      </div>
    </n-card>

    <div v-if="rows.length" class="result-card-list">
      <n-card
        v-for="item in rows"
        :key="item.id"
        class="result-card"
        tabindex="0"
        role="button"
        @click="handleEdit(item.id)"
      >
        <div class="result-card__row">
          <span class="label">対局日</span>
          <span class="value">{{ formatPlayedAt(item.playedAt) }}</span>
        </div>
        <div class="result-card__row">
          <span class="label">種別</span>
          <span :class="modeTagClass(item.gameType)">
            {{ gameTypeLabel[item.gameType] ?? item.gameType }}
          </span>
        </div>
        <div class="result-card__split">
          <div>
            <span class="label">ベース収入</span>
            <p class="value strong" :class="amountClass(item.baseIncome)">
              {{ formatCurrency(item.baseIncome ?? 0) }}
            </p>
          </div>
          <div>
            <span class="label">チップ収入</span>
            <p class="value strong" :class="amountClass(item.tipIncome)">
              {{ formatCurrency(item.tipIncome ?? 0) }}
            </p>
          </div>
        </div>
        <div class="result-card__split">
          <div>
            <span class="label">着順</span>
            <p class="value strong">{{ item.place }}位</p>
          </div>
          <div>
            <span class="label">合計収支</span>
            <p class="value highlight" :class="amountClass(item.totalIncome)">
              {{ formatCurrency(item.totalIncome ?? 0) }}
            </p>
          </div>
        </div>
        <div class="result-card__actions">
          <n-button text size="small" @click.stop="handleEdit(item.id)">編集</n-button>
        </div>
      </n-card>
    </div>
    <n-card v-else-if="!loading" class="empty-card">
      <p>該当する成績がありません</p>
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
