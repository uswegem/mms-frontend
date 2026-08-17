'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
// The gateway lives on the API's origin, not under /api/v1 — strip that suffix.
const SOCKET_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export interface PaymentConfirmedEvent {
  paymentId: string;
  tipsEndToEndId: string;
  amount: string;
  currency: string;
  channel: string;
  storeId?: string | null;
  terminalId?: string | null;
  payerFsp?: string | null;
  receivedAt: string;
}

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Subscribes to this merchant's `payment.confirmed` events (§4.5 real-time
 * confirmation). Room membership is enforced server-side from the verified
 * token, not requested by this client — see PaymentsGateway.
 */
export function usePaymentConfirmedEvents(
  token: string | null,
  onPayment: (event: PaymentConfirmedEvent) => void,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const handlerRef = useRef(onPayment);

  useEffect(() => {
    handlerRef.current = onPayment;
  });

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(`${SOCKET_ORIGIN}/realtime`, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('disconnected'));
    socket.on('payment.confirmed', (event: PaymentConfirmedEvent) => handlerRef.current(event));

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return status;
}
