<script setup lang="ts">
// 税金や当月の給与情報を確認するページです。
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NInputNumber,
  NList,
  NListItem,
  NSkeleton,
  useMessage,
} from 'naive-ui';
import dayjs from 'dayjs';
import {
  getSalary,
  updateAdvancePayment,
  type AdvancePaymentResponse,
  type SalarySummary,
  type SpecialAllowance,
} from '../../api/salary';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

const NIGHT_RATE_DEFAULT = 0.25;

const message = useMessage();
const router = useRouter();
const userId = getStoredUserId();

const selectedMonth = ref<string | null>(dayjs().format('YYYY-MM'));
const loading = ref(false);
const savingAdvance = ref(false);

const salaryResponse = ref<SalarySummary | null>(null);
const salaryDisplay = reactive({
  base: 0,
  nightExtra: 0,
  transport: 0,
  out: 0,
  deduction: 0,
  netAfterTax: 0,
});

const advancePayment = ref(0);

const specialAllowanceItems = computed<SpecialAllowance[]>(
  () => salaryResponse.value?.specialAllowanceBreakdown ?? salaryResponse.value?.specialAllowances ?? [],
);
const specialAllowanceTotal = computed(() => {
  if (specialAllowanceItems.value.length) {
    return specialAllowanceItems.value.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  }
  return (
    salaryResponse.value?.specialAllowance?.total ??
    salaryResponse.value?.specialAllowanceTotal ??
    0
  );
});
const nightAllowanceTypes = new Set(['night_bonus', 'special_late_night', 'night']);
const nightBonus = computed(
  () => specialAllowanceItems.value.find((item) => nightAllowanceTypes.has(item.type)) ?? null,
);

const formatHours = (value?: number | null): string => Number(value ?? 0).toFixed(1);
const formatCurrency = (value?: number | null): string =>
  `¥${Math.round(Number(value ?? 0)).toLocaleString('ja-JP')}`;
const formatUnitYen = (value?: number | null): string =>
  `${Math.round(Number(value ?? 0)).toLocaleString('ja-JP')}円`;
const formatRate = (value?: number | null): string => {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate)) {
    return '0';
  }
  const fixed = rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2);
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
};

const activeYearMonth = computed(() => selectedMonth.value ?? dayjs().format('YYYY-MM'));

const nightHours = computed(() => (salaryResponse.value?.totalNightMinutes ?? 0) / 60);
const nightHoursLabel = computed(() => formatHours(nightHours.value));
const nightRate = computed(() => salaryResponse.value?.nightExtraRate ?? NIGHT_RATE_DEFAULT);
const nightRateLabel = computed(() => formatRate(nightRate.value));
const nightHourlyWage = computed(() => {
  const explicit = salaryResponse.value?.nightHourlyWage;
  if (typeof explicit === 'number' && explicit > 0) {
    return explicit;
  }
  const hours = nightHours.value;
  const rate = nightRate.value || NIGHT_RATE_DEFAULT;
  if (hours > 0 && rate > 0) {
    return (salaryDisplay.nightExtra ?? 0) / (hours * rate);
  }
  return 0;
});
const nightHourlyLabel = computed(() => formatUnitYen(nightHourlyWage.value));

const nightBonusRate = computed(() => nightBonus.value?.rate ?? nightRate.value);
const nightBonusRateLabel = computed(() => formatRate(nightBonusRate.value));
const nightBonusUnitLabel = computed(() =>
  formatUnitYen(getAllowanceUnit(nightBonus.value) || nightHourlyWage.value),
);
const nightBonusHoursLabel = computed(() => formatHours(nightBonus.value?.hours ?? 0));

const getAllowanceUnit = (item?: SpecialAllowance | null): number => {
  if (!item) {
    return 0;
  }
  const fallback = (item as unknown as { unit?: number }).unit;
  return item.unitPrice ?? fallback ?? 0;
};

