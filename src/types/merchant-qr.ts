export type QrType = 'static' | 'dynamic';
export type QrStatus = 'active' | 'pending' | 'expired' | 'disabled' | 'paid';

export interface MerchantQrAsset {
  png?: string;
  svg?: string;
  pdf?: string;
}

export interface MerchantQrCode {
  id: string;
  merchant_id: string;
  student_id?: string | null;
  student_name?: string | null;
  admission_no?: string | null;
  qr_type: QrType;
  poi_method: '11' | '12';
  status: QrStatus;
  alias: string;
  merchant_name: string;
  mcc: string;
  city?: string | null;
  amount?: string | null;
  bill_number?: string | null;
  reference_label?: string | null;
  version: number;
  crc: string;
  tlv_payload: string;
  created_at: string;
  expires_at?: string | null;
  assets: MerchantQrAsset;
  store_label?: string | null;
  terminal_label?: string | null;
}

export interface MerchantQrSummary {
  total: number;
  active: number;
  static: number;
  dynamic: number;
  expired: number;
}

export interface MerchantQrEligibility {
  kyc_approved: boolean;
  merchant_active: boolean;
  alias_available: boolean;
  tips_registered: boolean;
  settlement_configured: boolean;
}

export interface MerchantQrResponse {
  merchant_id: string;
  merchant: {
    id: string;
    trading_name: string;
    status: string;
    mcc: string;
    is_school: boolean;
    city?: string | null;
  };
  eligibility: MerchantQrEligibility;
  summary: MerchantQrSummary;
  qr_codes: MerchantQrCode[];
}

export interface GenerateStaticQrRequest {
  store_id?: string;
  terminal_id?: string;
  purpose?: string;
  force_regenerate?: boolean;
}

export interface CreateDynamicQrRequest {
  amount: string;
  bill_number?: string;
  reference_label?: string;
  store_id?: string;
  terminal_id?: string;
  expires_in_minutes?: number;
}

export interface QrActionResult {
  success: boolean;
  qr_id: string;
  qr_type?: QrType;
  status?: string;
  tlv_payload?: string;
  crc?: string;
  assets?: MerchantQrAsset;
}
