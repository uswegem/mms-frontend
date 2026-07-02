const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

import type { OnboardingApplication } from '@/lib/onboarding-api';

export function createSchoolOnboarding(
  token: string,
  body: {
    legalName: string;
    tradingName: string;
    region?: string;
    district?: string;
    ward?: string;
    city?: string;
    postalCode: string;
    taxId?: string;
    registrationNo?: string;
    headName?: string;
    contactPhone?: string;
    contactEmail?: string;
  },
) {
  return request<OnboardingApplication>('/schools/onboarding', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getSchool(token: string, merchantId: string) {
  return request(`/schools/${merchantId}`, token);
}

export function updateSchoolProfile(
  token: string,
  merchantId: string,
  body: { registrationNo?: string; headName?: string; address?: string },
) {
  return request(`/schools/${merchantId}/profile`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function updateSchoolContacts(
  token: string,
  merchantId: string,
  body: {
    contactPhone?: string;
    contactEmail?: string;
    bursarName?: string;
    bursarPhone?: string;
  },
) {
  return request(`/schools/${merchantId}/contacts`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
