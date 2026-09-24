import { useAuthStore } from '@/stores/auth';

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

const SKIP_REFRESH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
];

let refreshInFlight: Promise<boolean> | null = null;

function isFormData(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function requestHeaders(
  extra?: HeadersInit,
  body?: BodyInit | null,
  json = true,
): HeadersInit {
  const organizationId = useAuthStore.getState().currentOrg?.id;
  return {
    ...(json && !isFormData(body) ? { 'Content-Type': 'application/json' } : {}),
    ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
    ...(extra ?? {}),
  };
}

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorPayload & {
    data?: T;
  };

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Request failed',
      body.error?.details,
    );
  }

  return body.data as T;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: requestHeaders(options.headers, options.body ?? null),
    });

  let response = await doFetch();

  const canRefresh =
    response.status === 401 && !SKIP_REFRESH_PATHS.some((skip) => path.startsWith(skip));

  if (canRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await doFetch();
    }
  }

  return parseResponse<T>(response);
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: requestHeaders(undefined, null, false),
    });

  let response = await doFetch();
  const canRefresh =
    response.status === 401 && !SKIP_REFRESH_PATHS.some((skip) => path.startsWith(skip));
  if (canRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await doFetch();
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new ApiClientError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Download failed',
      body.error?.details,
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = decodeURIComponent(utfMatch?.[1] ?? plainMatch?.[1] ?? fallbackName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
