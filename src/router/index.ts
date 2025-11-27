import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
} from 'vue-router';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import Dashboard from '../pages/Dashboard.vue';
import ResultList from '../views/results/ResultList.vue';
import ResultForm from '../views/results/ResultForm.vue';
import RankingPage from '../views/ranking/RankingPage.vue';
import ShiftCalendarPage from '../views/shifts/ShiftCalendarPage.vue';
import StatisticsPage from '../views/statistics/StatisticsPage.vue';
import GameSettingsPage from '../pages/settings/GameSettings.vue';
import SalaryPage from '../views/salary/SalaryPage.vue';
import ProfilePage from '../views/profile/ProfilePage.vue';
import { getAccessToken, setUnauthorizedHandler } from '../api/axios';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'register',
    component: Register,
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/results',
    name: 'results-list',
    component: ResultList,
    meta: { requiresAuth: true },
  },
  {
    path: '/records',
    redirect: '/results',
    meta: { requiresAuth: true },
  },
  {
    path: '/results/new',
    name: 'results-new',
    component: ResultForm,
    meta: { requiresAuth: true },
  },
  {
    path: '/results/:id/edit',
    name: 'results-edit',
    component: ResultForm,
    meta: { requiresAuth: true },
  },
  {
    path: '/ranking',
    name: 'ranking',
    component: RankingPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/shift',
    name: 'shift',
    component: ShiftCalendarPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/salary',
    name: 'salary',
    component: SalaryPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/stats',
    name: 'statistics',
    component: StatisticsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: GameSettingsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    redirect: '/login',
    meta: { requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login',
    meta: { requiresAuth: false },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

const handleAuthGuard = (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
): void => {
  const isAuthenticated = Boolean(getAccessToken());
  console.log('[Guard] entering', { to: to.path, meta: to.meta, isAuthenticated });

  if (to.path === '/login' && isAuthenticated) {
    console.log('[Guard] Authenticated user visiting login → allow');
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    console.log('[Guard] requiresAuth triggered → redirect to login');
    next({ path: '/login', query: { redirect: to.fullPath } });
    return;
  }

  console.log('[Guard] normal navigation');
  next();
};

router.beforeEach(handleAuthGuard);

setUnauthorizedHandler((error) => {
  console.warn('Unauthorized response detected', error);
  const currentRoute = router.currentRoute.value;
  if (currentRoute.path === '/login') {
    return;
  }

  const redirect =
    currentRoute.fullPath && currentRoute.fullPath !== '/login'
      ? currentRoute.fullPath
      : undefined;

  router
    .replace({ path: '/login', query: redirect ? { redirect } : undefined })
    .catch(() => undefined);
});

export default router;
