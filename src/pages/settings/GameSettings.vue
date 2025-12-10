<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  useMessage,
  useNotification,
  type SelectOption,
} from 'naive-ui';
import type { FormInst, FormRules } from 'naive-ui';
import { getStoredUserId, isApiClientError } from '../../api/axios';
import { getGameSettings, updateGameSettings, type GameSettings, type WageType } from '../../api/gameSettingsApi';
import {
  getSpecialHourlyWages,
  createSpecialHourlyWage,
  deleteSpecialHourlyWage,
  type SpecialHourlyWage,
} from '../../api/specialWages';
import AppPageHeader from '../../components/common/AppPageHeader.vue';
import ErrorAlert from '../../components/common/ErrorAlert.vue';
import { extractErrorMessages } from '../../utils/validationMessages';

const router = useRouter();
const notification = useNotification();
const message = useMessage();

const userId = getStoredUserId();
if (!userId) {
  router.replace('/login');
}

const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const saving = ref(false);
const errorMessages = ref<string[]>([]);

const defaultSettings = (): GameSettings => ({
  yonmaGameFee: 500,
  sanmaGameFee: 600,
  sanmaGameFeeBack: 0,
  yonmaTipUnit: 500,
  sanmaTipUnit: 500,
  wageType: 'HOURLY',
  hourlyWage: 1200,
  fixedSalary: 250000,
  nightRateMultiplier: 1.25,
  baseMinWage: 1113,
  incomeTaxRate: 0.1021,
  transportPerShift: 500,
});

const formValue = reactive<GameSettings>(defaultSettings());
const specialWages = ref<SpecialHourlyWage[]>([]);
const specialWageForm = reactive<{ label: string; hourlyWage: number | null; error?: string }>({
  label: '',
  hourlyWage: null,
  error: undefined,
});
const loadingSpecialWages = ref(false);

const wageTypeOptions: SelectOption[] = [
  { label: '時給制', value: 'HOURLY' },
  { label: '固定給制', value: 'FIXED' },
];

const wageType = computed<WageType>(() => formValue.wageType);
const isFixed = computed(() => wageType.value === 'FIXED');

const fieldLabels = {
  yonmaGameFee: '四麻ゲーム代',
  sanmaGameFee: '三麻ゲーム代',
  sanmaGameFeeBack: '三麻ゲーム代バック',
  yonmaTipUnit: '四麻チップ単価',
  sanmaTipUnit: '三麻チップ単価',
  wageType: '賃金体系',
  hourlyWage: '時給',
  fixedSalary: '固定給',
  nightRateMultiplier: '深夜割増倍率',
  baseMinWage: '最低保証時給',
  incomeTaxRate: '源泉徴収率',
  transportPerShift: '交通費',
};

const resetSpecialWageForm = (): void => {
  specialWageForm.label = '';
  specialWageForm.hourlyWage = null;
  specialWageForm.error = undefined;
};

const fetchSpecialWages = async (): Promise<void> => {
  loadingSpecialWages.value = true;
  try {
    specialWages.value = await getSpecialHourlyWages();
  } catch (error) {
    notification.error({
      title: '特別手当',
      content: isApiClientError(error) ? error.message : '特別手当の取得に失敗しました。',
    });
  } finally {
    loadingSpecialWages.value = false;
  }
};

const handleAddSpecialWage = async (): Promise<void> => {
  specialWageForm.error = undefined;
  const label = specialWageForm.label.trim();
  const hourly = specialWageForm.hourlyWage;

  if (!label) {
    specialWageForm.error = '名称を入力してください';
    return;
  }
  if (label.length > 50) {
    specialWageForm.error = '名称は50文字以内で入力してください';
    return;
  }
  const normalized = label.toLowerCase();
  if (specialWages.value.some((item) => item.label.trim().toLowerCase() === normalized)) {
    specialWageForm.error = '同じ名称が既に存在します';
    return;
  }
  if (hourly == null || Number.isNaN(hourly)) {
    specialWageForm.error = '時給を入力してください';
    return;
  }
  if (hourly < 0 || hourly > 100000) {
    specialWageForm.error = '時給は0〜100,000の範囲で入力してください';
    return;
  }

  try {
    const created = await createSpecialHourlyWage({
      label,
      hourlyWage: hourly,
    });
    specialWages.value.push(created);
    resetSpecialWageForm();
    message.success('特別手当を追加しました');
  } catch (error) {
    if (isApiClientError(error)) {
      const code = error.code ?? error.status?.toString();
      if (code === 'INVALID_LABEL' || code === 'INVALID_HOURLY_WAGE') {
        specialWageForm.error = error.message;
      } else {
        notification.error({ title: '特別手当', content: error.message });
      }
    } else {
      notification.error({
        title: '特別手当',
        content: '追加に失敗しました。',
      });
    }
  }
};

