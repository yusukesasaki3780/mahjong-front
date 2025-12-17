<script setup lang="ts">
// プレイヤーの成績を比較するランキング表を描画するページです。
import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { useNotification, NButton, NButtonGroup, NCard, NSpin } from 'naive-ui';
import { getRanking, getMyRanking, type PersonalRankingParams, type RankingQueryParams } from '../../api/rankingApi';
import type { PersonalRanking, RankingItem, RankingRange } from '../../types/ranking';
import type { GameType } from '../../types/gameResult';
import { getStoredUserId, isApiClientError } from '../../api/axios';
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
const myRanking = ref<PersonalRanking | null>(null);
const storedUserId = getStoredUserId();
const currentUserId = storedUserId ? Number(storedUserId) : null;

const resolveAmount = (value?: number | null): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const formatCurrency = (value?: number | null): string => {
  const amount = resolveAmount(value);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}¥${Math.abs(amount).toLocaleString('ja-JP')}`;
};

const currencyClass = (value?: number | null): string => {
  const amount = resolveAmount(value);
  if (amount > 0) return 'positive';
  if (amount < 0) return 'negative';
  return '';
};

const formatAveragePlace = (value?: number | null): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';

const formatAverageValue = (value?: number | null): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';

const formatRankSummary = (rankingInfo: PersonalRanking | null): string => {
  if (!rankingInfo) {
    return '-';
  }
  const totalPlayers =
    typeof rankingInfo.totalPlayers === 'number' && Number.isFinite(rankingInfo.totalPlayers)
      ? rankingInfo.totalPlayers
      : 0;
  const rank =
    typeof rankingInfo.rank === 'number' && Number.isFinite(rankingInfo.rank)
      ? rankingInfo.rank
      : null;
  if (!totalPlayers || rank == null) {
    return '-';
  }
  return `${totalPlayers}人中 ${rank}位`;
};

const hasMyRanking = computed(() => Boolean(myRanking.value));
const hasMyRankSummary = computed(() => {
  if (!myRanking.value) {
    return false;
  }
  const totalPlayers =
    typeof myRanking.value.totalPlayers === 'number' && Number.isFinite(myRanking.value.totalPlayers)
      ? myRanking.value.totalPlayers
      : 0;
  const rank =
    typeof myRanking.value.rank === 'number' && Number.isFinite(myRanking.value.rank)
      ? myRanking.value.rank
      : null;
  return totalPlayers > 0 && rank != null;
});

const myRankSummaryText = computed(() =>
  hasMyRankSummary.value ? `${myRanking.value!.totalPlayers}人中 ${myRanking.value!.rank}位` : '-',
);

const notifyError = (error: unknown, fallback: string): void => {
  notification.error({
    title: 'エラー',
    content: isApiClientError(error) ? error.message : fallback,
  });
};

const resolvePeriod = (range: RankingRange) => {
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
  return { start, end };
};

const buildRankingQuery = (range: RankingRange, gameType: GameType): RankingQueryParams => {
  const { start, end } = resolvePeriod(range);

  return {
    type: gameType,
    start: start.toISOString(),
    end: end.toISOString(),
    label: range,
  };
};

const buildPersonalRankingQuery = (range: RankingRange, gameType: GameType): PersonalRankingParams => {
  const { start, end } = resolvePeriod(range);
  let targetDate: string;
  if (range === 'monthly') {
    targetDate = start.format('YYYY-MM');
  } else if (range === 'yearly') {
    targetDate = start.format('YYYY');
  } else {
    targetDate = end.format('YYYY-MM-DD');
  }
  return {
    mode: gameType === 'YONMA' ? 'four' : 'three',
    range,
    targetDate,
  };
};

const buildFallbackPersonalRanking = (list: RankingItem[]): PersonalRanking | null => {
  if (currentUserId == null) {
    return null;
  }
  const index = list.findIndex((item) => item.userId === currentUserId);
  if (index < 0) {
    return null;
  }
  const target = list[index];
  if (!target) {
    return null;
  }
  return {
    rank: index + 1,
    totalPlayers: list.length,
    averageRank: target.averagePlace,
    gameIncome: target.totalIncome,
    gameCount: target.gameCount,
    user: {
      id: target.userId,
      nickname: target.name,
    },
  };
};

const fetchRanking = async () => {
  loading.value = true;
  try {
    const params = buildRankingQuery(selectedRange.value, selectedGameType.value);
    const personalParams = buildPersonalRankingQuery(selectedRange.value, selectedGameType.value);

    const personalPromise = getMyRanking(personalParams).catch((error) => {
      console.warn('[Ranking] Failed to load personal ranking', error);
      return null;
    });

    const [list, personal] = await Promise.all([getRanking(params), personalPromise]);
    ranking.value = list;
    myRanking.value = personal ?? buildFallbackPersonalRanking(list);
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
      <n-card v-if="hasMyRankSummary" class="my-rank-card">
        <span class="label">あなたの順位</span>
        <strong class="rank-value">{{ myRankSummaryText }}</strong>
      </n-card>

      <n-card v-if="hasMyRanking" class="my-ranking-card">
        <div class="my-ranking-header">
          <div>
            <span class="label">あなたの成績</span>
            <small v-if="myRanking?.user?.id" class="user-id">ID: {{ myRanking?.user?.id }}</small>
          </div>
          <strong>{{ formatRankSummary(myRanking) }}</strong>
        </div>
        <div class="my-ranking-body">
          <div>
            <span class="sub-label">対局数</span>
            <strong>{{ myRanking?.gameCount ?? '-' }}</strong>
          </div>
          <div>
            <span class="sub-label">平均順位</span>
            <strong>{{ formatAverageValue(myRanking?.averageRank) }}</strong>
          </div>
          <div :class="['my-ranking-income', currencyClass(myRanking?.gameIncome)]">
            <span class="sub-label">総ゲーム収支</span>
            <strong>{{ formatCurrency(myRanking?.gameIncome) }}</strong>
          </div>
        </div>
      </n-card>

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
              <h3>
                {{ item.name }}
                <span v-if="item.zooId" class="zoo-id">（ID{{ item.zooId }}）</span>
              </h3>
              <span class="games">対局数: {{ item.gameCount ?? '-' }}</span>
            </div>
            <div class="ranking-metrics">
              <div class="metric">
                <span>平均順位</span>
                <strong>{{ formatAveragePlace(item.averagePlace) }}</strong>
              </div>
            </div>
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

.my-rank-card {
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.my-rank-card .label {
  font-size: 14px;
  font-weight: 600;
  color: #4338ca;
}

.my-rank-card .rank-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e1b4b;
}

.my-ranking-card {
  background: #f0f8ff;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  margin-bottom: 8px;
}

.my-ranking-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.my-ranking-header .label {
  font-size: 14px;
  color: #2563eb;
}

.my-ranking-body {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.my-ranking-body > div {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
}

.my-ranking-body .sub-label {
  font-size: 12px;
  color: #475569;
}

.my-ranking-body strong {
  font-size: 18px;
  color: #0f172a;
}

.my-ranking-header .user-id {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.my-ranking-income.positive strong {
  color: #16a34a;
}

.my-ranking-income.negative strong {
  color: #dc2626;
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
  gap: 8px;
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

.ranking-info .zoo-id {
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}

.games {
  font-size: 13px;
  color: var(--color-subtle);
}

.ranking-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.ranking-metrics .metric {
  min-width: 120px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.ranking-metrics .metric span {
  font-size: 12px;
  color: var(--color-subtle);
}

.ranking-metrics .metric strong {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.empty-card {
  text-align: center;
  color: var(--color-subtle);
}
</style>
