<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import {
  useMessage,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui';
import { apiClient } from '../api/axios';
import { prefectureOptions } from '../constants/prefectures';
import { extractErrorMessages } from '../utils/validationMessages';
import ErrorAlert from '../components/common/ErrorAlert.vue';

const router = useRouter();
const message = useMessage();
const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const storeOptions = ref<SelectOption[]>([]);
const errorMessages = ref<string[]>([]);

const formValue = reactive({
  name: '',
  nickname: '',
  storeName: '',
  prefectureCode: '',
  email: '',
  password: '',
  passwordConfirm: '',
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const registerFieldLabels = {
  name: '氏名',
  nickname: 'ニックネーム',
  storeName: '店舗',
  prefectureCode: '都道府県',
  email: 'メールアドレス',
  password: 'パスワード',
  passwordConfirm: 'パスワード確認',
};

const rules: FormRules = {
  name: [{ required: true, message: '氏名を入力してください', trigger: 'blur' }],
  nickname: [{ required: true, message: 'ニックネームを入力してください', trigger: 'blur' }],
  storeName: [{ required: true, message: '店舗を選択してください', trigger: 'change' }],
  prefectureCode: [{ required: true, message: '都道府県を選択してください', trigger: 'change' }],
  email: [
    { required: true, message: 'メールアドレスを入力してください', trigger: ['blur', 'input'] },
    {
      validator: (_rule, value: string) =>
        emailRegex.test(value)
          ? Promise.resolve()
          : Promise.reject('メールアドレスの形式が正しくありません'),
      trigger: ['blur', 'input'],
    },
  ],
  password: [{ required: true, message: 'パスワードを入力してください', trigger: 'blur' }],
  passwordConfirm: [
    {
      validator: (_rule, value: string) =>
        value === formValue.password ? Promise.resolve() : Promise.reject('パスワードが一致しません'),
      trigger: 'blur',
    },
  ],
};

const setErrorMessages = (error: unknown, fallback: string): void => {
  errorMessages.value = extractErrorMessages(error, {
    fieldLabels: registerFieldLabels,
    fallbackMessage: fallback,
  });
};

const fetchStores = async (): Promise<void> => {
  try {
    const { data } = await apiClient.get<Array<{ id: number; storeName: string }>>('/stores');
    storeOptions.value = data.map((store) => ({ label: store.storeName, value: store.storeName }));
  } catch (error) {
    setErrorMessages(error, '店舗リストの取得に失敗しました。');
  }
};

onMounted(() => {
  fetchStores().catch(() => undefined);
});

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return;
  errorMessages.value = [];

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    await apiClient.post('/register', {
      name: formValue.name,
      nickname: formValue.nickname,
      storeName: formValue.storeName,
      prefectureCode: formValue.prefectureCode,
      email: formValue.email,
      password: formValue.password,
      passwordConfirm: formValue.passwordConfirm,
    });
    message.success('登録が完了しました。ログインしてください。');
    errorMessages.value = [];
    router.push('/login');
  } catch (error) {
    setErrorMessages(error, '登録に失敗しました。');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <n-card class="auth-card" title="新規登録">
      <ErrorAlert class="form-errors" :messages="errorMessages" title="入力内容を確認してください" />
      <n-form ref="formRef" :model="formValue" :rules="rules" label-placement="top" size="large">
        <n-form-item label="氏名" path="name">
          <n-input v-model:value="formValue.name" placeholder="山田 太郎" />
        </n-form-item>

        <n-form-item label="ニックネーム" path="nickname">
          <n-input v-model:value="formValue.nickname" placeholder="ニックネーム" />
        </n-form-item>

        <n-form-item label="店舗" path="storeName">
          <n-select
            v-model:value="formValue.storeName"
            :options="storeOptions"
            placeholder="店舗を選択"
          />
        </n-form-item>

        <n-form-item label="都道府県" path="prefectureCode">
          <n-select
            v-model:value="formValue.prefectureCode"
            :options="prefectureOptions"
            placeholder="都道府県を選択"
          />
        </n-form-item>

        <n-form-item label="メールアドレス" path="email">
          <n-input v-model:value="formValue.email" placeholder="example@mahjong-zoo.jp" />
        </n-form-item>

        <n-form-item label="パスワード" path="password">
          <n-input v-model:value="formValue.password" type="password" placeholder="********" />
        </n-form-item>

        <n-form-item label="パスワード確認" path="passwordConfirm">
          <n-input v-model:value="formValue.passwordConfirm" type="password" placeholder="再入力" />
        </n-form-item>

        <div class="actions">
          <n-button type="primary" block size="large" :loading="loading" @click="handleSubmit">
            登録する
          </n-button>

          <RouterLink class="auth-link" to="/login">
            すでにアカウントをお持ちの方はこちら
          </RouterLink>
        </div>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #f5f6fa, #edf2ff);
}

.auth-card {
  width: 420px;
  max-width: 100%;
  border-radius: 16px;
  box-shadow: 0 15px 30px rgba(15, 23, 42, 0.15);
}

.form-errors {
  margin-bottom: 16px;
}

.actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-link {
  font-size: 0.9rem;
  text-align: center;
  color: #10b981;
  text-decoration: none;
  transition: opacity 0.2s ease, text-decoration 0.2s ease;
}

.auth-link:hover {
  opacity: 0.85;
  text-decoration: underline;
}
</style>
