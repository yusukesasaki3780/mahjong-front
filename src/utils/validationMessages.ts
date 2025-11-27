import { isApiClientError } from '../api/axios';

const camelToKey = (value: string): string => value.replace(/([A-Z])/g, '_$1').toLowerCase();

type FieldLabels = Record<string, string>;

const defaultFieldLabels: FieldLabels = {};

const normalizeFieldLabel = (field: string | undefined, labels: FieldLabels): string =>
  field ? labels[field] ?? labels[camelToKey(field)] ?? field : '入力内容';

const translateConstraintMessage = (fieldLabel: string, rawMessage: string): string => {
  const trimmed = rawMessage.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.includes('must not be blank') ||
    lower.includes('must not be null') ||
    lower.includes('must not be empty') ||
    lower.includes('should not be empty')
  ) {
    return `${fieldLabel}を入力してください`;
  }

  const betweenMatch = trimmed.match(/between\s+(\d+)\s+and\s+(\d+)/i);
  if (lower.includes('size must be between') && betweenMatch) {
    return `${fieldLabel}は${betweenMatch[1]}〜${betweenMatch[2]}文字以内で入力してください`;
  }

  const minMatch = trimmed.match(/greater than or equal to\s+(\d+)/i);
  if (minMatch) {
    return `${fieldLabel}は${minMatch[1]}以上で入力してください`;
  }

  const maxMatch = trimmed.match(/less than or equal to\s+(\d+)/i);
  if (maxMatch) {
    return `${fieldLabel}は${maxMatch[1]}以下で入力してください`;
  }

  if (
    lower.includes('well-formed email address') ||
    lower.includes('must match') ||
    lower.includes('invalid email')
  ) {
    return `${fieldLabel}の形式が正しくありません`;
  }

  if (lower.includes('already exists') || lower.includes('unique')) {
    return `${fieldLabel}が既に使用されています`;
  }

  if (lower.includes('passwords do not match')) {
    return 'パスワードが一致していません';
  }

  return trimmed;
};

const collectMessages = (
  source: unknown,
  labels: FieldLabels,
  out: Set<string>,
  currentField?: string,
): void => {
  if (source == null) {
    return;
  }

  if (Array.isArray(source)) {
    source.forEach((item) => collectMessages(item, labels, out, currentField));
    return;
  }

  if (typeof source === 'string') {
    const label = normalizeFieldLabel(currentField, labels);
    out.add(translateConstraintMessage(label, source));
    return;
  }

  if (typeof source === 'number' || typeof source === 'boolean') {
    out.add(String(source));
    return;
  }

  if (typeof source === 'object') {
    Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
      if (key === 'message' && typeof value === 'string') {
        const label = normalizeFieldLabel(currentField, labels);
        out.add(translateConstraintMessage(label, value));
      } else if (key === 'errors') {
        collectMessages(value, labels, out, currentField);
      } else {
        collectMessages(value, labels, out, key);
      }
    });
  }
};

const DEFAULT_NETWORK_ERROR = '通信エラーが発生しました。時間を置いて再度お試しください。';
const DEFAULT_UNKNOWN_ERROR = '不明なエラーが発生しました。';

const isNetworkError = (error: { status?: number | undefined }): boolean =>
  typeof error.status === 'undefined' || error.status === 0;

export interface ErrorMessageOptions {
  fieldLabels?: FieldLabels;
  fallbackMessage?: string;
}

export const extractErrorMessages = (
  error: unknown,
  options: ErrorMessageOptions = {},
): string[] => {
  const labels = { ...defaultFieldLabels, ...(options.fieldLabels ?? {}) };
  const fallback = options.fallbackMessage ?? DEFAULT_UNKNOWN_ERROR;

  if (isApiClientError(error)) {
    if (isNetworkError(error)) {
      return [DEFAULT_NETWORK_ERROR];
    }

    const messages = new Set<string>();
    const details = error.details as Record<string, unknown> | undefined;

    if (details?.errors) {
      collectMessages(details.errors, labels, messages);
    } else if (details) {
      collectMessages(details, labels, messages);
    }

    if (messages.size === 0 && error.message) {
      messages.add(translateConstraintMessage('入力内容', error.message));
    }

    if (messages.size === 0) {
      messages.add(fallback);
    }

    return Array.from(messages);
  }

  if (error instanceof Error && error.message) {
    return [error.message];
  }

  return [options.fallbackMessage ?? DEFAULT_NETWORK_ERROR];
};
