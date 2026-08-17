const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface MerchantAlias {
  id: string;
  merchantId: string;
  alias8digit: string;
  isActive: boolean;
}

export async function getMerchantAlias(token: string, merchantId: string): Promise<MerchantAlias | null> {
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/alias`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load merchant alias (${res.status})`);
  return res.json();
}
