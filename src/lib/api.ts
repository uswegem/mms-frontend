const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001/api/v1'
    : '/api/v1');

export async function fetchHealth(): Promise<{
  status: string;
  info?: Record<string, unknown>;
  details?: Record<string, unknown>;
}> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
  } catch {
    throw new Error(
      `Cannot connect to API at ${API_BASE}. Is the backend running on port 3001?`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Health check failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json();
}
