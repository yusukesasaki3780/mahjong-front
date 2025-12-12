import {
  apiClient,
  type AuthTokens,
  clearAuthTokens,
  refreshAuthTokens,
  setAuthTokens,
  setIsAdminFlag,
  setUserId,
} from './axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  userId?: string;
  user?: { id: string; isAdmin?: boolean; is_admin?: boolean; [key: string]: unknown };
  role?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
  expiresIn?: number;
  [key: string]: unknown;
}

const resolveIsAdmin = (payload: LoginResponse): boolean => {
  const fromUser = (payload.user ?? {}) as Partial<NonNullable<LoginResponse['user']>>;
  if (typeof fromUser.isAdmin === 'boolean') {
    return fromUser.isAdmin;
  }
  if (typeof fromUser.is_admin === 'boolean') {
    return Boolean(fromUser.is_admin);
  }
  if (typeof payload.isAdmin === 'boolean') {
    return payload.isAdmin;
  }
  if (typeof payload.is_admin === 'boolean') {
    return Boolean(payload.is_admin);
  }
  if (typeof payload.role === 'string') {
    return payload.role.toUpperCase() === 'ADMIN';
  }
  return false;
};

// メールアドレスとパスワードで認証し、取得したトークンとユーザー情報を保存する
export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
  setAuthTokens(data);
  const resolvedUserId = data.user?.id ?? data.userId;
  if (resolvedUserId) {
    setUserId(resolvedUserId);
  }
  setIsAdminFlag(resolveIsAdmin(data));
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
