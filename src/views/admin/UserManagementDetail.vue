<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NCard } from 'naive-ui';
import AppPageHeader from '../../components/common/AppPageHeader.vue';
import ErrorAlert from '../../components/common/ErrorAlert.vue';
import { fetchAdminUser, type AdminUserDetail } from '../../api/adminUsers';
import { extractErrorMessages } from '../../utils/validationMessages';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const user = ref<AdminUserDetail | null>(null);
const errorMessages = ref<string[]>([]);

const formatDate = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  return dayjs(value).format('YYYY/MM/DD HH:mm');
};

const displayName = computed(() => user.value?.name ?? 'ユーザー詳細');
const statusLabel = computed(() => (user.value?.isDeleted ? '削除済み' : '有効'));

const loadDetail = async (): Promise<void> => {
  const userId = route.params.id as string | undefined;
  if (!userId) {
    router.replace('/admin/users');
    return;
  }
  loading.value = true;
  errorMessages.value = [];
  try {
    user.value = await fetchAdminUser(userId);
  } catch (error) {
    errorMessages.value = extractErrorMessages(error, {
      fallbackMessage: 'ユーザー詳細の取得に失敗しました',
    });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadDetail().catch(() => undefined);
});
</script>

<template>
  <div class="admin-user-detail app-page">
    <AppPageHeader :title="displayName" back-to="/admin/users" />
    <n-card>
      <template #header-extra>
        <n-button tertiary size="small" @click="router.push('/admin/users')">一覧に戻る</n-button>
      </template>
      <ErrorAlert v-if="errorMessages.length" :messages="errorMessages" title="エラー" class="error-alert" />
      <div v-if="loading" class="loading">読み込み中...</div>
      <div v-else-if="user" class="detail-grid">
        <div class="detail-card">
          <h4>基本情報</h4>
          <dl>
            <div>
              <dt>氏名</dt>
              <dd>{{ user.name }}</dd>
            </div>
            <div>
              <dt>ニックネーム</dt>
              <dd>{{ user.nickname || user.nickName || '—' }}</dd>
            </div>
            <div>
              <dt>メールアドレス</dt>
              <dd>{{ user.email }}</dd>
            </div>
            <div>
              <dt>所属店舗</dt>
              <dd>{{ user.storeName || '未登録' }}</dd>
            </div>
            <div>
              <dt>状態</dt>
              <dd>
                <span
                  :class="[
                    'status-badge',
                    user.isDeleted ? 'status-badge--deleted' : 'status-badge--active',
                  ]"
                >
                  {{ statusLabel }}
                </span>
              </dd>
            </div>
            <div>
              <dt>zoo ID</dt>
              <dd>{{ user.zooId ?? '―' }}</dd>
            </div>
          </dl>
        </div>
        <div class="detail-card">
          <h4>ステータス</h4>
          <dl>
            <div>
              <dt>最終ログイン</dt>
              <dd>{{ formatDate(user.lastLoginAt) }}</dd>
            </div>
            <div>
              <dt>登録日時</dt>
              <dd>{{ formatDate(user.createdAt) }}</dd>
            </div>
            <div>
              <dt>更新日時</dt>
              <dd>{{ formatDate(user.updatedAt) }}</dd>
            </div>
            <div>
              <dt>都道府県</dt>
              <dd>{{ user.prefectureCode || '—' }}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div v-else class="empty">ユーザー情報が見つかりませんでした。</div>
    </n-card>
  </div>
</template>

<style scoped>
.admin-user-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-alert {
  margin-bottom: 12px;
}

.loading {
  padding: 16px 0;
  color: #94a3b8;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.detail-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  background: #f8fafc;
}

.detail-card h4 {
  margin: 0 0 12px;
}

dl {
  margin: 0;
}

dt {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 4px;
}

dd {
  margin: 0 0 12px;
  font-size: 15px;
  color: #0f172a;
}

.empty {
  padding: 24px 0;
  text-align: center;
  color: #94a3b8;
}

.status-badge {
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge--active {
  background: #dcfce7;
  color: #15803d;
}

.status-badge--deleted {
  background: #fee2e2;
  color: #b91c1c;
}
</style>
