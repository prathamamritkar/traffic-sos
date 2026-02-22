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
import type { CaseRecord, AmbulanceLocation, TrafficSignalPayload, CaseStatus } from '@/types/rctf';
import { AMBULANCE_ROUTE_GEOMETRIES } from '@/data/puneRoutes';

export interface AppNotification {
    id: string;
    type: 'SOS' | 'UPDATE' | 'SIGNAL';
    title: string;
    message: string;
    time: string; // "2 mins ago" format or ISO
    icon: string; // material icon name
}

export const INITIAL_CASES: CaseRecord[] = [
    {
        accidentId: 'ACC-DMO-003',
        victimUserId: 'USER-789',
        location: { lat: 18.5204, lng: 73.8567 }, // Central Pune
        status: 'DETECTED',
        createdAt: new Date(Date.now() - 30000).toISOString(),
        medicalProfile: {
            bloodGroup: 'A+',
            age: 22,
            gender: 'OTHER',
            allergies: ['Peanuts'],
            medications: ['None'],
            conditions: ['N/A'],
            emergencyContacts: ['+91-8888877777']
        },
        metrics: {
            gForce: 3.2,
            speedBefore: 40,
            speedAfter: 0,
            mlConfidence: 0.92,
            crashType: 'Pothole Impact',
            rolloverDetected: false
        },
        sceneAnalysis: {
            injurySeverity: 'MODERATE',
            victimCount: 1,
            visibleHazards: ['None'],
            urgencyLevel: 'NORMAL',
            suggestedActions: ['Check for concussion', 'Secure area']
        }
    },
    {
        accidentId: 'ACC-DMO-001',
        victimUserId: 'USER-123',
        location: { lat: 18.5133, lng: 73.8183 },
        status: 'DISPATCHED',
        createdAt: new Date(Date.now() - 120000).toISOString(),
        medicalProfile: {
            bloodGroup: 'O+',
            age: 34,
            gender: 'MALE',
            allergies: ['Penicillin'],
            medications: ['None'],
            conditions: ['N/A'],
            emergencyContacts: ['+91-9876543210']
        },
        metrics: {
            gForce: 4.8,
            speedBefore: 65,
            speedAfter: 0,
            mlConfidence: 0.98,
            crashType: 'Frontal',
            rolloverDetected: false
        },
        sceneAnalysis: {
            injurySeverity: 'CRITICAL',
            victimCount: 1,
            visibleHazards: ['Fuel Leak', 'Structural Damage'],
            urgencyLevel: 'IMMEDIATE',
            suggestedActions: ['Airway support required', 'Hypothermal protection']
        },
        deviceInfo: {
            batteryLevel: 22,
            batteryStatus: 'Discharging',
            networkType: '5G'
        }
    },
    {
        accidentId: 'ACC-DMO-002',
        victimUserId: 'USER-456',
        location: { lat: 18.5320, lng: 73.8500 },
        status: 'RESOLVED',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        resolvedAt: new Date(Date.now() - 600000).toISOString(),
        medicalProfile: {
            bloodGroup: 'B-',
            age: 28,
            gender: 'FEMALE',
            allergies: ['None'],
            medications: ['Albuterol'],
            conditions: ['Asthma'],
            emergencyContacts: ['+91-9998887776']
        },
        metrics: {
            gForce: 2.1,
            speedBefore: 25,
            speedAfter: 12,
            mlConfidence: 0.85,
            crashType: 'Sideswipe',
            rolloverDetected: false
        }
    }
];
const MAX_RECONNECT_DELAY_MS = 30_000;

const SOUNDS = {
    SOS: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Siren
    UPDATE: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3', // Chime
};

// ── Tutorial Simulation Data ─────────────────────────────────────
// Mirrors demo_accident.ts payload — runs entirely client-side
const TUTORIAL_CASE: CaseRecord = {
    accidentId: 'ACC-TUT-001',
    victimUserId: 'U-DEMO-DEVICE-001',
    location: { lat: 18.5204, lng: 73.8567 }, // Pune Center
    status: 'DETECTED',
    createdAt: new Date().toISOString(),
    medicalProfile: {
        bloodGroup: 'O+',
        age: 28,
        gender: 'MALE',
        allergies: ['Penicillin'],
        medications: [],
        conditions: ['Asthma'],
        emergencyContacts: ['+91 98765 43210']
    },
    metrics: {
        gForce: 9.2,
        speedBefore: 45,
        speedAfter: 0,
        mlConfidence: 0.98,
        crashType: 'CONFIRMED_CRASH',
        rolloverDetected: true
    },
    sceneAnalysis: {
        injurySeverity: 'CRITICAL',
        victimCount: 2,
        visibleHazards: ['Fuel Leak', 'Smoke'],
        urgencyLevel: 'IMMEDIATE',
        suggestedActions: ['Deploy Fire suppression', 'Immediate extraction']
    },
    deviceInfo: {
        batteryLevel: 42,
        batteryStatus: 'discharging',
        networkType: '5G'
    }
};