const formatAllowanceMeta = (item: SpecialAllowance): string => {
  const unitValue = getAllowanceUnit(item);
  if (nightAllowanceTypes.has(item.type)) {
    const rate = item.rate ?? nightBonusRate.value;
    return `${formatUnitYen(unitValue || nightHourlyWage.value)} × ${formatRate(rate)} × ${formatHours(item.hours ?? 0)}h`;
  }
  if (item.hours != null) {
    return `単価 ${formatUnitYen(unitValue)} × ${formatHours(item.hours)}h`;
  }
  return `単価 ${formatUnitYen(unitValue)}`;
};

const fetchSalary = async (): Promise<void> => {
  if (!userId) {
    router.replace('/login');
    return;
  }
  loading.value = true;
  try {
    const response = await getSalary(userId, activeYearMonth.value);
    salaryResponse.value = response;
    salaryDisplay.base = response.baseWageTotal ?? 0;
    salaryDisplay.nightExtra = response.nightExtraTotal ?? 0;
    salaryDisplay.transport = response.transportTotal ?? 0;
    salaryDisplay.out = response.gameIncomeTotal ?? 0;
    salaryDisplay.deduction = response.incomeTax ?? 0;
    salaryDisplay.netAfterTax = response.netSalary ?? 0;
    advancePayment.value = response.advanceAmount ?? 0;
  } catch (error) {
    const fallback = '給与情報の取得に失敗しました';
    message.error(isApiClientError(error) ? error.message : fallback);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchSalary().catch(() => undefined);
});

const grossPay = computed(() => {
  const base = salaryDisplay.base ?? 0;
  const night = salaryDisplay.nightExtra ?? 0;
  const special = specialAllowanceTotal.value ?? 0;
  const transport = salaryDisplay.transport ?? 0;
  const out = salaryDisplay.out ?? 0;
  return base + night + special + transport + out;
});

const netAfterTaxComputed = computed(() => salaryDisplay.netAfterTax ?? Math.max(0, grossPay.value - (salaryDisplay.deduction ?? 0)));

const totalPay = computed(() => {
  const advance = Number(advancePayment.value ?? 0);
  return Math.max(0, netAfterTaxComputed.value - advance);
});

const statItems = computed(() => [
  { label: '基本給', value: formatCurrency(salaryDisplay.base) },
  { label: '深夜給', value: formatCurrency(salaryDisplay.nightExtra) },
  { label: '特別手当', value: formatCurrency(specialAllowanceTotal.value) },
  { label: '交通費', value: formatCurrency(salaryDisplay.transport) },
  { label: 'アウト', value: formatCurrency(salaryDisplay.out) },
  { label: '控除額', value: formatCurrency(salaryDisplay.deduction) },
  { label: '控除後支給額', value: formatCurrency(netAfterTaxComputed.value) },
  { label: '前借額', value: formatCurrency(advancePayment.value) },
  { label: '合計支給額', value: formatCurrency(totalPay.value) },
]);

const handleSaveAdvance = async (): Promise<void> => {
  if (!userId) {
    return;
  }
  savingAdvance.value = true;
  try {
    const payload: AdvancePaymentResponse = { amount: Number(advancePayment.value ?? 0) };
    await updateAdvancePayment(userId, activeYearMonth.value, payload);
    message.success('前借額を保存しました');
  } catch (error) {
    const fallback = '前借額の保存に失敗しました';
    message.error(isApiClientError(error) ? error.message : fallback);
  } finally {
    savingAdvance.value = false;
  }
};
</script>

