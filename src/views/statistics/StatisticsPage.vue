<script setup lang="ts">
// 成績の統計グラフや数値指標を切り替えて閲覧するページです。
import { computed, onMounted, ref, watch } from 'vue';
import { NCard, NSpin, NRadioGroup, NRadioButton, useNotification } from 'naive-ui';
import { use } from 'echarts/core';
import { LineChart, PieChart, BarChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { useEchartsTheme } from '../../composables/useEchartsTheme';
import {
  getStatistics,
  groupTrendByGameType,
  buildMonthlySummary,
  buildYearlySummary,
  type RangePreset,
} from '../../api/statisticsApi';
import type { PlaceCounts, PlaceCountsByType, StatsResponse } from '../../types/statistics';
import type { GameType } from '../../types/gameResult';
import { isApiClientError } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

use([GridComponent, LegendComponent, TooltipComponent, LineChart, PieChart, BarChart, CanvasRenderer]);

const notification = useNotification();
const { themedOption, getSeriesColor } = useEchartsTheme();

const ranges: RangePreset[] = ['7d', '30d', '90d', '1y', 'all'];
const rangeLabels: Record<RangePreset, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': '1 year',
  all: '全期間',
};

const selectedRange = ref<RangePreset>('30d');
const loading = ref(false);
const stats = ref<StatsResponse | null>(null);
const monthlySummary = ref(buildMonthlySummary([]));
const yearlySummary = ref(buildYearlySummary([]));

const typeLabels: Record<GameType, string> = {
  YONMA: '四麻',
  SANMA: '三麻',
};

const formatCurrency = (value?: number | null): string =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(typeof value === 'number' ? value : 0);

const totalFromCounts = (counts: PlaceCounts): number =>
  (counts[1] ?? 0) + (counts[2] ?? 0) + (counts[3] ?? 0) + (counts[4] ?? 0);

const formatAveragePlace = (counts: PlaceCounts): string => {
  const total = totalFromCounts(counts);
  if (!total) return '-';
  const weighted =
    (counts[1] ?? 0) * 1 + (counts[2] ?? 0) * 2 + (counts[3] ?? 0) * 3 + (counts[4] ?? 0) * 4;
  return (weighted / total).toFixed(2);
};

const buildGameTypeSummary = (placeCountsByType: PlaceCountsByType) =>
  (['YONMA', 'SANMA'] as const).map((type) => {
    const counts = placeCountsByType[type];
    return {
      type,
      label: typeLabels[type],
      totalGames: totalFromCounts(counts),
      averagePlace: formatAveragePlace(counts),
    };
  });

const loadStats = async (): Promise<void> => {
  loading.value = true;
  try {
    const data = await getStatistics(selectedRange.value);
    stats.value = data;
    monthlySummary.value = buildMonthlySummary(data.dailyTrend);
    yearlySummary.value = buildYearlySummary(data.dailyTrend);
  } catch (error) {
    const serverMessage = isApiClientError(error) ? error.message : '';
    const fallbackMessage = 'データの取得に失敗しました。期間を再選択して再度お試しください。';
    notification.error({ title: '統計ダッシュボード', content: serverMessage || fallbackMessage });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats().catch(() => undefined);
});

watch(selectedRange, () => {
  loadStats().catch(() => undefined);
});

const lineOption = computed(() => {
  if (!stats.value) return {};
  const grouped = groupTrendByGameType(stats.value.dailyTrend);
  return themedOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['四麻', '三麻'] },
    xAxis: { type: 'category', data: grouped.dates },
    yAxis: { type: 'value' },
    series: [
      {
        name: '四麻',
        type: 'line',
        smooth: true,
        data: grouped.values.YONMA,
        lineStyle: { width: 3, color: getSeriesColor(0) },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '三麻',
        type: 'line',
        smooth: true,
        data: grouped.values.SANMA,
        lineStyle: { width: 3, color: getSeriesColor(1) },
        areaStyle: { opacity: 0.1 },
      },
    ],
  });
});

const buildPieOption = (counts: PlaceCounts, title: string) =>
  themedOption({
    tooltip: { trigger: 'item' },
    legend: { show: false },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: (params: { name: string; percent?: number }) => {
            const percent = params.percent ?? 0;
            if (percent < 3) return '';
            return `${params.name} ${Math.round(percent)}%`;
          },
        },
        data: [
          { value: counts[1], name: '1位' },
          { value: counts[2], name: '2位' },
          { value: counts[3], name: '3位' },
          { value: counts[4], name: '4位' },
        ],
      },
    ],
  });

const pieOptions = computed(() => {
  if (!stats.value) {
    const emptyCounts: PlaceCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    return { yonma: buildPieOption(emptyCounts, '四麻'), sanma: buildPieOption(emptyCounts, '三麻') };
  }
  return {
    yonma: buildPieOption(stats.value.placeCountsByType.YONMA, '四麻'),
    sanma: buildPieOption(stats.value.placeCountsByType.SANMA, '三麻'),
  };
});