// Ambulance station → accident waypoints
const AMB_START = { lat: 18.4900, lng: 73.8200 }; // Pune Central Hospital
const AMB_END = TUTORIAL_CASE.location;

export function useLiveData() {
    const [cases, setCases] = useState<CaseRecord[]>(INITIAL_CASES);
    const [ambulanceLocations, setAmbulance] = useState<Map<string, AmbulanceLocation>>(new Map());
    const [connected, setConnected] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [latestNotification, setLatestNotification] = useState<AppNotification | null>(null);
    const [tutorialStep, setTutorialStep] = useState(0);

    // Ambulance movement interval ref (tutorial)
    const ambMoveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const ambPathIdxRef = useRef(0);
    // Per-case demo ambulance movement intervals
    const demoMoveRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

    // ── Persistence ──────────────────────────────────────────────
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedSound = localStorage.getItem('rapidrescue_sound_enabled');
            const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';

            if (savedSound !== null) {
                setSoundEnabled(savedSound === 'true');
            }
            if (savedTheme) {
                setTheme(savedTheme);
                document.documentElement.setAttribute('data-theme', savedTheme);
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
        }
    }, []);

    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => {
            const next = !prev;
            localStorage.setItem('rapidrescue_sound_enabled', String(next));
            return next;
        });
    }, []);

    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }, [theme]);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectDelay = useRef(5_000);
    const isMounted = useRef(true);

    const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'time'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const time = new Date().toISOString();
        const notifWithId = { id, ...notif, time };
        setNotifications(prev => [notifWithId, ...prev].slice(0, 10)); // Keep last 10
        setLatestNotification(notifWithId);

        // Play sound if enabled
        if (soundEnabled) {
            const soundUrl = notif.type === 'SOS' ? SOUNDS.SOS : SOUNDS.UPDATE;
            const audio = new Audio(soundUrl);
            audio.play().catch(e => {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[useLiveData] Sound playback blocked or failed:', e.message);
                }
            });
        }
    }, [soundEnabled]);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const updateCaseStatus = useCallback((id: string, newStatus: CaseStatus) => {
        setCases(prev => prev.map(c =>
            c.accidentId === id ? { ...c, status: newStatus } : c
        ));
    }, []);

    /**
     * Cancel a demo ambulance: stop its movement interval, remove the
     * ambulance marker from the map, and mark the case as CANCELLED.
     */
    const cancelDemoCase = useCallback((accidentId: string) => {
        // 1. Stop any in-flight ambulance movement
        const existingInterval = demoMoveRefs.current.get(accidentId);
        if (existingInterval) {
            clearInterval(existingInterval);
            demoMoveRefs.current.delete(accidentId);
        }

        // Also stop tutorial ambulance if it's for this case
        if (accidentId === TUTORIAL_CASE.accidentId && ambMoveRef.current) {
            clearInterval(ambMoveRef.current);
            ambMoveRef.current = null;
        }

        // 2. Update case status
        setCases(prev => prev.map(c =>
            c.accidentId === accidentId ? { ...c, status: 'CANCELLED' as CaseStatus } : c
        ));

        // 3. Remove the ambulance entry from the map
        setAmbulance(prev => {
            const next = new Map(prev);
            // Remove all ambulance entries for this accident (demo + tutorial keys)
            for (const [key, amb] of next.entries()) {
                if (amb.accidentId === accidentId) {
                    next.delete(key);
                }
            }
            return next;
        });
    }, []);

    /**
     * Spawn a demo ambulance at the start of the pre-computed route and
     * animate it step-by-step to the accident scene.
     * Safe to call multiple times — re-calling clears any active interval
     * before starting a fresh traversal.
     */
    const dispatchDemoAmbulance = useCallback((accidentId: string) => {
        const path = AMBULANCE_ROUTE_GEOMETRIES[accidentId];
        if (!path || path.length === 0) return;

        const entityId = `V-AMB-DEMO-${accidentId.slice(-3)}`;
        const ambKey  = `DEMO-${accidentId}`;

        // Clear any in-flight movement for this case
        const existing = demoMoveRefs.current.get(accidentId);
        if (existing) clearInterval(existing);

        // Place ambulance at the first route point immediately
        setAmbulance(p => {
            const m = new Map(p);
            m.set(ambKey, {
                entityId,
                accidentId,
                location: { lat: path[0][0], lng: path[0][1], heading: 45, speed: 60 },
                timestamp: new Date().toISOString(),
            });
            return m;
        });

        // Advance 3 points every 250 ms — smooth but not instant (~20 s for 234 pts)
        let idx = 0;
        const STEP = 3;
        const interval = setInterval(() => {
            idx += STEP;
            if (idx >= path.length) {
                clearInterval(interval);
                demoMoveRefs.current.delete(accidentId);
                // Snap to exact destination and mark arrived
                const last = path[path.length - 1];
                setAmbulance(p => {
                    const m = new Map(p);
                    m.set(ambKey, {
                        entityId,
                        accidentId,
                        location: { lat: last[0], lng: last[1], heading: 0, speed: 0 },
                        timestamp: new Date().toISOString(),
                    });
                    return m;
                });
                setCases(prev => prev.map(c =>
                    c.accidentId === accidentId && !['ARRIVED', 'RESOLVED', 'CANCELLED'].includes(c.status)
                        ? { ...c, status: 'ARRIVED' }
                        : c
                ));
                return;
            }
            const [lat, lng] = path[idx];
            // Compute a rough heading from previous point
            const prev = path[Math.max(0, idx - STEP)];
            const dLng = lng - prev[1];
            const dLat = lat - prev[0];
            const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
            setAmbulance(p => {
                const m = new Map(p);
                m.set(ambKey, {
                    entityId,
                    accidentId,
                    location: { lat, lng, heading, speed: 60 },
                    timestamp: new Date().toISOString(),
                });
                return m;
            });
        }, 250);

        demoMoveRefs.current.set(accidentId, interval);
    }, []);

    // ── Tutorial Simulation Engine ───────────────────────────────
    // Each click of the Tutorial button calls runTutorialStep().
    // Steps: 0→1 (SOS), 1→2 (DISPATCHED), 2→3 (EN_ROUTE + ambulance moves),
    //         3→4 (ARRIVED), 4→5 (RESOLVED), 5→0 (reset)
    const runTutorialStep = useCallback(async () => {
        const next = (tutorialStep + 1) % 6;
        setTutorialStep(next);

        switch (next) {
            case 1: {
                // ── Step 1: New accident detected ──
                const newCase = {
                    ...TUTORIAL_CASE,
                    createdAt: new Date().toISOString()
                };
                setCases(p => {
                    const exists = p.find(c => c.accidentId === newCase.accidentId);
                    if (exists) {
                        // Reset to DETECTED if re-running
                        return p.map(c => c.accidentId === newCase.accidentId
                            ? { ...newCase }
                            : c
                        );
                    }
                    return [newCase, ...p];
                });
                addNotification({
                    type: 'SOS',
                    title: 'New Accident Detected',
                    message: `High-severity crash at Pune Center (${newCase.location.lat.toFixed(4)}, ${newCase.location.lng.toFixed(4)})`,
                    icon: 'car_crash'
                });
                break;
            }

            case 2: {
                // ── Step 2: Ambulance dispatched ──
                updateCaseStatus(TUTORIAL_CASE.accidentId, 'DISPATCHED');
                setAmbulance(p => {
                    const m = new Map(p);
                    m.set('TUT-AMB-01', {
                        entityId: 'V-AMB-TUT-01',
                        accidentId: TUTORIAL_CASE.accidentId,
                        location: { ...AMB_START, heading: 45, speed: 0 },
                        timestamp: new Date().toISOString()
                    });
                    return m;
                });
                addNotification({
                    type: 'UPDATE',
                    title: 'Ambulance Dispatched',
                    message: `V-AMB-TUT-01 assigned to ${TUTORIAL_CASE.accidentId}`,
                    icon: 'emergency'
                });
                break;
            }

            case 3: {
                // ── Step 3: Ambulance en-route (with OSRM road movement) ──
                updateCaseStatus(TUTORIAL_CASE.accidentId, 'EN_ROUTE');

                // 1. Fetch road path from OSRM
                let path: { lat: number; lng: number }[] = [];
                try {
                    const url = `https://router.project-osrm.org/route/v1/driving/${AMB_START.lng},${AMB_START.lat};${AMB_END.lng},${AMB_END.lat}?overview=full&geometries=geojson`;
                    const resp = await fetch(url);
                    const data = await resp.json();
                    if (data.routes?.[0]) {
                        path = data.routes[0].geometry.coordinates.map((c: [number, number]) => ({
                            lat: c[1],
                            lng: c[0]
                        }));
                    }
                } catch (err) {
                    console.warn('[Tutorial] OSRM fetch failed, falling back to direct line');
                }

                // Fallback to minimal path if OSRM fails
                if (path.length === 0) {
                    path = [AMB_START, AMB_END];
                }

                ambPathIdxRef.current = 0;

                // 2. Start animated movement along the road
                if (ambMoveRef.current) clearInterval(ambMoveRef.current);

                ambMoveRef.current = setInterval(() => {
                    ambPathIdxRef.current += 1;
                    const idx = ambPathIdxRef.current;
                    if (idx >= path.length) {
                        if (ambMoveRef.current) clearInterval(ambMoveRef.current);
                        ambMoveRef.current = null;
                        return;
                    }
                    const point = path[idx];
                    setAmbulance(p => {
                        const m = new Map(p);
                        m.set('TUT-AMB-01', {
                            entityId: 'V-AMB-TUT-01',
                            accidentId: TUTORIAL_CASE.accidentId,
                            location: { lat: point.lat, lng: point.lng, heading: 45, speed: 60 },
                            timestamp: new Date().toISOString()
                        });
                        return m;
                    });
                }, 800); // Slightly faster updates for smoother road flow

                addNotification({
                    type: 'UPDATE',
                    title: 'Ambulance En-Route',
                    message: `Responder is following the optimal road path to the scene`,
                    icon: 'navigation'
                });
                break;
            }

            case 4: {
                // ── Step 4: Ambulance arrived ──
                if (ambMoveRef.current) {
                    clearInterval(ambMoveRef.current);
                    ambMoveRef.current = null;
                }
                updateCaseStatus(TUTORIAL_CASE.accidentId, 'ARRIVED');
                // Snap ambulance to accident location
                setAmbulance(p => {
                    const m = new Map(p);
                    m.set('TUT-AMB-01', {
                        entityId: 'V-AMB-TUT-01',
                        accidentId: TUTORIAL_CASE.accidentId,
                        location: { ...AMB_END, heading: 0, speed: 0 },
                        timestamp: new Date().toISOString()
                    });
                    return m;
                });
                addNotification({
                    type: 'UPDATE',
                    title: 'Ambulance On-Site',
                    message: `Responder reached scene ${TUTORIAL_CASE.accidentId}`,
                    icon: 'local_hospital'
                });
                break;
            }

            case 5: {
                // ── Step 5: Case resolved ──
                updateCaseStatus(TUTORIAL_CASE.accidentId, 'RESOLVED');
                setCases(p => p.map(c =>
                    c.accidentId === TUTORIAL_CASE.accidentId
                        ? { ...c, status: 'RESOLVED', resolvedAt: new Date().toISOString() }
                        : c
                ));
                // Remove ambulance
                setAmbulance(p => {
                    const m = new Map(p);
                    m.delete('TUT-AMB-01');
                    return m;
                });
                addNotification({
                    type: 'UPDATE',
                    title: 'Case Resolved',
                    message: `${TUTORIAL_CASE.accidentId} has been resolved successfully`,
                    icon: 'check_circle'
                });
                break;
            }

            default: {
                // ── Reset: remove tutorial case and start over ──
                if (ambMoveRef.current) {
                    clearInterval(ambMoveRef.current);
                    ambMoveRef.current = null;
                }
                setCases(p => p.filter(c => c.accidentId !== TUTORIAL_CASE.accidentId));
                setAmbulance(p => {
                    const m = new Map(p);
                    m.delete('TUT-AMB-01');
                    return m;
                });
                return 0; // Reset step counter
            }
        }
    }, [addNotification, updateCaseStatus, tutorialStep]);

    // Cleanup all movement intervals on unmount
    useEffect(() => {
        return () => {
            if (ambMoveRef.current) clearInterval(ambMoveRef.current);
            for (const t of demoMoveRefs.current.values()) clearInterval(t);
            demoMoveRefs.current.clear();
        };
    }, []);

    // ── WebSocket ────────────────────────────────────────────────
    const scheduleReconnect = useCallback(() => {
        if (!isMounted.current) return;

        if (reconnectTimer.current !== null) {
            clearTimeout(reconnectTimer.current);
        }

        reconnectTimer.current = setTimeout(() => {
            if (isMounted.current) connect();  // eslint-disable-line @typescript-eslint/no-use-before-define
        }, reconnectDelay.current);

        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const connect = useCallback(() => {
        if (!isMounted.current) return;

        const wsUrl = process.env.NEXT_PUBLIC_TRACKING_WS_URL ?? 'ws://localhost:3004';
        const rawToken = typeof window !== 'undefined'
            ? (localStorage.getItem('rapidrescue_token') ?? '')
            : '';

        const safeToken = encodeURIComponent(rawToken);

        try {
            const ws = new WebSocket(`${wsUrl}/ws?token=${safeToken}&accidentId=global`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isMounted.current) { ws.close(); return; }
                setConnected(true);
                reconnectDelay.current = 5_000;
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
                        const payload = msg.payload as unknown as CaseRecord;
                        setCases((prev) => {
                            const exists = prev.find((c) => c.accidentId === payload.accidentId);
                            if (exists) return prev;
                            return [payload, ...prev];
                        });
                        addNotification({
                            type: 'SOS',
                            title: 'New Accident Detected',
                            message: `Crash at ${payload.location.lat.toFixed(4)}, ${payload.location.lng.toFixed(4)}`,
                            icon: 'warning'
                        });
                    }

                    if (msg.type === 'CASE_UPDATE') {
                        const payload = msg.payload as unknown as Partial<CaseRecord>;
                        setCases((prev) =>
                            prev.map((c) =>
                                c.accidentId === payload.accidentId
                                    ? { ...c, ...payload }
                                    : c
                            )
                        );

                        if (payload.status === 'ARRIVED') {
                            addNotification({
                                type: 'UPDATE',
                                title: 'Ambulance Arrived',
                                message: `Responder reached scene ${payload.accidentId}`,
                                icon: 'check_circle'
                            });
                        }
                    }

                    if (msg.type === 'SIGNAL_UPDATE') {
                        window.dispatchEvent(
                            new CustomEvent('rapidrescue-signal-update', { detail: msg.payload })
                        );
                    }
                } catch {
                    // Malformed WS message
                }
            };

            ws.onclose = () => {
                if (!isMounted.current) return;
                setConnected(false);
                scheduleReconnect();
            };

            ws.onerror = () => {
                if (!isMounted.current) return;
                setConnected(false);
            };
        } catch {
            scheduleReconnect();
        }
    }, [scheduleReconnect, addNotification]);

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

    // ── HTTP poll for cases ───────
    useEffect(() => {
        const detectionUrl = process.env.NEXT_PUBLIC_DETECTION_API_URL ?? 'http://localhost:3001';

        const poll = () => {
            if (!isMounted.current) return;
            const token = typeof window !== 'undefined'
                ? (localStorage.getItem('rapidrescue_token') ?? '')
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
                    if (Array.isArray(d.payload?.cases)) {
                        setCases(prev => {
                            // Merge: keep demo cases that aren't in the backend yet
                            const backendIds = new Set(d.payload!.cases!.map(c => c.accidentId));
                            const demoCases = prev.filter(c => (c.accidentId.startsWith('ACC-DMO') || c.accidentId.startsWith('ACC-TUT')) && !backendIds.has(c.accidentId));
                            return [...demoCases, ...d.payload!.cases!];
                        });
                    }
                })
                .catch(() => {
                    // Offline
                });
        };

        poll();
        const interval = setInterval(poll, 10_000);
        return () => clearInterval(interval);
    }, []);

    return {
        cases,
        ambulanceLocations,
        connected,
        notifications,
        clearNotifications,
        soundEnabled,
        toggleSound,
        latestNotification,
        clearLatestNotification: () => setLatestNotification(null),
        theme,
        toggleTheme,
        updateCaseStatus,
        addNotification,
        runTutorialStep,
        tutorialStep,
        dispatchDemoAmbulance,
        cancelDemoCase,
    };
}

