<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpin,
  NTable,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui';
import AppPageHeader from '../../components/common/AppPageHeader.vue';
import ErrorAlert from '../../components/common/ErrorAlert.vue';
import {
  deleteAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  type AdminUserSummary,
} from '../../api/adminUsers';
import { extractErrorMessages } from '../../utils/validationMessages';
import { getStoredUserId } from '../../api/axios';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const currentUserId = getStoredUserId();

const loading = ref(false);
const users = ref<AdminUserSummary[]>([]);
const errorMessages = ref<string[]>([]);
const deletingUserId = ref<string | null>(null);

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 12;

const passwordFormRef = ref<FormInst | null>(null);
const passwordModalVisible = ref(false);
const passwordForm = reactive({
  newPassword: '',
});
const passwordTargetUser = ref<AdminUserSummary | null>(null);
const passwordSubmitting = ref(false);

const passwordRules: FormRules = {
  newPassword: [
    { required: true, message: '新しいパスワードを入力してください', trigger: 'blur' },
    {
      validator: (_rule, value: string) => {
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
      trigger: ['input', 'blur'],
    },
  ],
};

const formatLastLogin = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  return dayjs(value).format('YYYY/MM/DD HH:mm');
};

const displayUsers = computed(() => users.value.filter((user) => !user.isAdmin));

const handleErrors = (error: unknown, fallback: string): void => {
  errorMessages.value = extractErrorMessages(error, {
    fallbackMessage: fallback,
  });
};

const loadUsers = async (): Promise<void> => {
  loading.value = true;
  errorMessages.value = [];
  try {
    users.value = await fetchAdminUsers();
  } catch (error) {
    handleErrors(error, 'ユーザー一覧の取得に失敗しました');
  } finally {
    loading.value = false;
  }
};

const handleViewDetail = (userId: string): void => {
  router.push(`/admin/users/${userId}`);
};

const handleDeleteUser = (user: AdminUserSummary): void => {
  if (user.id === currentUserId) {
    message.warning('自分自身のアカウントは削除できません');
    return;
  }
  dialog.warning({
    title: 'このユーザーを削除しますか？',
    content: 'この操作は取り消せません。',
    positiveText: '削除',
    negativeText: 'キャンセル',
    type: 'error',
    onPositiveClick: async () => {
      deletingUserId.value = user.id;
      try {
        await deleteAdminUser(user.id);
        message.success('ユーザーを削除しました');
        await loadUsers();
      } catch (error) {
        handleErrors(error, 'ユーザーの削除に失敗しました');
      } finally {
        deletingUserId.value = null;
      }
    },
  });
};

const openPasswordModal = (user: AdminUserSummary): void => {
  passwordTargetUser.value = user;
  passwordForm.newPassword = '';
  passwordModalVisible.value = true;
  errorMessages.value = [];
};

const handlePasswordReset = async (): Promise<void> => {
  if (!passwordTargetUser.value || !passwordFormRef.value) {
    return;
  }
  try {
    await passwordFormRef.value.validate();
  } catch {
    return;
  }
  passwordSubmitting.value = true;
  try {
    await resetAdminUserPassword(passwordTargetUser.value.id, {
      newPassword: passwordForm.newPassword,
    });
    message.success('パスワードを再発行しました');
    passwordModalVisible.value = false;
    passwordTargetUser.value = null;
  } catch (error) {
    handleErrors(error, 'パスワードの再発行に失敗しました');
  } finally {
    passwordSubmitting.value = false;
  }
};

onMounted(() => {
  loadUsers().catch(() => undefined);
});
</script>

