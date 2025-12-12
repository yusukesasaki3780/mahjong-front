<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NIcon } from 'naive-ui';
import { clearAuthTokens } from '../api/axios';
import {
  ListOutline,
  AlbumsOutline,
  CashOutline,
  TrophyOutline,
  AnalyticsOutline,
  PersonCircleOutline,
  SettingsOutline,
  ShieldCheckmarkOutline,
} from '@vicons/ionicons5';
import AppPageHeader from '../components/common/AppPageHeader.vue';
import { useAuthStore } from '../stores/auth';

interface MenuItem {
  title: string;
  description: string;
  to: string;
  icon: typeof ListOutline;
}

const router = useRouter();
const authStore = useAuthStore();

const menuItems: MenuItem[] = [
  {
    title: 'シフト管理',
    description: 'シフト登録 / シフト一覧',
    to: '/shift',
    icon: ListOutline,
  },
  {
    title: '成績管理',
    description: '成績登録 / 成績照会',
    to: '/results',
    icon: AlbumsOutline,
  },
  {
    title: '給与計算',
    description: '月次給与サマリーを確認',
    to: '/salary',
    icon: CashOutline,
  },
  {
    title: 'ランキング',
    description: 'スタッフ別ランキングを確認',
    to: '/ranking',
    icon: TrophyOutline,
  },
  {
    title: '統計レポート',
    description: '勤務実績と分析レポート',
    to: '/stats',
    icon: AnalyticsOutline,
  },
  {
    title: 'プロフィール',
    description: 'ユーザー情報の確認 / 編集',
    to: '/profile',
    icon: PersonCircleOutline,
  },
  {
    title: '設定',
    description: 'ゲーム設定・給与計算パラメータ',
    to: '/settings',
    icon: SettingsOutline,
  },
];

const adminMenuItems: MenuItem[] = [
  {
    title: 'ユーザー管理',
    description: 'アカウント確認・削除・再発行',
    to: '/admin/users',
    icon: ShieldCheckmarkOutline,
  },
];

const showAdminMenu = computed(() => Boolean(authStore.isAdmin));

// 選択されたメニューの遷移先へルーターで画面遷移する
const handleNavigate = (path: string) => {
  router.push(path);
};

// ログアウトしてログイン画面へ戻す
const handleLogout = () => {
  clearAuthTokens();
  router.replace('/login');
};
</script>

<template>
  <div class="dashboard-page app-page app-page--right">
    <AppPageHeader title="ダッシュボード">
      <template #right>
        <n-button tertiary size="small" @click="handleLogout">ログアウト</n-button>
      </template>
    </AppPageHeader>
    <div class="dashboard-intro">
      <p class="eyebrow">ZOOメン ポータル</p>
      <p class="subtitle">必要なメニューを選んで操作を開始してください</p>
    </div>
    <div class="menu-grid" data-testid="dashboard-menu">
      <div
        v-for="item in menuItems"
        :key="item.to"
        class="menu-card-wrapper"
        role="button"
        tabindex="0"
        @click="handleNavigate(item.to)"
        @keyup.enter="handleNavigate(item.to)"
      >
        <n-card class="menu-card" hoverable clickable>
          <div class="menu-card-content">
            <div class="card-icon">
              <n-icon :component="item.icon" size="24" />
            </div>
            <div>
              <h2>{{ item.title }}</h2>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </n-card>
      </div>
    </div>
    <div v-if="showAdminMenu" class="admin-menu">
      <p class="admin-label">管理</p>
      <div class="menu-grid">
        <div
          v-for="item in adminMenuItems"
          :key="item.to"
          class="menu-card-wrapper"
          role="button"
          tabindex="0"
          @click="handleNavigate(item.to)"
          @keyup.enter="handleNavigate(item.to)"
        >
          <n-card class="menu-card menu-card--admin" hoverable clickable>
            <div class="menu-card-content">
              <div class="card-icon card-icon--admin">
                <n-icon :component="item.icon" size="24" />
              </div>
              <div>
                <h2>{{ item.title }}</h2>
                <p>{{ item.description }}</p>
              </div>
            </div>
          </n-card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.app-page-header) {
  padding: 12px clamp(12px, 4vw, 48px) 12px clamp(12px, 8vw, 160px);
  margin: 0;
}

:deep(.app-page-header h1) {
  margin: 0;
}

.dashboard-intro {
  padding: 0 4px;
  margin-left: clamp(12px, 8vw, 160px);
  max-width: 520px;
  text-align: left;
  padding-right: clamp(12px, 4vw, 48px);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-subtle);
  font-size: 12px;
  margin: 0 0 4px;
}

.subtitle {
  color: var(--color-subtle);
  margin: 0 0 16px;
  font-size: 14px;
  margin-left: clamp(12px, 8vw, 160px);
  max-width: 460px;
  padding-right: clamp(12px, 4vw, 48px);
}

.menu-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.menu-card-wrapper {
  cursor: pointer;
}

.menu-card {
  border-radius: var(--app-card-radius);
  box-shadow: var(--app-card-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.menu-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(45, 101, 255, 0.18);
}

.menu-card-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(45, 101, 255, 0.1);
  color: var(--color-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon--admin {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}

.menu-card h2 {
  font-size: 18px;
  margin: 0 0 4px;
}

.menu-card p {
  color: var(--color-subtle);
  margin: 0;
  font-size: 14px;
}

.admin-menu {
  margin-top: 16px;
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.admin-label {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #dc2626;
  margin: 0 0 12px;
}

.menu-card--admin {
  border: 1px solid rgba(220, 38, 38, 0.35);
}

@media (min-width: 520px) {
  .menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}

@media (max-width: 768px) {
  .dashboard-intro {
    margin-left: clamp(12px, 6vw, 24px);
    padding-right: clamp(12px, 6vw, 24px);
  }
  .subtitle {
    margin-left: clamp(12px, 6vw, 24px);
    max-width: 100%;
    padding-right: clamp(12px, 6vw, 24px);
  }
  :deep(.app-page-header) {
    padding: 12px clamp(12px, 6vw, 24px);
  }
}
</style>
