// 共通のaxiosインスタンス設定とリクエスト/レスポンス制御を担うユーティリティです。
﻿import axios, { AxiosHeaders } from 'axios';
import { authStore } from '../stores/auth';
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestHeaders,
} from 'axios';

// const API_BASE_URL = 'http://localhost:8080';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_ID_KEY = 'userId';
const AUTH_STATE_KEY = 'auth';
const IS_ADMIN_KEY = 'isAdmin';
const isBrowser = typeof window !== 'undefined';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

type AuthState = {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  expiresIn?: number;
  isAdmin?: boolean;
};

const readAuthState = (): AuthState | null => {
  if (!isBrowser) {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STATE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
};

const writeAuthState = (partial: AuthState): void => {
  if (!isBrowser) {
    return;
  }
  const current = readAuthState() ?? {};
  const next: AuthState = { ...current, ...partial };
  window.localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(next));
};

const clearAuthState = (): void => {
  if (!isBrowser) {
    return;
  }
  window.localStorage.removeItem(AUTH_STATE_KEY);
};

const tokenStorage = {
  getAccessToken(): string | null {
    if (authStore.accessToken) {
      return authStore.accessToken;
    }
    const state = readAuthState();
    if (state?.accessToken) {
      authStore.setAccessToken(state.accessToken);
      return state.accessToken;
    }
    const local = isBrowser ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (local) {
      authStore.setAccessToken(local);
    }
    return local;
  },
  setAccessToken(token: string): void {
    if (isBrowser) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
    writeAuthState({ accessToken: token });
    authStore.setAccessToken(token);
  },
  getRefreshToken(): string | null {
    if (authStore.refreshToken) {
      return authStore.refreshToken;
    }
    const state = readAuthState();
    if (state?.refreshToken) {
      authStore.setRefreshToken(state.refreshToken);
      return state.refreshToken;
    }
    const local = isBrowser ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;
    if (local) {
      authStore.setRefreshToken(local);
    }
    return local;
  },
  setRefreshToken(token: string): void {
    if (isBrowser) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
    writeAuthState({ refreshToken: token });
    authStore.setRefreshToken(token);
  },
  clear(): void {
    if (isBrowser) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    clearAuthState();
    authStore.clear();
  },
};

const userIdStorage = {
  getUserId(): string | null {
    if (authStore.userId) {
      return authStore.userId;
    }
    const cached = isBrowser ? window.localStorage.getItem(USER_ID_KEY) : null;
    if (cached) {
      authStore.setUserId(cached);
    }
    return cached;
  },
  setUserId(userId: string): void {
    if (isBrowser) {
      window.localStorage.setItem(USER_ID_KEY, userId);
    }
    writeAuthState({ userId });
    authStore.setUserId(userId);
  },
  clear(): void {
    if (isBrowser) {
      window.localStorage.removeItem(USER_ID_KEY);
    }
    authStore.setUserId(null);
  },
};

const adminFlagStorage = {
  get(): boolean {
    if (authStore.isAdmin !== null) {
      return Boolean(authStore.isAdmin);
    }
    const state = readAuthState();
    if (typeof state?.isAdmin === 'boolean') {
      authStore.setIsAdmin(state.isAdmin);
      return state.isAdmin;
    }
    const cached = isBrowser ? window.localStorage.getItem(IS_ADMIN_KEY) : null;
    if (cached != null) {
      const flag = cached === 'true';
      authStore.setIsAdmin(flag);
      return flag;
    }
    return false;
  },
  set(flag: boolean): void {
    if (isBrowser) {
      window.localStorage.setItem(IS_ADMIN_KEY, String(flag));
    }
    writeAuthState({ isAdmin: flag });
    authStore.setIsAdmin(flag);
  },
  clear(): void {
    if (isBrowser) {
      window.localStorage.removeItem(IS_ADMIN_KEY);
      const raw = window.localStorage.getItem(AUTH_STATE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AuthState;
          if ('isAdmin' in parsed) {
            delete parsed.isAdmin;
            window.localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(parsed));
          }
        } catch {
          // ignore parse errors and fall through
        }
      }
    }
    authStore.setIsAdmin(null);
  },
};

const ensureHeaders = (headers?: AxiosRequestHeaders): AxiosHeaders => {
  if (headers instanceof AxiosHeaders) {
    return headers;
  }
  return AxiosHeaders.from(headers ?? {});
};

export interface ApiErrorPayload {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiClientError';
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export const isApiClientError = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError;

// Axios などから投げられた例外を ApiClientError に正規化する
const normalizeApiError = (error: unknown): ApiClientError => {
  if (isApiClientError(error)) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = (error.response?.data ?? {}) as Record<string, unknown>;
    const message = (data.message as string) ?? error.message ?? 'Request failed';
    const code = (data.code as string) ?? error.code;

    return new ApiClientError({
      status,
      code,
      message,
      details: data.details ?? data,
    });
  }

