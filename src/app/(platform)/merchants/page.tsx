'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantsPageContent } from './merchants-content';

export default function MerchantsPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>}>
      <MerchantsPageContent />
    </Suspense>
  );
}
