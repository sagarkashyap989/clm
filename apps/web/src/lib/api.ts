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

function requestHeaders(extra?: HeadersInit): HeadersInit {
  const organizationId = useAuthStore.getState().currentOrg?.id;
  return {
    'Content-Type': 'application/json',
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
      headers: requestHeaders(options.headers),
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
