<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NInputNumber,
  NSkeleton,
  useMessage,
} from 'naive-ui';
import dayjs from 'dayjs';
import { getSalary, updateAdvancePayment, type AdvancePaymentResponse, type SalarySummary } from '../../api/salary';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';

const message = useMessage();
const router = useRouter();
const userId = getStoredUserId();

const selectedMonth = ref(Date.now());
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

const formattedMonth = computed(() => dayjs(selectedMonth.value).format('YYYY-MM'));

const formatCurrency = (value?: number | null): string =>
  `¥${Number(value ?? 0).toLocaleString('ja-JP')}`;

const fetchSalary = async (): Promise<void> => {
  if (!userId) {
    router.replace('/login');
    return;
  }
  loading.value = true;
  try {
    const response = await getSalary(userId, formattedMonth.value);
    salaryResponse.value = response;
    salaryDisplay.base = response.baseWageTotal ?? 0;
    salaryDisplay.nightExtra = response.nightExtraTotal ?? 0;
    salaryDisplay.transport = response.transportTotal ?? 0;
    salaryDisplay.out = response.gameIncomeTotal ?? 0;
    salaryDisplay.deduction = response.incomeTax ?? 0;
    salaryDisplay.netAfterTax = response.netSalary ?? 0;
    advancePayment.value = response.advanceAmount ?? 0;
  } catch (error) {
    const msg = isApiClientError(error) ? error.message : '給与情報の取得に失敗しました';
    message.error(msg);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchSalary().catch(() => undefined);
});

// 税引き後の支給額から前借額を差し引いた最終支給額を算出する
const totalPay = computed(() => {
  const net = salaryDisplay.netAfterTax ?? 0;
  const advance = Number(advancePayment.value ?? 0);
  return Math.max(0, net - advance);
});

// サマリーカードに表示する各行を生成する
const statItems = computed(() => [
  { label: '基本給', value: formatCurrency(salaryDisplay.base) },
  { label: '深夜給', value: formatCurrency(salaryDisplay.nightExtra) },
  { label: '交通費', value: formatCurrency(salaryDisplay.transport) },
  { label: 'アウト', value: formatCurrency(salaryDisplay.out) },
  { label: '控除', value: formatCurrency(salaryDisplay.deduction) },
  { label: '前借（控除）', value: formatCurrency(advancePayment.value) },
  { label: '合計支給', value: formatCurrency(totalPay.value) },
]);

// 入力した前借額をバックエンドへ保存する
const handleSaveAdvance = async (): Promise<void> => {
  if (!userId) {
    return;
  }
  savingAdvance.value = true;
  try {
    const payload: AdvancePaymentResponse = { amount: Number(advancePayment.value ?? 0) };
    await updateAdvancePayment(userId, formattedMonth.value, payload);
    message.success('前借額を保存しました');
  } catch (error) {
    const msg = isApiClientError(error) ? error.message : '前借額の保存に失敗しました';
    message.error(msg);
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
        <n-date-picker v-model:value="selectedMonth" type="month" clearable />
        <n-button type="primary" size="small" @click="fetchSalary">表示</n-button>
      </div>
      <p class="controls-hint">対象月を選択して表示してください。</p>
    </n-card>

    <n-skeleton v-if="loading" text :repeat="4" />

    <template v-else>
      <n-card v-if="salaryResponse" class="summary-card">
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
      <n-card v-else class="empty-card">表示できる給与情報がありません。</n-card>

      <n-card class="advance-card" title="前借額（控除対象）">
        <n-form label-placement="top">
          <n-form-item>
            <n-input-number v-model:value="advancePayment" :step="1000" :min="0" />
          </n-form-item>
        </n-form>
        <div class="advance-actions">
          <n-button block type="primary" :loading="savingAdvance" @click="handleSaveAdvance">
            前借額を保存
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

.summary-card {
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

.advance-card {
  padding: 16px;
}

.advance-actions {
  margin-top: 8px;
}

.empty-card {
  text-align: center;
  color: var(--color-subtle);
}
</style>
