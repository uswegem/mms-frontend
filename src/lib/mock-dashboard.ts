/** Preview analytics data — replaced when transaction/settlement APIs ship */

export const TRANSACTION_VOLUME = [
  { label: 'Mon', value: 42 },
  { label: 'Tue', value: 58 },
  { label: 'Wed', value: 51 },
  { label: 'Thu', value: 67 },
  { label: 'Fri', value: 74 },
  { label: 'Sat', value: 38 },
  { label: 'Sun', value: 29 },
];

export const REVENUE_TREND = [
  { label: 'Jan', value: 12.4 },
  { label: 'Feb', value: 14.1 },
  { label: 'Mar', value: 13.8 },
  { label: 'Apr', value: 16.2 },
  { label: 'May', value: 18.5 },
  { label: 'Jun', value: 19.1 },
];

export const RECENT_TRANSACTIONS = [
  {
    id: 'TXN-2026-0012847',
    merchant: 'Kariakoo Electronics',
    amount: 245000,
    status: 'SUCCESS',
    channel: 'TANQR Dynamic',
    time: '2 min ago',
  },
  {
    id: 'TXN-2026-0012846',
    merchant: 'St. Mary\'s Academy',
    amount: 850000,
    status: 'SUCCESS',
    channel: 'School Fees QR',
    time: '5 min ago',
  },
  {
    id: 'TXN-2026-0012845',
    merchant: 'Mlimani Supermarket',
    amount: 67500,
    status: 'FAILED',
    channel: 'Lipa Namba',
    time: '8 min ago',
  },
  {
    id: 'TXN-2026-0012844',
    merchant: 'Azania Pharmacy',
    amount: 128000,
    status: 'SUCCESS',
    channel: 'TANQR Static',
    time: '12 min ago',
  },
  {
    id: 'TXN-2026-0012843',
    merchant: 'Ubungo Hardware',
    amount: 412000,
    status: 'PENDING',
    channel: 'TANQR Dynamic',
    time: '15 min ago',
  },
];

export const PENDING_APPROVALS = [
  {
    id: 'APR-1042',
    type: 'KYC Review',
    entity: 'Jitegemee Traders Ltd',
    maker: 'Compliance Officer',
    submitted: 'Today, 09:14',
  },
  {
    id: 'APR-1041',
    type: 'Settlement Batch',
    entity: 'Batch #SET-2026-0604',
    maker: 'Finance Officer',
    submitted: 'Yesterday, 16:30',
  },
  {
    id: 'APR-1040',
    type: 'Merchant Onboarding',
    entity: 'Kilimanjaro Coffee Co.',
    maker: 'Operations User',
    submitted: 'Yesterday, 11:22',
  },
];

export const DASHBOARD_PREVIEW = {
  todayTransactions: 1847,
  todayVolume: 284_500_000,
  schoolCollections: 42_800_000,
  failedTransactions: 23,
  qrScansToday: 3241,
  settlementPending: 3,
  reconciliationOpen: 7,
  revenueMtd: 19_100_000,
};
