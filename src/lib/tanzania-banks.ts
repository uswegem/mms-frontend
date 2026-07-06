import banksData from '@/data/tanzania-banks.json';

export interface TanzaniaBank {
  name: string;
  swiftCode: string;
}

export const TANZANIA_BANKS = banksData as TanzaniaBank[];

/** Default acquirer bank for Letshego Faidika Bank onboarding. */
export const DEFAULT_BANK_SWIFT = 'ADVBTZTZ';

export function getBankBySwift(swiftCode: string): TanzaniaBank | undefined {
  const normalized = swiftCode.trim().toUpperCase();
  return TANZANIA_BANKS.find((b) => b.swiftCode === normalized);
}

export function formatBankLabel(bank: TanzaniaBank): string {
  return `${bank.name} — ${bank.swiftCode}`;
}

export function formatBankDisplay(swiftCode: string): string {
  const bank = getBankBySwift(swiftCode);
  return bank ? formatBankLabel(bank) : swiftCode;
}
