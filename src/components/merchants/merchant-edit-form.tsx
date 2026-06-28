'use client';

import { FormEvent, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MerchantFormFields,
  merchantToFormValues,
  type MerchantFormValues,
} from '@/components/merchants/merchant-form-fields';
import type { Merchant } from '@/lib/merchants-api';
import { updateMerchant } from '@/lib/merchants-api';

interface MerchantEditFormProps {
  merchant: Merchant;
  token: string;
  canWrite: boolean;
  onUpdated: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function MerchantEditForm({
  merchant,
  token,
  canWrite,
  onUpdated,
  onError,
  onSuccess,
}: MerchantEditFormProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<MerchantFormValues>(() =>
    merchantToFormValues(merchant),
  );

  function handleChange(patch: Partial<MerchantFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  function handleCancel() {
    setValues(merchantToFormValues(merchant));
    setEditing(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMerchant(token, merchant.id, {
        tradingName: values.tradingName,
        mcc: values.mcc,
        taxId: values.taxId || undefined,
        region: values.region,
        district: values.district,
        ward: values.ward,
        postalCode: values.postalCode,
        addressLine1: values.addressLine1 || undefined,
        addressLine2: values.addressLine2 || undefined,
        contactPhone: values.contactPhone || undefined,
        contactEmail: values.contactEmail || undefined,
      });
      onSuccess('Merchant profile updated.');
      setEditing(false);
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const nonEditable = ['PENDING_REVIEW', 'PENDING_APPROVAL', 'CLOSED'].includes(
    merchant.status,
  );

  const profile = merchant.profile;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Merchant Profile</CardTitle>
          <CardDescription>
            TANQR-compliant merchant identity record
            {nonEditable && ' · This status does not allow profile edits'}
          </CardDescription>
        </div>
        {canWrite && !nonEditable && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <MerchantFormFields
              values={values}
              onChange={handleChange}
              showLegalName={false}
              idPrefix="edit"
            />
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Legal name <strong>{merchant.legalName}</strong> cannot be changed after registration.
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Legal Name', merchant.legalName],
              ['Trading Name', merchant.tradingName],
              ['MCC', merchant.mcc],
              ['Tax ID', merchant.taxId ?? '—'],
              ['Region', profile?.region ?? '—'],
              ['District', profile?.district ?? '—'],
              ['Ward', profile?.ward ?? '—'],
              ['Address', profile?.addressLine1 ?? '—'],
              ['City', profile?.city ?? '—'],
              ['Postal Code', profile?.postalCode ?? '—'],
              ['Country', profile?.countryCode ?? 'TZ'],
              ['Contact Phone', profile?.contactPhone ?? '—'],
              ['Contact Email', profile?.contactEmail ?? '—'],
              ['School Merchant', merchant.isSchool ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
