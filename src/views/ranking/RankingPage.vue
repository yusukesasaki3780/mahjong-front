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
          <div class="ranking-badge" :class="{ first: index === 0 }">
            #{{ index + 1 }}
          </div>
          <div class="ranking-info">
            <h3>{{ item.name }}</h3>
            <p class="meta">
              対局数: {{ item.gameCount ?? '-' }} / 平均順位: {{ formatAveragePlace(item.averagePlace) }}
            </p>
          </div>
          <div class="ranking-income">
            <span>総ゲーム収支</span>
            <strong>{{ formatCurrency(item.totalIncome) }}</strong>
          </div>
        </n-card>
      </div>
      <n-card v-else class="empty-card">
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
  gap: 12px;
}

.ranking-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.ranking-badge {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(45, 101, 255, 0.1);
  color: var(--color-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}

.ranking-badge.first {
  background: rgba(255, 184, 0, 0.15);
  color: var(--color-accent);
}

.ranking-info {
  flex: 1;
}

.ranking-info h3 {
  margin: 0;
  font-size: 16px;
}

.ranking-info .meta {
  margin: 4px 0 0;
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
  font-size: 16px;
  color: var(--color-brand);
}

.empty-card {
  text-align: center;
  color: var(--color-subtle);
}
</style>