const gameTypeSummary = computed(() => {
  if (!stats.value) return [];
  return buildGameTypeSummary(stats.value.placeCountsByType);
});

const monthlyOption = computed(() =>
  themedOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: monthlySummary.value.map((m) => `${m.month}月`) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: monthlySummary.value.map((m) => m.income),
        itemStyle: { color: getSeriesColor(2) },
      },
    ],
  }),
);

const yearlyOption = computed(() =>
  themedOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: yearlySummary.value.map((y) => y.year) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: yearlySummary.value.map((y) => y.income),
        itemStyle: { color: getSeriesColor(3) },
      },
    ],
  }),
);
</script>

<template>
  <div class="statistics-page app-page">
    <AppPageHeader title="統計ダッシュボード" back-to="/dashboard" back-label="戻る" />
    <div class="range-switcher">
      <n-radio-group v-model:value="selectedRange" size="small">
        <n-radio-button v-for="range in ranges" :key="range" :value="range">
          {{ rangeLabels[range] }}
        </n-radio-button>
      </n-radio-group>
    </div>
    <p class="eyebrow">ZOOメン ポータル</p>
    <p class="subtitle">期間を切り替えて最新の統計を確認しましょう。</p>

    <n-spin :show="loading">
      <div v-if="stats" class="stats-stack">
        <n-card class="summary-card">
          <div class="summary-metrics">
            <div
              v-for="item in gameTypeSummary"
              :key="item.type"
              class="metric metric--type"
            >
              <span class="metric__label">総対局数（{{ item.label }}）</span>
              <strong>{{ item.totalGames }}</strong>
              <span class="metric__sub-label">平均着順</span>
              <strong class="metric__sub-value">{{ item.averagePlace }}</strong>
            </div>
            <div class="metric">
              <span class="metric__label">総収支</span>
              <strong>{{ formatCurrency(stats.totalIncome) }}</strong>
            </div>
          </div>
        </n-card>

        <n-card class="chart-card" title="ゲームタイプ別収支">
          <v-chart :option="lineOption" autoresize class="chart" />
        </n-card>

        <n-card class="chart-card" title="着順の割合">
          <div class="pie-grid">
            <div class="pie-panel">
              <h4>四麻</h4>
              <v-chart :option="pieOptions.yonma" autoresize class="pie-chart" />
            </div>
            <div class="pie-panel">
              <h4>三麻</h4>
              <v-chart :option="pieOptions.sanma" autoresize class="pie-chart" />
            </div>
          </div>
        </n-card>

        <n-card class="chart-card" title="月次サマリ">
          <v-chart :option="monthlyOption" autoresize class="chart" />
        </n-card>

        <n-card class="chart-card" title="年次サマリ">
          <v-chart :option="yearlyOption" autoresize class="chart" />
        </n-card>
      </div>
      <n-card v-else class="empty-card">統計情報がありません</n-card>
    </n-spin>
  </div>
</template>

<style scoped>
.statistics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.app-page-header) {
  margin-bottom: 4px;
}

.eyebrow {
  text-transform: uppercase;
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  margin-left: clamp(12px, 8vw, 150px);
  margin-right: clamp(12px, 4vw, 48px);
  max-width: 520px;
}

.subtitle {
  margin: 0 0 8px;
  color: var(--color-subtle);
  font-size: 14px;
  margin-left: clamp(12px, 8vw, 150px);
  margin-right: clamp(12px, 4vw, 48px);
  max-width: 520px;
}

.range-switcher {
  display: flex;
  justify-content: flex-end;
  margin: 0 clamp(12px, 8vw, 150px);
}

.stats-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-card {
  padding: 12px 16px;
}

.summary-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
}

.metric span {
  font-size: 13px;
  color: var(--color-subtle);
}

.metric strong {
  font-size: 22px;
  color: var(--color-brand);
}

.metric__label,
.metric__sub-label,
.metric__sub-value-title {
  font-weight: 600;
}

.metric--type strong {
  font-size: 20px;
}

.metric__sub-label {
  font-size: 12px;
  color: #94a3b8;
}

.metric__sub-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-brand);
  display: inline-block;
}

.chart-card {
  padding: 12px;
}

.chart {
  width: 100%;
  height: 280px;
}

.pie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.pie-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.pie-panel h4 {
  margin: 0;
  font-size: 14px;
  color: var(--color-subtle);
}

.pie-chart {
  width: 100%;
  height: 260px;
}

.empty-card {
  text-align: center;
  color: var(--color-subtle);
  padding: 24px;
}

@media (max-width: 520px) {
  .summary-metrics {
    flex-direction: column;
  }
  .chart,
  .pie-chart {
    height: 240px;
  }
}

@media (max-width: 768px) {
  .eyebrow,
  .subtitle {
    margin-left: clamp(12px, 6vw, 24px);
    margin-right: clamp(12px, 6vw, 24px);
    max-width: 100%;
  }
  .range-switcher {
    justify-content: flex-start;
    margin: 0 clamp(12px, 6vw, 24px);
  }
}
</style>
