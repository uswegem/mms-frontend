'use client';

import Link from 'next/link';
import { School } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SchoolFeesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="School Fee Collection"
        description="School onboarding, student registry, permanent Lipa Namba, and bulk enrolment (Milestone 2)."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <School className="h-5 w-5" />
            School Onboarding &amp; Students
          </CardTitle>
          <CardDescription>
            Schools onboard via maker-checker approval. After approval, school Lipa Namba and
            static TANQR are issued automatically. Enrol students from the school merchant
            detail page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/onboarding">
            <Button>Start School Onboarding</Button>
          </Link>
          <Link href="/merchants">
            <Button variant="outline">View Merchants / Schools</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