const handleDeleteSpecialWage = async (id: number): Promise<void> => {
  try {
    await deleteSpecialHourlyWage(id);
    specialWages.value = specialWages.value.filter((item) => item.id !== id);
    message.success('特別手当を削除しました');
  } catch (error) {
    notification.error({
      title: '特別手当',
      content: isApiClientError(error) ? error.message : '削除に失敗しました。',
    });
  }
};

const rules = computed<FormRules>(() => ({
  yonmaGameFee: [{ required: true, type: 'number', message: '四麻のゲーム代を入力してください', trigger: 'blur' }],
  sanmaGameFee: [{ required: true, type: 'number', message: '三麻のゲーム代を入力してください', trigger: 'blur' }],
  sanmaGameFeeBack: [
    { required: true, type: 'number', message: '三麻ゲーム代バックを入力してください', trigger: 'blur' },
    {
      type: 'number',
      min: 0,
      max: 99999,
      message: '三麻ゲーム代バックは0〜99999の範囲で入力してください',
      trigger: 'blur',
    },
  ],
  yonmaTipUnit: [{ required: true, type: 'number', message: '四麻チップ単価を入力してください', trigger: 'blur' }],
  sanmaTipUnit: [{ required: true, type: 'number', message: '三麻チップ単価を入力してください', trigger: 'blur' }],
  wageType: [{ required: true, message: '賃金体系を選択してください', trigger: 'change' }],
  hourlyWage: isFixed.value
    ? [{ type: 'number', trigger: 'blur' }]
    : [{ required: true, type: 'number', message: '時給を入力してください', trigger: 'blur' }],
  fixedSalary: isFixed.value
    ? [{ required: true, type: 'number', message: '固定給を入力してください', trigger: 'blur' }]
    : [{ type: 'number', trigger: 'blur' }],
  nightRateMultiplier: [{ required: true, type: 'number', message: '深夜割増倍率を入力してください', trigger: 'blur' }],
  baseMinWage: [{ required: true, type: 'number', message: '最低保証時給を入力してください', trigger: 'blur' }],
  incomeTaxRate: [{ required: true, type: 'number', message: '源泉徴収率を入力してください', trigger: 'blur' }],
  transportPerShift: [{ required: true, type: 'number', message: '交通費を入力してください', trigger: 'blur' }],
}));

const friendlyError = (error: unknown, fallback: string): string[] =>
  extractErrorMessages(error, {
    fieldLabels,
    fallbackMessage: fallback,
  });

