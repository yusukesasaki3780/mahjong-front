<script setup lang="ts">
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
} from '@vicons/ionicons5';
import AppPageHeader from '../components/common/AppPageHeader.vue';

interface MenuItem {
  title: string;
  description: string;
  to: string;
  icon: typeof ListOutline;
}

const router = useRouter();

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
  <div class="dashboard-page app-page">
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
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.app-page-header) {
  padding: 12px 16px;
  margin: 0 -16px;
}

.dashboard-intro {
  padding: 0 4px;
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

.menu-card h2 {
  font-size: 18px;
  margin: 0 0 4px;
}

.menu-card p {
  color: var(--color-subtle);
  margin: 0;
  font-size: 14px;
}

@media (min-width: 520px) {
  .menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}
</style>
