<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  NCard,
  NSpin,
  NRadioGroup,
  NRadioButton,
  useNotification,
} from 'naive-ui';
import { use } from 'echarts/core';
import { LineChart, PieChart, BarChart } from 'echarts/charts';
import {
  CanvasRenderer,
} from 'echarts/renderers';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import { useEchartsTheme } from '../../composables/useEchartsTheme';
import {
  getStatistics,
  groupTrendByGameType,
  buildMonthlySummary,
  buildYearlySummary,
  type RangePreset,
} from '../../api/statisticsApi';
import type { StatsResponse } from '../../types/statistics';
import { isApiClientError } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

use([GridComponent, LegendComponent, TooltipComponent, LineChart, PieChart, BarChart, CanvasRenderer]);

const notification = useNotification();
const { themedOption, getSeriesColor } = useEchartsTheme();

const ranges: RangePreset[] = ['7d', '30d', '90d', '1y'];
const rangeLabels: Record<RangePreset, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': '1 year',
};

const selectedRange = ref<RangePreset>('30d');
const loading = ref(false);
const stats = ref<StatsResponse | null>(null);
const monthlySummary = ref(buildMonthlySummary([]));
const yearlySummary = ref(buildYearlySummary([]));

// 金額を日本円表記に整形する
const formatCurrency = (value?: number | null): string => {
  const amount = typeof value === 'number' ? value : 0;
  return `¥${amount.toLocaleString('ja-JP')}`;
};

// 選択中の期間に応じて統計データを再取得する
const loadStats = async (): Promise<void> => {
  loading.value = true;
  try {
    const data = await getStatistics(selectedRange.value);
    stats.value = data;
    monthlySummary.value = buildMonthlySummary(data.dailyTrend);
    yearlySummary.value = buildYearlySummary(data.dailyTrend);
  } catch (error) {
    const fallbackMessage = 'データ取得に失敗しました。期間を再選択して再度お試しください。';
    const serverMessage = isApiClientError(error) ? error.message : '';
    const content = serverMessage ? `${serverMessage}。期間を再選択して再度お試しください。` : fallbackMessage;
    notification.error({
      title: '統計ダッシュボード',
      content,
    });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats().catch(() => undefined);
});

// 期間タブの変更を監視して即座に統計を再取得する
watch(selectedRange, () => {
  loadStats().catch(() => undefined);
});

// 収支推移グラフ用のオプションを計算する
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

// 着順割合の円グラフオプションを計算する
const pieOption = computed(() => {
  if (!stats.value) return {};
  const counts = stats.value.placeCounts;

  return themedOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '着順',
        type: 'pie',
        radius: ['30%', '70%'],
        roseType: 'radius',
        minAngle: 5,
        label: {
          show: true,
          position: 'inside',
          formatter: (params: { name: string; percent?: number }) => {
            const percent = params.percent ?? 0;
            if (percent < 3) {
              return '';
            }
            return `{b|${params.name}}\n{d|${percent.toFixed(1)}%}`;
          },
          rich: {
            b: { fontSize: 12, fontWeight: 'bold', color: '#fff', lineHeight: 16 },
            d: { fontSize: 14, color: '#fff', lineHeight: 18 },
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
});

// 月次サマリ棒グラフのオプションを構築する
const monthlyOption = computed(() => themedOption({
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
}));

// 年次サマリ棒グラフのオプションを構築する
const yearlyOption = computed(() => themedOption({
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
}));
</script>

<template>
  <div class="statistics-page app-page">
    <AppPageHeader title="統計ダッシュボード" back-to="/dashboard">
      <template #right>
        <n-radio-group v-model:value="selectedRange" size="small">
          <n-radio-button v-for="range in ranges" :key="range" :value="range">
            {{ rangeLabels[range] }}
          </n-radio-button>
        </n-radio-group>
      </template>
    </AppPageHeader>
    <p class="eyebrow">ZOOメン ポータル</p>
    <p class="subtitle">期間を切り替えて最新の統計を確認しましょう。</p>

    <n-spin :show="loading">
      <div v-if="stats" class="stats-stack">
        <n-card class="summary-card">
          <div class="summary-metrics">
            <div class="metric">
              <span>総対局数</span>
              <strong>{{ stats.totalGames }}</strong>
            </div>
            <div class="metric">
              <span>総収支</span>
              <strong>{{ formatCurrency(stats.totalIncome) }}</strong>
            </div>
          </div>
        </n-card>

        <n-card class="chart-card" title="ゲームタイプ別収支">
          <v-chart :option="lineOption" autoresize class="chart" />
        </n-card>

        <n-card class="chart-card" title="着順の割合">
          <v-chart :option="pieOption" autoresize class="chart" />
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
}

.subtitle {
  margin: 0 0 8px;
  color: var(--color-subtle);
  font-size: 14px;
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
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric span {
  font-size: 13px;
  color: var(--color-subtle);
}

.metric strong {
  font-size: 22px;
  color: var(--color-brand);
}

.chart-card {
  padding: 12px;
}

.chart {
  width: 100%;
  height: 280px;
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
  .chart {
    height: 240px;
  }
}
</style>