const fetchSettings = async (): Promise<void> => {
  if (!userId) {
    return;
  }
  loading.value = true;
  errorMessages.value = [];
  try {
    const data = await getGameSettings(userId);
    Object.assign(formValue, data);
  } catch (error) {
    if (isApiClientError(error) && error.status === 404) {
      notification.warning({
        title: '設定が未登録です',
        content: '初期値を読み込みました。必要な値を入力して保存してください。',
      });
      Object.assign(formValue, defaultSettings());
    } else {
      errorMessages.value = friendlyError(error, '設定の取得に失敗しました。');
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchSettings().catch(() => undefined);
  fetchSpecialWages().catch(() => undefined);
});

const handleBack = (): void => {
  router.push('/dashboard');
};

const handleSubmit = async (): Promise<void> => {
  if (!userId || !formRef.value) {
    return;
  }

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  errorMessages.value = [];
  try {
    await updateGameSettings(userId, { ...formValue });
    message.success('ゲーム設定を保存しました');
    router.push('/dashboard');
  } catch (error) {
    errorMessages.value = friendlyError(error, '設定の保存に失敗しました。');
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="settings-page">
    <AppPageHeader title="ゲーム設定" back-to="/dashboard" />
    <n-card>
      <ErrorAlert
        class="form-errors"
        :messages="errorMessages"
        title="入力内容を確認してください"
      />
      <n-form
        ref="formRef"
        :model="formValue"
        :rules="rules"
        label-placement="top"
        size="large"
        :disabled="loading"
      >
        <div class="form-grid">
          <n-form-item label="四麻ゲーム代" path="yonmaGameFee">
            <n-input-number v-model:value="formValue.yonmaGameFee" :step="100" />
          </n-form-item>
          <n-form-item label="三麻ゲーム代" path="sanmaGameFee">
            <n-input-number v-model:value="formValue.sanmaGameFee" :step="100" />
          </n-form-item>
          <n-form-item label="三麻ゲーム代バック" path="sanmaGameFeeBack">
            <n-input-number
              v-model:value="formValue.sanmaGameFeeBack"
              :step="100"
              :min="0"
              :max="99999"
            />
          </n-form-item>
          <n-form-item label="四麻チップ単価" path="yonmaTipUnit">
            <n-input-number v-model:value="formValue.yonmaTipUnit" :step="100" />
          </n-form-item>
          <n-form-item label="三麻チップ単価" path="sanmaTipUnit">
            <n-input-number v-model:value="formValue.sanmaTipUnit" :step="100" />
          </n-form-item>
          <n-form-item label="賃金体系" path="wageType">
            <n-select v-model:value="formValue.wageType" :options="wageTypeOptions" />
          </n-form-item>
          <n-form-item label="時給" path="hourlyWage">
            <n-input-number v-model:value="formValue.hourlyWage" :step="50" :disabled="isFixed" />
          </n-form-item>
          <n-form-item label="固定給" path="fixedSalary">
            <n-input-number v-model:value="formValue.fixedSalary" :step="1000" :disabled="!isFixed" />
          </n-form-item>
          <n-form-item label="深夜割増倍率" path="nightRateMultiplier">
            <n-input-number v-model:value="formValue.nightRateMultiplier" :step="0.05" />
          </n-form-item>
          <n-form-item label="最低保証時給" path="baseMinWage">
            <n-input-number v-model:value="formValue.baseMinWage" :step="10" />
          </n-form-item>
          <n-form-item label="源泉徴収率" path="incomeTaxRate">
            <n-input-number v-model:value="formValue.incomeTaxRate" :step="0.01" />
          </n-form-item>
          <n-form-item label="交通費（1日あたり）" path="transportPerShift">
            <n-input-number v-model:value="formValue.transportPerShift" :step="50" />
          </n-form-item>
        </div>
        <div class="form-actions">
          <n-button quaternary @click="handleBack">キャンセル</n-button>
          <n-button type="primary" :loading="saving" @click="handleSubmit">保存する</n-button>
        </div>
      </n-form>
      <section class="special-wage-section">
        <div class="special-wage-header">
          <h3>特別手当時給</h3>
          <n-button size="small" tertiary :loading="loadingSpecialWages" @click="fetchSpecialWages">
            再読み込み
          </n-button>
        </div>
        <div class="special-wage-form">
          <n-input v-model:value="specialWageForm.label" placeholder="特別手当①" />
          <n-input-number
            v-model:value="specialWageForm.hourlyWage"
            :show-button="false"
            placeholder="1500"
            :min="0"
            :max="100000"
          />
          <n-button type="primary" :loading="loadingSpecialWages" @click="handleAddSpecialWage">
            追加
          </n-button>
        </div>
        <p v-if="specialWageForm.error" class="special-wage-error">{{ specialWageForm.error }}</p>
        <div v-if="specialWages.length" class="special-wage-list">
          <n-card
            v-for="item in specialWages"
            :key="item.id"
            size="small"
            class="wage-item"
            bordered
          >
            <div class="wage-item__content">
              <div>
                <strong>{{ item.label }}</strong>
                <p>{{ item.hourlyWage.toLocaleString() }} 円 / 時</p>
              </div>
              <n-button size="tiny" tertiary type="error" @click="handleDeleteSpecialWage(item.id)">削除</n-button>
            </div>
          </n-card>
        </div>
        <p v-else class="special-wage-empty">
          登録された特別手当はありません。名称と時給を入力して追加してください。
        </p>
      </section>
    </n-card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

:deep(.app-page-header) {
  margin-bottom: 16px;
}

.form-errors {
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.special-wage-section {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.special-wage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.special-wage-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  align-items: end;
}

.special-wage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wage-item__content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.special-wage-empty {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.special-wage-error {
  color: #dc2626;
  font-size: 13px;
  margin: -4px 0 8px;
}
</style>