  return new ApiClientError({ message: 'Unexpected error occurred' });
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const applyDefaultAuthorizationHeader = (token?: string | null): void => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

const bootToken = tokenStorage.getAccessToken();
if (bootToken) {
  applyDefaultAuthorizationHeader(bootToken);
}

// 新しいアクセストークンとリフレッシュトークンを保存し、ヘッダーへ適用する
export const setAuthTokens = ({ accessToken, refreshToken, expiresIn }: AuthTokens): void => {
  tokenStorage.setAccessToken(accessToken);
  tokenStorage.setRefreshToken(refreshToken);
  writeAuthState({ expiresIn });
  applyDefaultAuthorizationHeader(accessToken);
};

// 保存済みのトークンとユーザー情報を破棄し、認証ヘッダーを外す
export const clearAuthTokens = (): void => {
  tokenStorage.clear();
  userIdStorage.clear();
  adminFlagStorage.clear();
  applyDefaultAuthorizationHeader(null);
};

const cloneParams = (params: InternalAxiosRequestConfig['params']): InternalAxiosRequestConfig['params'] => {
  if (params instanceof URLSearchParams) {
    const cloned = new URLSearchParams();
    params.forEach((value, key) => cloned.append(key, value));
    return cloned;
  }
  if (params && typeof params === 'object') {
    return JSON.parse(JSON.stringify(params));
  }
  return params;
};


interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _originalUrl?: string;
  _originalParams?: InternalAxiosRequestConfig['params'];
}

/**
 * Return a fresh copy of a request config restored to its original URL/params
 * without mutating the provided config object. This ensures queued/failed
 * requests remain unchanged and safe to reuse.
 */
const restoreRequestConfig = (config: RetryableRequestConfig): RetryableRequestConfig => {
  const restored: RetryableRequestConfig = { ...config } as RetryableRequestConfig;

  // keep original url if available
  if (config._originalUrl) {
    restored.url = config._originalUrl;
  }

  // prefer original params snapshot if we captured one
  if (config._originalParams) {
    restored.params = cloneParams(config._originalParams);
  } else if (restored.params) {
    // make sure params themselves are a cloned copy so retries can't mutate the original
    restored.params = cloneParams(restored.params);
  } else {
    restored.params = undefined;
  }

  // ensure we don't accidentally reuse any in-memory references
  restored.headers = ensureHeaders(restored.headers);
  return restored;
};

type PendingRequest = {
  resolve: (value: AxiosResponse) => void;
  reject: (reason?: unknown) => void;
  config: RetryableRequestConfig;
};

let isRefreshing = false;
const queue: PendingRequest[] = [];

const cloneRequestForQueue = (config: RetryableRequestConfig): RetryableRequestConfig => {
  const clone: RetryableRequestConfig = { ...config } as RetryableRequestConfig;
  clone.headers = ensureHeaders(clone.headers);

  if (config.params) {
    clone.params = cloneParams(config.params);
  } else {
    clone.params = undefined;
  }

  if (config._originalParams) {
    clone._originalParams = cloneParams(config._originalParams);
  }

  if (config.url) {
    clone.url = config.url;
  } else {
    clone.url = undefined;
  }

  if (config._originalUrl) {
    clone._originalUrl = config._originalUrl;
  }

  return clone;
};

const enqueueRequest = (config: RetryableRequestConfig): Promise<AxiosResponse> =>
  new Promise<AxiosResponse>((resolve, reject) => {
    // always push a copy so queued requests can't be mutated elsewhere
    queue.push({ resolve, reject, config: cloneRequestForQueue(config) });
  });

const processQueue = (error: unknown, token: string | null): void => {
  while (queue.length > 0) {
    const pending = queue.shift();
    if (!pending) {
      continue;
    }

    if (error) {
      pending.reject(error);
      continue;
    }

    // restore a new config for this retry (don't mutate the queued object)
    const restoredConfig = restoreRequestConfig(pending.config);

    // ensure we always attach fresh Authorization header when we have a token
    if (token) {
      const headers = ensureHeaders(restoredConfig.headers);
      headers.set('Authorization', `Bearer ${token}`);
      restoredConfig.headers = headers;
    }

    // mark as retried so we don't loop infinitely
    restoredConfig._retry = true;

    apiClient(restoredConfig).then(pending.resolve).catch(pending.reject);
  }
};