<template>
  <div class="salary-page app-page">
    <AppPageHeader title="給与計算" back-to="/dashboard" />
    <n-card class="controls-card">
      <div class="controls">
        <n-date-picker
          v-model:formatted-value="selectedMonth"
          type="month"
          value-format="yyyy-MM"
          format="yyyy-MM"
          clearable
        />
        <n-button type="primary" size="small" @click="fetchSalary">再読み込み</n-button>
      </div>
      <p class="controls-hint">対象月を選んで最新の給与情報を取得します。</p>
    </n-card>

    <n-skeleton v-if="loading" text :repeat="4" />

    <template v-else>
      <template v-if="salaryResponse">
        <n-card class="summary-card">
          <div class="summary-header">
            <span>対象年月</span>
            <strong>{{ salaryResponse.yearMonth }}</strong>
          </div>
          <div class="stat-grid">
            <div class="stat-item" v-for="item in statItems" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </n-card>

        <n-card class="night-card">
          <h3>深夜給（深夜時間：{{ nightHoursLabel }}h）</h3>
          <p class="night-card__formula">
            {{ nightHourlyLabel }} × {{ nightRateLabel }} × {{ nightHoursLabel }}h =
            <strong>{{ formatCurrency(salaryDisplay.nightExtra) }}</strong>
          </p>
          <p class="night-card__hint">深夜労働時間 × 時給 × 割増率 で計算しています。</p>
        </n-card>

        <n-card v-if="specialAllowanceItems.length" class="special-card">
          <div class="special-card__header">
            <h3>特別手当</h3>
            <span class="total-label">合計 {{ formatCurrency(specialAllowanceTotal) }}</span>
          </div>
          <div v-if="nightBonus" class="night-highlight">
            <div>
              <p class="night-highlight__title">特別深夜手当</p>
              <p class="night-highlight__formula">
                {{ nightBonusUnitLabel }} × {{ nightBonusRateLabel }} × {{ nightBonusHoursLabel }}h =
                <strong>{{ formatCurrency(nightBonus?.amount ?? 0) }}</strong>
              </p>
            </div>
          </div>
          <n-list>
            <n-list-item
              v-for="item in specialAllowanceItems"
              :key="item.specialHourlyWageId ?? item.label"
              class="special-item"
              :class="{ 'special-item--night': item.type === 'night_bonus' }"
            >
              <div>
                <strong>{{ item.label }}</strong>
                <p v-if="formatAllowanceMeta(item)" class="special-meta">
                  {{ formatAllowanceMeta(item) }}
                </p>
              </div>
              <span class="special-amount">{{ formatCurrency(item.amount) }}</span>
            </n-list-item>
          </n-list>
        </n-card>
      </template>
      <n-card v-else class="empty-card">表示できる給与データがありません。</n-card>

      <n-card class="advance-card" title="前借額の登録">
        <n-form label-placement="top">
          <n-form-item label="前借額">
            <n-input-number v-model:value="advancePayment" :step="1000" :min="0" />
          </n-form-item>
        </n-form>
        <div class="advance-actions">
          <n-button block type="primary" :loading="savingAdvance" @click="handleSaveAdvance">
            保存する
          </n-button>
        </div>
      </n-card>
    </template>
  </div>
</template>

<style scoped>
.salary-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.app-page-header) {
  margin-bottom: 8px;
}

.controls-card {
  padding: 16px;
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.controls :deep(.n-date-picker) {
  flex: 1;
}

.controls-hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--color-subtle);
}

.summary-card,
.night-card,
.special-card,
.advance-card {
  padding: 16px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--color-subtle);
}

.summary-header strong {
  font-size: 18px;
  color: var(--color-brand);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stat-item {
  background: rgba(45, 101, 255, 0.05);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item span {
  font-size: 12px;
  color: var(--color-subtle);
}

.stat-item strong {
  font-size: 16px;
  color: var(--color-text);
}

.night-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.night-card__formula {
  margin: 0;
  font-weight: 600;
  font-size: 15px;
}

.night-card__formula strong {
  margin-left: 8px;
}

.night-card__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-subtle);
}

.special-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.special-card__header h3 {
  margin: 0;
  font-size: 16px;
}

.night-highlight {
  border: 1px solid #ffe1a5;
  border-radius: 10px;
  padding: 12px;
  background: #fff8e6;
  margin-bottom: 12px;
}

.night-highlight__title {
  margin: 0;
  font-weight: 600;
}

.night-highlight__formula {
  margin: 4px 0 0;
  font-size: 14px;
}

.total-label {
  font-weight: 600;
}

.special-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.special-item + .special-item {
  margin-top: 8px;
}

.special-item--night {
  background: #fff9e6;
  border-color: #ffe0a6;
}

.special-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-subtle);
}

.special-amount {
  font-weight: 700;
  color: var(--color-text);
}

.advance-card {
  padding: 16px;
}

.advance-actions {
  margin-top: 8px;
}

.empty-card {
  text-align: center;
  color: var(--color-subtle);
  padding: 24px;
}
</style>
