<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, useDialog, useMessage, type FormInst, type FormRules } from 'naive-ui';
import { getUser, patchUser, deleteMyAccount, type UserProfile, type PatchUserPayload } from '../../api/users';
import { clearAuthTokens, getStoredUserId, setIsAdminFlag } from '../../api/axios';
import AppPageHeader from '../../components/common/AppPageHeader.vue';
import ErrorAlert from '../../components/common/ErrorAlert.vue';
import { extractErrorMessages } from '../../utils/validationMessages';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const userId = getStoredUserId();

const loading = ref(false);
const saving = ref(false);
const deletingAccount = ref(false);
const formRef = ref<FormInst | null>(null);
const profile = reactive({
  name: '',
  nickname: '',
  storeName: '',
  prefectureCode: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
});
const errorMessages = ref<string[]>([]);

const profileFieldLabels = {
  name: '氏名',
  nickname: 'ニックネーム',
  email: 'メールアドレス',
  currentPassword: '現在のパスワード',
  newPassword: '新しいパスワード',
  confirmNewPassword: '確認用パスワード',
};

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 12;

const rules: FormRules = {
  name: [{ required: true, message: '氏名を入力してください', trigger: 'blur' }],
  email: [{ required: true, message: 'メールアドレスを入力してください', trigger: 'blur' }],
  currentPassword: [
    {
      validator: (_rule, value: string) => {
        if (!value) return Promise.resolve();
        if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
          return Promise.reject(
            new Error(`現在のパスワードは${PASSWORD_MIN}〜${PASSWORD_MAX}文字で入力してください`),
          );
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  newPassword: [
    {
      validator: (_rule, value: string) => {
        if (!profile.currentPassword) return Promise.resolve();
        if (!value) {
          return Promise.reject(new Error('新しいパスワードを入力してください'));
        }
        if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
          return Promise.reject(
            new Error(`新しいパスワードは${PASSWORD_MIN}〜${PASSWORD_MAX}文字で入力してください`),
          );
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  confirmNewPassword: [
    {
      validator: (_rule, value: string) => {
        if (!profile.currentPassword) return Promise.resolve();
        if (!value) {
          return Promise.reject(new Error('確認用パスワードを入力してください'));
        }
        if (value !== profile.newPassword) {
          return Promise.reject(new Error('新しいパスワードが一致しません'));
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
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
    profile.currentPassword = '';
    profile.newPassword = '';
    profile.confirmNewPassword = '';
    setIsAdminFlag(Boolean(data.isAdmin ?? (data as Record<string, unknown>).is_admin));
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
  if (profile.currentPassword.trim()) {
    payload.currentPassword = profile.currentPassword.trim();
    if (profile.newPassword.trim()) {
      payload.newPassword = profile.newPassword.trim();
    }
  }
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

  const passwordChanged = Boolean(payload.newPassword);

  saving.value = true;
  try {
    await patchUser(userId, payload);
    if (passwordChanged) {
      message.success('パスワードを変更しました');
      profile.currentPassword = '';
      profile.newPassword = '';
      profile.confirmNewPassword = '';
    } else {
      message.success('保存しました');
    }
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

const handleDeleteAccount = () => {
  dialog.warning({
    title: 'アカウントを削除しますか？',
    content: 'この操作は取り消せません。本当に削除してよろしいですか？',
    positiveText: '削除する',
    negativeText: 'キャンセル',
    onPositiveClick: async () => {
      deletingAccount.value = true;
      try {
        await deleteMyAccount();
        clearAuthTokens();
        message.success('アカウントを削除しました');
        router.replace('/login');
      } catch (error) {
        setErrors(error, 'アカウントの削除に失敗しました。');
      } finally {
        deletingAccount.value = false;
      }
    },
  });
};
</script>

<template>
  <div class="profile-page">
    <n-card class="profile-card">
      <AppPageHeader title="プロフィール" back-to="/dashboard" />
      <ErrorAlert class="form-errors" :messages="errorMessages" title="入力内容を確認してください" />
      <n-form ref="formRef" :model="profile" :rules="rules" label-placement="top">
        <n-form-item label="氏名" path="name">
          <n-input v-model:value="profile.name" placeholder="山田 太郎" />
        </n-form-item>
        <n-form-item label="ニックネーム" path="nickname">
          <n-input v-model:value="profile.nickname" placeholder="アプリに表示される名前" />
        </n-form-item>
        <n-form-item label="メールアドレス" path="email">
          <n-input v-model:value="profile.email" placeholder="example@mahjong-zoo.jp" />
        </n-form-item>
        <div class="password-section">
          <h4>パスワード変更</h4>
          <p>パスワードを変更する場合は、現在のパスワードと新しいパスワードを入力してください。</p>
        </div>
        <n-form-item label="現在のパスワード" path="currentPassword">
          <n-input v-model:value="profile.currentPassword" type="password" placeholder="********" />
        </n-form-item>
        <n-form-item label="新しいパスワード" path="newPassword">
          <n-input v-model:value="profile.newPassword" type="password" placeholder="********" />
        </n-form-item>
        <n-form-item label="新しいパスワード（確認）" path="confirmNewPassword">
          <n-input v-model:value="profile.confirmNewPassword" type="password" placeholder="********" />
        </n-form-item>
        <div class="actions">
          <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
        </div>
      </n-form>
      <div class="danger-zone">
        <div>
          <h4>アカウント削除</h4>
          <p>この操作は取り消せません。十分ご注意ください。</p>
        </div>
        <n-button
          type="error"
          :loading="deletingAccount"
          :disabled="deletingAccount"
          @click="handleDeleteAccount"
        >
          アカウントを削除する
        </n-button>
      </div>
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

.password-section {
  margin: 16px 0 8px;
}

.password-section h4 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.password-section p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.danger-zone {
  margin-top: 32px;
  padding: 16px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fef2f2;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.danger-zone h4 {
  margin: 0;
  color: #b91c1c;
  font-size: 15px;
}

.danger-zone p {
  margin: 4px 0 0;
  color: #7f1d1d;
  font-size: 13px;
}

.loading-overlay {
  margin-top: 12px;
  color: #94a3b8;
  font-size: 0.9rem;
}
</style>
