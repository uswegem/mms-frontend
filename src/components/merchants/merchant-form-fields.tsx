'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CreateMerchantInput } from '@/lib/merchants-api';

export type MerchantFormValues = CreateMerchantInput;

interface MerchantFormFieldsProps {
  values: MerchantFormValues;
  onChange: (patch: Partial<MerchantFormValues>) => void;
  showLegalName?: boolean;
  disabled?: boolean;
  idPrefix?: string;
}

export function MerchantFormFields({
  values,
  onChange,
  showLegalName = true,
  disabled = false,
  idPrefix = 'merchant',
}: MerchantFormFieldsProps) {
  const field = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {showLegalName && (
        <div className="space-y-2">
          <Label htmlFor={field('legalName')}>Legal Name</Label>
          <Input
            id={field('legalName')}
            required
            disabled={disabled}
            value={values.legalName}
            onChange={(e) => onChange({ legalName: e.target.value })}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={field('tradingName')}>Trading Name</Label>
        <Input
          id={field('tradingName')}
          required
          disabled={disabled}
          maxLength={100}
          value={values.tradingName}
          onChange={(e) => onChange({ tradingName: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('mcc')}>MCC</Label>
        <Input
          id={field('mcc')}
          required
          disabled={disabled}
          pattern="[0-9]{4}"
          value={values.mcc}
          onChange={(e) => onChange({ mcc: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('taxId')}>Tax ID (TIN)</Label>
        <Input
          id={field('taxId')}
          disabled={disabled}
          value={values.taxId ?? ''}
          onChange={(e) => onChange({ taxId: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('city')}>City</Label>
        <Input
          id={field('city')}
          required
          disabled={disabled}
          maxLength={15}
          value={values.city}
          onChange={(e) => onChange({ city: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('postalCode')}>Postal Code</Label>
        <Input
          id={field('postalCode')}
          required
          disabled={disabled}
          pattern="[0-9]{5}"
          value={values.postalCode}
          onChange={(e) => onChange({ postalCode: e.target.value })}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={field('addressLine1')}>Address Line 1</Label>
        <Input
          id={field('addressLine1')}
          disabled={disabled}
          value={values.addressLine1 ?? ''}
          onChange={(e) => onChange({ addressLine1: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={field('addressLine2')}>Address Line 2</Label>
        <Input
          id={field('addressLine2')}
          disabled={disabled}
          value={values.addressLine2 ?? ''}
          onChange={(e) => onChange({ addressLine2: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('contactPhone')}>Contact Phone</Label>
        <Input
          id={field('contactPhone')}
          type="tel"
          disabled={disabled}
          value={values.contactPhone ?? ''}
          onChange={(e) => onChange({ contactPhone: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('contactEmail')}>Contact Email</Label>
        <Input
          id={field('contactEmail')}
          type="email"
          disabled={disabled}
          value={values.contactEmail ?? ''}
          onChange={(e) => onChange({ contactEmail: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={field('isSchool')}>Merchant Type</Label>
        <Select
          id={field('isSchool')}
          disabled={disabled}
          value={values.isSchool ? 'school' : 'retail'}
          onChange={(e) => onChange({ isSchool: e.target.value === 'school' })}
          className={cn('h-9')}
        >
          <option value="retail">Retail / General</option>
          <option value="school">School (Education)</option>
        </Select>
      </div>
    </div>
  );
}

export const defaultMerchantFormValues: MerchantFormValues = {
  legalName: '',
  tradingName: '',
  mcc: '5814',
  city: 'Dar es Salaam',
  postalCode: '11000',
  taxId: '',
  isSchool: false,
  addressLine1: '',
  addressLine2: '',
  contactPhone: '',
  contactEmail: '',
};

export function merchantToFormValues(
  merchant: import('@/lib/merchants-api').Merchant,
): MerchantFormValues {
  return {
    legalName: merchant.legalName,
    tradingName: merchant.tradingName,
    mcc: merchant.mcc,
    city: merchant.profile?.city ?? 'Dar es Salaam',
    postalCode: merchant.profile?.postalCode ?? '11000',
    taxId: merchant.taxId ?? '',
    isSchool: merchant.isSchool,
    addressLine1: merchant.profile?.addressLine1 ?? '',
    addressLine2: merchant.profile?.addressLine2 ?? '',
    contactPhone: merchant.profile?.contactPhone ?? '',
    contactEmail: merchant.profile?.contactEmail ?? '',
  };
}
