import {
  apiClient,
  type AuthTokens,
  clearAuthTokens,
  refreshAuthTokens,
  setAuthTokens,
  setUserId,
} from './axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  userId?: string;
  user?: { id: string; [key: string]: unknown };
  role?: string;
  expiresIn?: number;
  [key: string]: unknown;
}

// メールアドレスとパスワードで認証し、取得したトークンとユーザー情報を保存する
export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
  setAuthTokens(data);
  const resolvedUserId = data.user?.id ?? data.userId;
  if (resolvedUserId) {
    setUserId(resolvedUserId);
  }
  return data;
};

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

// リフレッシュトークンを使ってアクセストークンを更新する
export const refreshTokens = async (payload?: RefreshRequest): Promise<RefreshResponse> => {
  if (payload?.refreshToken) {
    const { data } = await apiClient.post<RefreshResponse>('/auth/refresh', payload);
    setAuthTokens(data);
    return data;
  }

  const tokens = await refreshAuthTokens();
  return tokens as RefreshResponse;
};

export interface LogoutOptions {
  notifyServer?: boolean;
}

// 必要に応じてサーバー通知しつつクライアント側の認証情報を破棄する
export const logout = async (options: LogoutOptions = {}): Promise<void> => {
  if (options.notifyServer) {
    await apiClient.post('/auth/logout');
  }

  clearAuthTokens();
};
