export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown };

export async function api<T = any>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.message ?? 'Something went wrong. Try again.',
      data?.error?.fields,
    );
  }
  return data as T;
}

export const fetcher = <T = any>(path: string) => api<T>(path);

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Try again.';
}
