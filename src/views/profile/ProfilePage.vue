<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, useMessage, type FormInst } from 'naive-ui';
import { getUser, patchUser, type UserProfile, type PatchUserPayload } from '../../api/users';
import { getStoredUserId } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';
import ErrorAlert from '../../components/common/ErrorAlert.vue';
import { extractErrorMessages } from '../../utils/validationMessages';

const router = useRouter();
const message = useMessage();
const userId = getStoredUserId();

const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInst | null>(null);
const profile = reactive({
  name: '',
  nickname: '',
  storeName: '',
  prefectureCode: '',
  email: '',
});
const errorMessages = ref<string[]>([]);

const profileFieldLabels = {
  name: '氏名',
  nickname: 'ニックネーム',
  email: 'メールアドレス',
};

const setErrors = (error: unknown, fallback: string): void => {
  errorMessages.value = extractErrorMessages(error, {
    fieldLabels: profileFieldLabels,
    fallbackMessage: fallback,
  });
};

const loadProfile = async (): Promise<void> => {
  if (!userId) {
    router.replace('/login');
    return;
  }

  loading.value = true;
  try {
    const data: UserProfile = await getUser(userId);
    profile.name = data.name ?? '';
    profile.email = data.email ?? '';
    profile.nickname = (data as UserProfile & { nickname?: string }).nickname ?? '';
    profile.storeName = (data as UserProfile & { storeName?: string }).storeName ?? '';
    profile.prefectureCode = (data as UserProfile & { prefectureCode?: string }).prefectureCode ?? '';
    errorMessages.value = [];
  } catch (error) {
    setErrors(error, 'プロフィールの取得に失敗しました。');
  } finally {
    loading.value = false;
  }
};

const buildPayload = (): PatchUserPayload => {
  const payload: PatchUserPayload = {};
  if (profile.name?.trim()) payload.name = profile.name.trim();
  if (profile.nickname?.trim()) payload.nickname = profile.nickname.trim();
  if (profile.storeName?.trim()) payload.storeName = profile.storeName.trim();
  if (profile.prefectureCode?.trim()) payload.prefectureCode = profile.prefectureCode.trim();
  if (profile.email?.trim()) payload.email = profile.email.trim();
  return payload;
};

const handleSave = async (): Promise<void> => {
  if (!formRef.value || !userId) return;

  errorMessages.value = [];

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  const payload = buildPayload();
  if (Object.keys(payload).length === 0) {
    message.error('更新する項目を入力してください。');
    return;
  }

  saving.value = true;
  try {
    await patchUser(userId, payload);
    message.success('プロフィールを更新しました');
    errorMessages.value = [];
  } catch (error) {
    setErrors(error, 'プロフィールの更新に失敗しました。');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadProfile().catch(() => undefined);
});
</script>

<template>
  <div class="profile-page">
    <n-card class="profile-card">
      <AppPageHeader title="プロフィール" back-to="/dashboard" />
      <ErrorAlert class="form-errors" :messages="errorMessages" title="入力内容を確認してください" />
      <n-form ref="formRef" :model="profile" label-placement="top">
        <n-form-item label="氏名" path="name" :rule="{ required: true, message: '氏名を入力してください' }">
          <n-input v-model:value="profile.name" placeholder="山田 太郎" />
        </n-form-item>
        <n-form-item label="ニックネーム" path="nickname">
          <n-input v-model:value="profile.nickname" placeholder="アプリに表示される名前" />
        </n-form-item>
        <n-form-item label="メールアドレス" path="email" :rule="{ required: true, message: 'メールアドレスを入力してください' }">
          <n-input v-model:value="profile.email" placeholder="example@mahjong-zoo.jp" />
        </n-form-item>
        <div class="actions">
          <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
        </div>
      </n-form>
      <div v-if="loading" class="loading-overlay">読み込み中...</div>
    </n-card>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  padding: 32px 16px;
  background: #f5f6fa;
  display: flex;
  justify-content: center;
}

.profile-card {
  width: 100%;
  max-width: 640px;
  position: relative;
}

.form-errors {
  margin-bottom: 16px;
}
:deep(.app-page-header) {
  margin-bottom: 16px;
}

.actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.loading-overlay {
  margin-top: 12px;
  color: #94a3b8;
  font-size: 0.9rem;
}
</style>