<template>
  <div class="admin-users-page app-page">
    <AppPageHeader title="ユーザー管理" back-to="/dashboard" />
    <n-card>
      <div class="card-header">
        <div>
          <h3>一般ユーザー一覧</h3>
          <p>氏名・連絡先・最終ログインを確認し、必要に応じて操作を行えます。</p>
        </div>
        <n-button tertiary size="small" :loading="loading" @click="loadUsers">再読み込み</n-button>
      </div>
      <ErrorAlert v-if="errorMessages.length" :messages="errorMessages" title="エラー" class="error-alert" />
      <n-spin :show="loading">
        <div v-if="displayUsers.length" class="user-table-wrapper desktop-only">
          <n-table :bordered="false" striped size="small">
            <thead>
              <tr>
                <th>氏名</th>
                <th>ニックネーム</th>
                <th>メールアドレス</th>
                <th>所属店舗</th>
                <th>最終ログイン</th>
                <th class="actions-header">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in displayUsers" :key="user.id">
                <td>{{ user.name }}</td>
                <td>{{ user.nickname || user.nickName || '—' }}</td>
                <td>{{ user.email }}</td>
                <td>{{ user.storeName || '未登録' }}</td>
                <td>{{ formatLastLogin(user.lastLoginAt) }}</td>
                <td class="actions-cell">
                  <n-button size="small" @click="handleViewDetail(user.id)">詳細</n-button>
                  <n-button size="small" tertiary type="warning" @click="openPasswordModal(user)">パスワード再発行</n-button>
                  <n-button
                    v-if="user.id !== currentUserId"
                    size="small"
                    type="error"
                    :loading="deletingUserId === user.id"
                    @click="handleDeleteUser(user)"
                  >
                    削除
                  </n-button>
                </td>
              </tr>
            </tbody>
          </n-table>
        </div>

        <div v-if="displayUsers.length" class="user-card-list mobile-only">
          <div v-for="user in displayUsers" :key="user.id" class="user-card">
            <div class="user-card-row">
              <span class="label">氏名</span>
              <span class="value">{{ user.name }}</span>
            </div>
            <div class="user-card-row">
              <span class="label">ニックネーム</span>
              <span class="value">{{ user.nickname || user.nickName || '—' }}</span>
            </div>
            <div class="user-card-row">
              <span class="label">メールアドレス</span>
              <span class="value">{{ user.email }}</span>
            </div>
            <div class="user-card-row">
              <span class="label">所属店舗</span>
              <span class="value">{{ user.storeName || '未登録' }}</span>
            </div>
            <div class="user-card-row">
              <span class="label">最終ログイン</span>
              <span class="value">{{ formatLastLogin(user.lastLoginAt) }}</span>
            </div>
            <div class="user-card-actions">
              <n-button size="tiny" @click="handleViewDetail(user.id)">詳細</n-button>
              <n-button size="tiny" tertiary type="warning" @click="openPasswordModal(user)">パスワード再発行</n-button>
              <n-button
                v-if="user.id !== currentUserId"
                size="tiny"
                type="error"
                :loading="deletingUserId === user.id"
                @click="handleDeleteUser(user)"
              >
                削除
              </n-button>
            </div>
          </div>
        </div>

        <div v-if="!displayUsers.length && !loading" class="empty-row">表示できるユーザーがありません。</div>
      </n-spin>
    </n-card>

    <n-modal v-model:show="passwordModalVisible" preset="card" title="パスワード再発行">
      <p class="modal-description">
        対象ユーザー: <strong>{{ passwordTargetUser?.name }}</strong>
      </p>
      <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-placement="top">
        <n-form-item label="新しいパスワード" path="newPassword">
          <n-input v-model:value="passwordForm.newPassword" type="password" placeholder="8〜12文字" />
        </n-form-item>
      </n-form>
      <div class="modal-actions">
        <n-button tertiary @click="passwordModalVisible = false">キャンセル</n-button>
        <n-button type="primary" :loading="passwordSubmitting" @click="handlePasswordReset">再発行</n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
.admin-users-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0 0 4px;
}

.card-header p {
  margin: 0;
  color: #475569;
  font-size: 13px;
}

.error-alert {
  margin-bottom: 12px;
}

.user-table-wrapper {
  border-radius: 12px;
  overflow-x: auto;
}

table :deep(th),
table :deep(td) {
  text-align: left;
  vertical-align: middle;
}

.actions-header,
.actions-cell {
  text-align: right;
  white-space: nowrap;
}

.actions-cell :deep(.n-button) {
  margin-left: 6px;
}

.empty-row {
  text-align: center;
  color: #94a3b8;
  padding: 18px 0;
}

.user-card-list {
  display: none;
}

.user-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  background: #f8fafc;
  margin-bottom: 12px;
}

.user-card-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
  gap: 12px;
}

.user-card-row .label {
  color: #94a3b8;
  flex: 0 0 90px;
}

.user-card-row .value {
  flex: 1;
  text-align: right;
  color: #0f172a;
  font-weight: 600;
  word-break: break-all;
}

.user-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.modal-description {
  margin: 0 0 12px;
  font-size: 14px;
  color: #475569;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

@media (max-width: 640px) {
  .desktop-only {
    display: none;
  }
  .mobile-only {
    display: block;
  }
  .card-header {
    flex-direction: column;
  }
  .card-header .n-button {
    align-self: flex-start;
  }
  .admin-users-page {
    padding: 0;
  }
}
</style>
