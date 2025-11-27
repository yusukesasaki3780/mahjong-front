import { computed } from 'vue';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  type AuthTokens,
} from '../api/axios';

export const useAuth = () => {
  const isAuthenticated = computed(() => Boolean(getAccessToken()));

  const saveTokens = (tokens: AuthTokens): void => {
    setAuthTokens(tokens);
  };

  const logout = (): void => {
    clearAuthTokens();
  };

  return {
    isAuthenticated,
    getAccessToken,
    getRefreshToken,
    saveTokens,
    logout,
  };
};

