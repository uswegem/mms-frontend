'use client';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  DEFAULT_BANK_SWIFT,
  formatBankLabel,
  TANZANIA_BANKS,
} from '@/lib/tanzania-banks';

interface BankSelectFieldProps {
  value: string;
  onChange: (swiftCode: string) => void;
  required?: boolean;
  label?: string;
}

export function BankSelectField({
  value,
  onChange,
  required = true,
  label = 'Bank',
}: BankSelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      <Select
        required={required}
        value={value || DEFAULT_BANK_SWIFT}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select bank
        </option>
        {TANZANIA_BANKS.map((bank) => (
          <option key={bank.swiftCode} value={bank.swiftCode}>
            {formatBankLabel(bank)}
          </option>
        ))}
      </Select>
    </div>
  );
}
