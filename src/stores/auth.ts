import { defineStore } from 'pinia';
import { pinia } from './pinia';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_ID_KEY = 'userId';

const isBrowser = typeof window !== 'undefined';

type Nullable<T> = T | null;

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number | null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as Nullable<string>,
    refreshToken: null as Nullable<string>,
    userId: null as Nullable<string>,
    expiresIn: null as Nullable<number>,
    hydrated: false,
  }),
  actions: {
    hydrateFromStorage(): void {
      if (this.hydrated || !isBrowser) {
        this.hydrated = true;
        return;
      }
      this.accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      this.refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      this.userId = window.localStorage.getItem(USER_ID_KEY);
      this.hydrated = true;
    },
    setTokens(payload: TokenPayload): void {
      this.setAccessToken(payload.accessToken);
      this.setRefreshToken(payload.refreshToken);
      this.expiresIn = payload.expiresIn ?? null;
    },
    setAccessToken(token: Nullable<string>): void {
      this.accessToken = token ?? null;
    },
    setRefreshToken(token: Nullable<string>): void {
      this.refreshToken = token ?? null;
    },
    setUserId(userId: Nullable<string>): void {
      this.userId = userId ?? null;
    },
    clear(): void {
      this.accessToken = null;
      this.refreshToken = null;
      this.userId = null;
      this.expiresIn = null;
      this.hydrated = true;
    },
  },
});

export const authStore = useAuthStore(pinia);
authStore.hydrateFromStorage();
