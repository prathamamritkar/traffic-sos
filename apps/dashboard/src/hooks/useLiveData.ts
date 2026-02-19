// ============================================================
// useLiveData — WebSocket + poll live data hook
// Fixed:
//   • isMounted ref prevents reconnect after clean unmount
//   • token URL-encoded (prevents WS URL injection)
//   • SIGNAL_UPDATE deduplication (was handled twice)
//   • reconnect timer cleared before overwriting
//   • exponential back-off capped at 30 s
// ============================================================
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { CaseRecord, AmbulanceLocation, TrafficSignalPayload } from '@/types/rctf';

const INITIAL_CASES: CaseRecord[] = []; // Default to empty; live data only
const MAX_RECONNECT_DELAY_MS = 30_000;

export function useLiveData() {
    const [cases, setCases] = useState<CaseRecord[]>(INITIAL_CASES);
    const [ambulanceLocations, setAmbulance] = useState<Map<string, AmbulanceLocation>>(new Map());
    const [connected, setConnected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectDelay = useRef(5_000); // exponential back-off seed
    const isMounted = useRef(true);  // prevent reconnect after unmount

    // Initial setup
    useEffect(() => {
        // No-op for now; ambulance locations arrive via WS
    }, []);

    // ── WebSocket ────────────────────────────────────────────────
    const scheduleReconnect = useCallback(() => {
        if (!isMounted.current) return;  // ← key fix: don't reconnect after unmount

        // Clear any pending timer before scheduling a new one
        if (reconnectTimer.current !== null) {
            clearTimeout(reconnectTimer.current);
        }

        reconnectTimer.current = setTimeout(() => {
            if (isMounted.current) connect();  // eslint-disable-line @typescript-eslint/no-use-before-define
        }, reconnectDelay.current);

        // Exponential back-off, capped at 30 s
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const connect = useCallback(() => {
        if (!isMounted.current) return;

        const wsUrl = process.env.NEXT_PUBLIC_TRACKING_WS_URL ?? 'ws://localhost:3004';
        const rawToken = typeof window !== 'undefined'
            ? (localStorage.getItem('rescuedge_token') ?? '')
            : '';

        // URL-encode token to prevent injection via special characters
        const safeToken = encodeURIComponent(rawToken);

        try {
            const ws = new WebSocket(`${wsUrl}/ws?token=${safeToken}&accidentId=global`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isMounted.current) { ws.close(); return; }
                setConnected(true);
                reconnectDelay.current = 5_000; // reset back-off on success
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[dashboard] WebSocket connected');
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted.current) return;
                try {
                    const msg = JSON.parse(event.data as string) as {
                        type: string;
                        payload: Record<string, unknown>;
                    };

                    if (msg.type === 'LOCATION_UPDATE') {
                        const { entityId, accidentId, location, timestamp } = msg.payload as {
                            entityId: string;
                            accidentId: string;
                            location: AmbulanceLocation['location'];
                            timestamp: string;
                        };
                        setAmbulance((prev) => {
                            const next = new Map(prev);
                            next.set(entityId, { entityId, accidentId, location, timestamp });
                            return next;
                        });
                    }

                    if (msg.type === 'SOS_NEW') {
                        setCases((prev) => {
                            const payload = msg.payload as unknown as CaseRecord;
                            const exists = prev.find((c) => c.accidentId === payload.accidentId);
                            if (exists) return prev;
                            return [payload, ...prev];
                        });
                    }

                    if (msg.type === 'CASE_UPDATE') {
                        setCases((prev) =>
                            prev.map((c) =>
                                c.accidentId === (msg.payload as unknown as CaseRecord).accidentId
                                    ? { ...c, ...(msg.payload as unknown as Partial<CaseRecord>) }
                                    : c
                            )
                        );
                    }

                    // Kept separate from CASE_UPDATE — signal updates also fan-out via CustomEvent
                    // (previously this was inside `CASE_UPDATE || SIGNAL_UPDATE`, causing CASE_UPDATE
                    //  to also dispatch signal events — that was a bug)
                    if (msg.type === 'SIGNAL_UPDATE') {
                        window.dispatchEvent(
                            new CustomEvent('rescuedge-signal-update', { detail: msg.payload })
                        );
                    }
                } catch {
                    // Malformed WS message — silently discard
                }
            };

            ws.onclose = () => {
                if (!isMounted.current) return; // ← key fix: don't update state/reconnect on unmount
                setConnected(false);
                scheduleReconnect();
            };

            ws.onerror = () => {
                if (!isMounted.current) return;
                setConnected(false);
                // onclose fires immediately after onerror, so no separate reconnect needed
            };
        } catch {
            scheduleReconnect();
        }
    }, [scheduleReconnect]);

    useEffect(() => {
        isMounted.current = true;
        connect();
        return () => {
            isMounted.current = false;
            if (reconnectTimer.current !== null) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [connect]);

    // ── HTTP poll for cases (fallback when WS is offline) ───────
    useEffect(() => {
        const detectionUrl = process.env.NEXT_PUBLIC_DETECTION_API_URL ?? 'http://localhost:3001';

        const poll = () => {
            if (!isMounted.current) return;
            const token = typeof window !== 'undefined'
                ? (localStorage.getItem('rescuedge_token') ?? '')
                : '';

            fetch(`${detectionUrl}/api/sos`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json() as Promise<{ payload?: { cases?: CaseRecord[] } }>;
                })
                .then((d) => {
                    if (!isMounted.current) return;
                    if (Array.isArray(d.payload?.cases) && d.payload!.cases!.length > 0) {
                        setCases(d.payload!.cases!);
                    }
                })
                .catch(() => {
                    // Offline / service down — retain existing data silently
                });
        };

        poll();
        const interval = setInterval(poll, 10_000);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- isMounted ref is stable

    return { cases, ambulanceLocations, connected };
}
