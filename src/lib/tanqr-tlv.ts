/** Parse sub-tags inside EMVCo template tag 26 (Merchant Account Information). */
export function extractTag26SubTag(
  tlvPayload: string,
  subTag: string,
): string | null {
  const tag26Index = tlvPayload.indexOf('26');
  if (tag26Index === -1) return null;

  const len = Number(tlvPayload.slice(tag26Index + 2, tag26Index + 4));
  if (!Number.isFinite(len) || len <= 0) return null;

  const content = tlvPayload.slice(tag26Index + 4, tag26Index + 4 + len);
  let index = 0;

  while (index + 4 <= content.length) {
    const id = content.slice(index, index + 2);
    const valueLen = Number(content.slice(index + 2, index + 4));
    if (!Number.isFinite(valueLen) || valueLen < 0) return null;
    const value = content.slice(index + 4, index + 4 + valueLen);
    if (id === subTag) return value;
    index += 4 + valueLen;
  }

  return null;
}

export function parseTanqrMerchantAccount(tlvPayload?: string, fallbackAlias?: string) {
  const acquirerId = tlvPayload ? extractTag26SubTag(tlvPayload, '01') : null;
  const merchantId =
    (tlvPayload ? extractTag26SubTag(tlvPayload, '02') : null) ?? fallbackAlias ?? '';

  return {
    acquirerId: acquirerId ?? '',
    merchantId,
  };
}