const requestNewTokens = async (): Promise<AuthTokens> => {
  const refreshToken = tokenStorage.getRefreshToken();
  const userId = userIdStorage.getUserId();
  if (!refreshToken) {
    throw new ApiClientError({
      status: 401,
      message: 'Missing refresh token',
      code: 'TOKEN_MISSING',
    });
  }

  console.log('[REFRESH] sending:', { refreshToken, userId });
  const response = await refreshClient.post<AuthTokens>('/auth/refresh', { refreshToken, userId });
  console.log('[REFRESH] success:', response.data);

  setAuthTokens(response.data);
  return response.data;
};

type UnauthorizedHandler = (error: ApiClientError) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

const notifyUnauthorized = (error: ApiClientError): void => {
  console.warn('[UNAUTHORIZED_HANDLER] invoked with error:', {
    status: error.status,
    code: error.code,
    message: error.message,
  });
  if (unauthorizedHandler) {
    unauthorizedHandler(error);
  }
};

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  const headers = ensureHeaders(config.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers = headers;

  const retryableConfig = config as RetryableRequestConfig;
  if (!retryableConfig._originalUrl && config.url) {
    retryableConfig._originalUrl = config.url;
  }
  if (!retryableConfig._originalParams && config.params) {
    retryableConfig._originalParams = cloneParams(config.params);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    if (!error.response) {
      console.warn('[Auth] Axios error without response', { url: originalRequest?.url, error });
    } else {
      console.warn('[Auth] Axios error with response', {
        url: originalRequest?.url,
        status: error.response.status,
        data: error.response.data,
      });
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const refreshToken = tokenStorage.getRefreshToken();
      console.warn('[Auth] 401 received, attempting refresh', {
        url: originalRequest.url,
        refreshTokenExists: Boolean(refreshToken),
      });

      if (!refreshToken) {
        const normalizedError = normalizeApiError(error);
        clearAuthTokens();
        notifyUnauthorized(normalizedError);
        return Promise.reject(normalizedError);
      }

      if (isRefreshing) {
        // queue a copy of the original request to be retried once refresh finishes
        return enqueueRequest(originalRequest);
      }

      // mark refresh in progress (do not mutate the original request)
      isRefreshing = true;

      try {
        const tokens = await requestNewTokens();
        processQueue(null, tokens.accessToken);

        // restore a fresh copy of the original request and attach Authorization
        const retryConfig = restoreRequestConfig(originalRequest);
        const retryHeaders = ensureHeaders(retryConfig.headers);
        retryHeaders.set('Authorization', `Bearer ${tokens.accessToken}`);
        retryConfig.headers = retryHeaders;
        retryConfig._retry = true;

        console.log('[REFRESH] retrying original request with Authorization', {
          url: retryConfig.url,
          authHeader: retryHeaders.get('Authorization'),
        });

        return apiClient(retryConfig);
      } catch (refreshError) {
        console.warn('[REFRESH] failed:', refreshError);
        const normalizedError = normalizeApiError(refreshError);
        clearAuthTokens();
        processQueue(refreshError, null);
        notifyUnauthorized(normalizedError);
        return Promise.reject(normalizedError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401) {
      console.warn('[Auth] 401 without retry', { url: error.config?.url });
      const normalizedError = normalizeApiError(error);
      console.warn('[UNAUTHORIZED_HANDLER] firing due to:', normalizedError);
      clearAuthTokens();
      notifyUnauthorized(normalizedError);
      return Promise.reject(normalizedError);
    }

    return Promise.reject(normalizeApiError(error));
  },
);

// refresh エンドポイントを直接呼び出してトークンを更新する
export const refreshAuthTokens = (): Promise<AuthTokens> => requestNewTokens();

// API のベース URL を返す
export const getApiBaseUrl = (): string => API_BASE_URL;
// 現在ローカルに保持しているトークン情報を取得する
export const getStoredTokens = (): AuthTokens | null => {
  const accessToken = tokenStorage.getAccessToken();
  const refreshToken = tokenStorage.getRefreshToken();

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
};

// ログイン中のユーザー ID を取得する
export const getStoredUserId = (): string | null => userIdStorage.getUserId();
export const getStoredIsAdmin = (): boolean => adminFlagStorage.get();

export const setAccessToken = tokenStorage.setAccessToken.bind(tokenStorage);
export const setRefreshToken = tokenStorage.setRefreshToken.bind(tokenStorage);
export const getAccessToken = tokenStorage.getAccessToken.bind(tokenStorage);
export const getRefreshToken = tokenStorage.getRefreshToken.bind(tokenStorage);
export const setUserId = userIdStorage.setUserId.bind(userIdStorage);
export const getUserId = userIdStorage.getUserId.bind(userIdStorage);
export const setIsAdminFlag = (flag: boolean): void => adminFlagStorage.set(flag);
