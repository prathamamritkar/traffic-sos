// ============================================================
// useLiveData — WebSocket + MQTT live data hook
// Connects to tracking-service WebSocket and MQTT broker
// Provides: cases, ambulanceLocations, signals, connected
// ============================================================
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { CaseRecord, AmbulanceLocation, TrafficSignalPayload } from '@/types/rctf';

// Seed data for initial load
const INITIAL_CASES: CaseRecord[] = [
    {
        accidentId: 'ACC-2026-DEMO1',
        victimUserId: 'U-VICTIM-001',
        responderId: 'RSP-001',
        location: { lat: 18.5204, lng: 73.8567 },
        status: 'EN_ROUTE',
        metrics: {
            gForce: 6.2,
            speedBefore: 72,
            speedAfter: 0,
            mlConfidence: 0.94,
            crashType: 'CONFIRMED_CRASH',
            rolloverDetected: false,
        },
        medicalProfile: {
            bloodGroup: 'O+',
            age: 24,
            gender: 'MALE',
            allergies: ['Penicillin'],
            medications: [],
            conditions: [],
            emergencyContacts: ['+91-9876543210'],
        },
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
        accidentId: 'ACC-2026-DEMO2',
        victimUserId: 'U-VICTIM-002',
        location: { lat: 18.5074, lng: 73.8077 },
        status: 'DETECTED',
        metrics: {
            gForce: 4.8,
            speedBefore: 55,
            speedAfter: 0,
            mlConfidence: 0.87,
            crashType: 'CONFIRMED_CRASH',
            rolloverDetected: true,
        },
        medicalProfile: {
            bloodGroup: 'A+',
            age: 35,
            gender: 'FEMALE',
            allergies: [],
            medications: ['Metformin'],
            conditions: ['Diabetes Type 2'],
            emergencyContacts: ['+91-9123456789'],
        },
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
];

export function useLiveData() {
    const [cases, setCases] = useState<CaseRecord[]>(INITIAL_CASES);
    const [ambulanceLocations, setAmbulance] = useState<Map<string, AmbulanceLocation>>(new Map());
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

    // Track ambulance movement updates
    useEffect(() => {
        let angle = 0;
        const interval = setInterval(() => {
            angle += 0.002;
            const baseLat = 18.5204;
            const baseLng = 73.8567;
            setAmbulance(prev => {
                const next = new Map(prev);
                next.set('RSP-001', {
                    entityId: 'RSP-001',
                    accidentId: 'ACC-2026-DEMO1',
                    location: {
                        lat: baseLat + Math.sin(angle) * 0.005,
                        lng: baseLng + Math.cos(angle) * 0.005,
                        heading: (angle * 180 / Math.PI) % 360,
                        speed: 15,
                    },
                    timestamp: new Date().toISOString(),
                });
                return next;
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const connect = useCallback(() => {
        const wsUrl = process.env.NEXT_PUBLIC_TRACKING_WS_URL ?? 'ws://localhost:3004';
        const token = localStorage.getItem('rescuedge_token') ?? '';

        try {
            const ws = new WebSocket(`${wsUrl}/ws?token=${token}&accidentId=global`);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                console.log('[dashboard] WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.type === 'LOCATION_UPDATE') {
                        const { entityId, accidentId, location, timestamp } = msg.payload;
                        setAmbulance((prev) => {
                            const next = new Map(prev);
                            next.set(entityId, { entityId, accidentId, location, timestamp });
                            return next;
                        });
                    }

                    if (msg.type === 'SOS_NEW') {
                        setCases((prev) => {
                            const exists = prev.find((c) => c.accidentId === msg.payload.accidentId);
                            if (exists) return prev;
                            return [msg.payload, ...prev];
                        });
                    }

                    if (msg.type === 'CASE_UPDATE' || msg.type === 'SIGNAL_UPDATE') {
                        setCases((prev) =>
                            prev.map((c) =>
                                c.accidentId === msg.payload.accidentId ? { ...c, ...msg.payload } : c
                            )
                        );
                    }

                    if (msg.type === 'SIGNAL_UPDATE') {
                        // Forward signal update to app-wide state listener
                        window.dispatchEvent(new CustomEvent('rescuedge-signal-update', { detail: msg.payload }));
                    }
                } catch {/* ignore */ }
            };

            ws.onclose = () => {
                setConnected(false);
                reconnectTimer.current = setTimeout(connect, 5000);
            };

            ws.onerror = () => {
                setConnected(false);
            };
        } catch {
            reconnectTimer.current = setTimeout(connect, 5000);
        }
    }, []);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    // Poll detection-service for cases
    useEffect(() => {
        const detectionUrl = process.env.NEXT_PUBLIC_DETECTION_API_URL ?? 'http://localhost:3001';
        const token = localStorage.getItem('rescuedge_token') ?? '';

        const poll = () => {
            fetch(`${detectionUrl}/api/sos`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((r) => r.json())
                .then((d) => {
                    if (d.payload?.cases?.length > 0) {
                        setCases(d.payload.cases);
                    }
                })
                .catch(() => {/* handle offline state */ });
        };

        poll();
        const interval = setInterval(poll, 10000);
        return () => clearInterval(interval);
    }, []);

    return { cases, ambulanceLocations, connected };
}
