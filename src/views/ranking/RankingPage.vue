<script setup lang="ts">
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import { useNotification, NButton, NButtonGroup, NCard, NSpin } from 'naive-ui';
import { getRanking, type RankingQueryParams } from '../../api/rankingApi';
import type { RankingItem, RankingRange } from '../../types/ranking';
import type { GameType } from '../../types/gameResult';
import { isApiClientError } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

const notification = useNotification();
const ranges: RankingRange[] = ['daily', 'weekly', 'monthly', 'yearly'];
const rangeLabels: Record<RankingRange, string> = {
  daily: '日次',
  weekly: '週次',
  monthly: '月次',
  yearly: '年次',
};

const gameTypeOptions: { label: string; value: GameType }[] = [
  { label: '四麻', value: 'YONMA' },
  { label: '三麻', value: 'SANMA' },
];

const selectedRange = ref<RankingRange>('daily');
const selectedGameType = ref<GameType>('YONMA');
const loading = ref(false);
const ranking = ref<RankingItem[]>([]);

const formatCurrency = (value?: number | null): string => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `¥${amount.toLocaleString('ja-JP')}`;
};

const currencyClass = (value?: number | null): string => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (amount > 0) return 'positive';
  if (amount < 0) return 'negative';
  return '';
};

const formatAveragePlace = (value?: number | null): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';

const notifyError = (error: unknown, fallback: string): void => {
  notification.error({
    title: 'エラー',
    content: isApiClientError(error) ? error.message : fallback,
  });
};

const buildRankingQuery = (range: RankingRange, gameType: GameType): RankingQueryParams => {
  const now = dayjs();
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  switch (range) {
    case 'weekly': {
      end = now.endOf('day');
      start = end.subtract(6, 'day').startOf('day');
      break;
    }
    case 'monthly': {
      start = now.startOf('month');
      end = now.endOf('month');
      break;
    }
    case 'yearly': {
      start = now.startOf('year');
      end = now.endOf('year');
      break;
    }
    case 'daily':
    default: {
      start = now.startOf('day');
      end = now.endOf('day');
    }
  }

  return {
    type: gameType,
    start: start.toISOString(),
    end: end.toISOString(),
    label: range,
  };
};

const fetchRanking = async () => {
  loading.value = true;
  try {
    const params = buildRankingQuery(selectedRange.value, selectedGameType.value);
    ranking.value = await getRanking(params);
  } catch (error) {
    console.error(error);
    notifyError(error, 'ランキングの取得に失敗しました');
  } finally {
    loading.value = false;
  }
};

onMounted(fetchRanking);

const handleRangeChange = () => {
  fetchRanking();
};

const handleGameTypeChange = (gameType: GameType) => {
  if (selectedGameType.value === gameType) {
    return;
  }
  selectedGameType.value = gameType;
  fetchRanking();
};

const badgeStyle = (index: number): Record<string, string> => {
  const palette = [
    { bg: '#FDF3D3', color: '#B8860B' }, // Gold
    { bg: '#F0F2F4', color: '#7D7F83' }, // Silver
    { bg: '#F7E0D1', color: '#8B4513' }, // Bronze
  ];
  if (index < palette.length) {
    const item = palette[index];
    return { backgroundColor: item!.bg, color: item!.color };
  }
  return { backgroundColor: '#E6E8EC', color: '#4B5563' };
};

const formatPlaceLabel = (rank: number): string => `${rank}位`;

</script>

<template>
  <div class="ranking-page app-page">
    <AppPageHeader title="ランキング" back-to="/dashboard" />
    <n-card class="controls-card">
      <div class="game-type-selector">
        <n-button-group>
          <n-button
            v-for="option in gameTypeOptions"
            :key="option.value"
            size="small"
            :type="option.value === selectedGameType ? 'primary' : 'default'"
            :ghost="option.value !== selectedGameType"
            @click="handleGameTypeChange(option.value)"
          >
            {{ option.label }}
          </n-button>
        </n-button-group>
      </div>
      <div class="range-selector">
        <n-radio-group
          v-model:value="selectedRange"
          name="range"
          @update:value="handleRangeChange"
        >
          <n-radio-button v-for="range in ranges" :key="range" :value="range">
            {{ rangeLabels[range] }}
          </n-radio-button>
        </n-radio-group>
      </div>
    </n-card>

    <n-spin :show="loading">
      <div v-if="ranking.length" class="ranking-list">
        <n-card
          v-for="(item, index) in ranking"
          :key="item.userId"
          class="ranking-card"
        >
          <div class="ranking-badge" :style="badgeStyle(index)">
            {{ formatPlaceLabel(index + 1) }}
          </div>
          <div class="ranking-info">
            <div class="info-header">
              <h3>{{ item.name }}</h3>
              <span class="games">対局数: {{ item.gameCount ?? '-' }}</span>
            </div>
            <p class="meta">
              平均順位: {{ formatAveragePlace(item.averagePlace) }}
            </p>
          </div>
          <div class="ranking-income" :class="currencyClass(item.totalIncome)">
            <span>総ゲーム収支</span>
            <strong>{{ formatCurrency(item.totalIncome) }}</strong>
          </div>
        </n-card>
      </div>
      <n-card v-else-if="!loading" class="empty-card">
        ランキングデータがありません。
      </n-card>
    </n-spin>
  </div>
</template>

<style scoped>
.ranking-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.controls-card {
  padding: 16px;
}

.game-type-selector,
.range-selector {
  margin-bottom: 12px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ranking-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.08);
  border-radius: 16px;
}

.ranking-badge {
  min-width: 64px;
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 16px;
  text-align: center;
}

.ranking-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.ranking-info h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.games {
  font-size: 13px;
  color: var(--color-subtle);
}

.ranking-info .meta {
  margin: 0;
  font-size: 13px;
  color: var(--color-subtle);
}

.ranking-income {
  text-align: right;
}

.ranking-income span {
  font-size: 12px;
  color: var(--color-subtle);
}

.ranking-income strong {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.ranking-income.positive strong {
  color: #16a34a;
}

.ranking-income.negative strong {
  color: #dc2626;
}

.empty-card {
  text-align: center;
  color: var(--color-subtle);
}
</style>
