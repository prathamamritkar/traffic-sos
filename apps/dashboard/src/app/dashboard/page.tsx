'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { StatsBar } from '@/components/StatsBar';
import { SOSFeed } from '@/components/SOSFeed';
import { MedicalPanel } from '@/components/MedicalPanel';
import { SignalGrid } from '@/components/SignalGrid';
import { Toast } from '@/components/Toast';
import { SettingsModal } from '@/components/SettingsModal';
import { useLiveData } from '@/hooks/useLiveData';
import { AnimatePresence } from 'framer-motion';
import type { CaseRecord, TrafficSignalPayload, CaseStatus } from '@/types/rctf';
import styles from './dashboard.module.css';

// Dynamically import LiveMap — Leaflet requires window (not available on server)
const LiveMap = dynamic(() => import('@/components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className={styles.mapLoading}>
            <span className="material-icons-round" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>map</span>
            <span>Initializing Mission Map…</span>
        </div>
    ),
});

// ── Seed signals (Mission Baseline) ──────────────────────────────
// Corridor nodes use verified coordinates snapped to actual Pune road intersections
// Path 1 (Kothrud → Pune Center): SIG-01, SIG-02, SIG-03
// Path 2 (University → Shivajinagar): SIG-05, SIG-04
const INITIAL_SIGNALS: TrafficSignalPayload[] = [
    { signalId: 'SIG-PUN-01', junctionId: 'Kothrud Chowk', location: { lat: 18.5035, lng: 73.8100 }, state: 'GREEN', duration: 45, corridor: false },
    { signalId: 'SIG-PUN-02', junctionId: 'Nal Stop', location: { lat: 18.5073, lng: 73.8287 }, state: 'GREEN', duration: 45, corridor: false },
    { signalId: 'SIG-PUN-03', junctionId: 'Deccan Gymkhana', location: { lat: 18.5175, lng: 73.8415 }, state: 'GREEN', duration: 45, corridor: false },
    { signalId: 'SIG-PUN-04', junctionId: 'Shivajinagar Station', location: { lat: 18.5308, lng: 73.8474 }, state: 'RED', duration: 45, corridor: false },
    { signalId: 'SIG-PUN-05', junctionId: 'University Jct', location: { lat: 18.5530, lng: 73.8250 }, state: 'YELLOW', duration: 45, corridor: false },
    { signalId: 'SIG-PUN-06', junctionId: 'Pune Station', location: { lat: 18.5289, lng: 73.8744 }, state: 'RED', duration: 45, corridor: false },
];

/**
 * Maps which signal sequence forms a corridor for which accident location.
 * This simulates the Corridor Service's dynamic orchestration logic.
 */
const CORRIDOR_MAP: Record<string, string[]> = {
    'ACC-DMO-001': ['SIG-PUN-01', 'SIG-PUN-02'],
    'ACC-DMO-003': ['SIG-PUN-01', 'SIG-PUN-02', 'SIG-PUN-03'],
    'ACC-DMO-002': ['SIG-PUN-05', 'SIG-PUN-04'],
    'ACC-TUT-001': ['SIG-PUN-01', 'SIG-PUN-02', 'SIG-PUN-03'], // Tutorial path
};

interface StoredUser {
    name: string;
    role: string;
    email: string;
}

const DEMO_USER: StoredUser = {
    name: 'Admin User',
    role: 'ADMIN',
    email: 'admin@rapidrescue.app',
};

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<StoredUser | null>(null);
    const [selectedCase, setSelected] = useState<CaseRecord | null>(null);
    const [signals, setSignals] = useState<TrafficSignalPayload[]>(INITIAL_SIGNALS);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const {
        cases,
        ambulanceLocations,
        connected,
        notifications,
        clearNotifications,
        soundEnabled,
        toggleSound,
        latestNotification,
        clearLatestNotification,
        theme,
        toggleTheme,
        updateCaseStatus,
        addNotification,
        runTutorialStep,
        tutorialStep,
        dispatchDemoAmbulance,
        cancelDemoCase,
    } = useLiveData();

    // ── Auth guard ───────────────────────────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem('rapidrescue_user');
            if (!stored) {
                localStorage.setItem('rapidrescue_user', JSON.stringify(DEMO_USER));
                localStorage.setItem('rapidrescue_token', 'demo-session-token');
                setUser(DEMO_USER);
                return;
            }
            const parsed = JSON.parse(stored) as StoredUser;
            // Minimal shape validation before trusting localStorage data
            if (!parsed?.name || !parsed?.role) {
                localStorage.setItem('rapidrescue_user', JSON.stringify(DEMO_USER));
                localStorage.setItem('rapidrescue_token', 'demo-session-token');
                setUser(DEMO_USER);
                return;
            }
            setUser(parsed);
        } catch {
            // Corrupt localStorage data — recover with demo session
            localStorage.setItem('rapidrescue_user', JSON.stringify(DEMO_USER));
            localStorage.setItem('rapidrescue_token', 'demo-session-token');
            setUser(DEMO_USER);
        }
    }, [router]);

    // ── Auto-select first active case (only on initial load) ─────
    useEffect(() => {
        if (!selectedCase && cases.length > 0) {
            const firstActive = cases.find(
                (c) => c.status !== 'RESOLVED' && c.status !== 'CANCELLED'
            );
            if (firstActive) setSelected(firstActive);
        }
    }, [cases, selectedCase]);

    // ── Keep selectedCase in sync when live data updates it ──────
    // Without this, MedicalPanel shows stale data after a CASE_UPDATE
    useEffect(() => {
        if (!selectedCase) return;
        const fresh = cases.find((c) => c.accidentId === selectedCase.accidentId);
        if (fresh && fresh !== selectedCase) {
            setSelected(fresh);
        }
    }, [cases, selectedCase]);

    // ── Dynamic Green Corridor Simulation ────────────────────────
    // Triggers when selecting an accident: flips relevant signals to GREEN
    useEffect(() => {
        if (!selectedCase) {
            setSignals(INITIAL_SIGNALS);
            return;
        }

        const path = CORRIDOR_MAP[selectedCase.accidentId] || [];
        setSignals(prev => prev.map(s => {
            const isPartOfCorridor = path.includes(s.signalId);
            if (!isPartOfCorridor) return { ...s, corridor: false };

            // Force corridor signals to GREEN and calculate order along path
            return {
                ...s,
                corridor: true,
                state: 'GREEN',
                duration: 99, // High duration to prevent manual cycle during mission
                corridorOrder: path.indexOf(s.signalId)
            };
        }));
    }, [selectedCase]);

    // ── Real-time signal updates from WebSocket fan-out ──────────
    useEffect(() => {
        const handler = (e: Event) => {
            const update = (e as CustomEvent<TrafficSignalPayload>).detail;
            setSignals((prev) => {
                const index = prev.findIndex((s) => s.signalId === update.signalId);
                if (index === -1) return [update, ...prev];
                const next = [...prev];
                next[index] = update;
                return next;
            });
        };
        window.addEventListener('rapidrescue-signal-update', handler);
        return () => window.removeEventListener('rapidrescue-signal-update', handler);
    }, []);

    // ── Real-time Traffic Signal Cycles (GREEN → YELLOW → RED) ──
    useEffect(() => {
        const interval = setInterval(() => {
            setSignals((prev) =>
                prev.map((s) => {
                    const nextDuration = (s.duration ?? 45) - 1;

                    // If duration is still > 0, just decrement
                    if (nextDuration > 0) {
                        return { ...s, duration: nextDuration };
                    }

                    // Duration has reached 0 — transition state machine
                    // Normal Cycle: GREEN (45s) → YELLOW (5s) → RED (45s)
                    let nextState = s.state;
                    let nextDur = 45;

                    switch (s.state) {
                        case 'GREEN':
                            nextState = 'YELLOW';
                            nextDur = 5;
                            break;
                        case 'YELLOW':
                            nextState = 'RED';
                            nextDur = 45;
                            break;
                        case 'RED':
                            nextState = 'GREEN';
                            nextDur = 45;
                            break;
                    }

                    return { ...s, state: nextState, duration: nextDur };
                })
            );
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // ── Handle Status Update (End-to-End Functional) ────────────
    const handleStatusUpdate = async (id: string, newStatus: CaseStatus): Promise<void> => {
        // 1. Optimistic/Local Update
        updateCaseStatus(id, newStatus);

        // 2. Mock Success for Demo IDs
        if (id.startsWith('ACC-DMO') || id.startsWith('ACC-TUT')) {
            // Handle cancellation: stop ambulance, remove marker, update status
            if (newStatus === 'CANCELLED') {
                cancelDemoCase(id);
                addNotification({
                    type: 'UPDATE',
                    title: 'Case Cancelled',
                    message: `${id} has been cancelled`,
                    icon: 'block'
                });
                return;
            }

            addNotification({
                type: 'UPDATE',
                title: 'Operation Status Updated',
                message: `${id} is now ${newStatus.replace('_', ' ')}`,
                icon: 'check_circle'
            });

            // Simulate progression for demo UX with real ambulance movement
            if (newStatus === 'DISPATCHED' || newStatus === 'EN_ROUTE') {
                // Spawn and animate the ambulance along its pre-computed route.
                // dispatchDemoAmbulance auto-transitions to ARRIVED when done.
                dispatchDemoAmbulance(id);

                if (newStatus === 'DISPATCHED') {
                    // 2 s later flip status to EN_ROUTE (ambulance is already moving)
                    setTimeout(() => {
                        updateCaseStatus(id, 'EN_ROUTE');
                        addNotification({
                            type: 'UPDATE',
                            title: 'Ambulance En-Route',
                            message: `Responder is following optimal route to ${id}`,
                            icon: 'emergency',
                        });
                    }, 2000);
                }
            }
            return;
        }

        // 3. Backend Persistence for Real Cases
        try {
            const token = localStorage.getItem('rapidrescue_token');
            const baseUrl = process.env.NEXT_PUBLIC_DETECTION_API_URL ?? 'http://localhost:3001';

            // Use dedicated cancel endpoint for CANCELLED status
            const endpoint = newStatus === 'CANCELLED'
                ? `${baseUrl}/api/sos/${id}/cancel`
                : `${baseUrl}/api/sos/${id}/status`;

            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            console.error('Failed to update status:', err);
            // Optionally revert local state here if backend fails
            alert('Backend synchronization failed. Local state preserved for demo.');
            throw err;
        }
    };

    // ── Don't render until auth resolves ────────────────────────
    if (!user) return null;

    const activeCount = cases.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CANCELLED').length;
    const resolvedCount = cases.filter((c) => c.status === 'RESOLVED').length;

    // ── Demo Fallback Ambulances (for Real Backend Cases Only) ──
    // Skip fallback creation for demo/tutorial cases — they're only dispatched explicitly
    const displayAmbulances = new Map(ambulanceLocations);
    if (displayAmbulances.size === 0 && cases.length > 0) {
        cases.forEach(c => {
            // Only create fallback for real backend cases, not demo/tutorial
            if (c.accidentId.startsWith('ACC-DMO') || c.accidentId.startsWith('ACC-TUT')) {
                return;
            }
            const path = CORRIDOR_MAP[c.accidentId];
            if (path && path.length > 0) {
                const startSignal = INITIAL_SIGNALS.find(s => s.signalId === path[0]);
                if (startSignal) {
                    displayAmbulances.set(`DEMO-V-${c.accidentId}`, {
                        entityId: `V-AMB-${c.accidentId}`,
                        accidentId: c.accidentId,
                        location: { ...startSignal.location, heading: 45, speed: 0 },
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }

    return (
        <div className={styles.layout}>
            <Navbar
                user={user}
                connected={connected}
                activeIncidents={activeCount}
                notifications={notifications}
                onClearNotifications={clearNotifications}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onTutorialStep={runTutorialStep}
                tutorialStep={tutorialStep}
            />

            <div className={styles.body}>
                {/* Left sidebar */}
                <aside className={styles.sidebar}>
                    <StatsBar
                        total={cases.length}
                        active={activeCount}
                        resolved={resolvedCount}
                        responders={2}
                    />
                    <SOSFeed
                        cases={cases}
                        selectedId={selectedCase?.accidentId}
                        onSelect={(c) => {
                            console.log('[dashboard] Selecting case via feed:', c.accidentId);
                            setSelected(c);
                        }}
                    />
                </aside>

                {/* Center map */}
                <main className={styles.main}>
                    <LiveMap
                        cases={cases}
                        ambulanceLocations={displayAmbulances}
                        signals={signals}
                        selectedCase={selectedCase}
                        theme={theme}
                        onCaseSelect={(c) => {
                            console.log('[dashboard] Selecting case via map:', c.accidentId);
                            setSelected(c);
                        }}
                    />
                </main>

                {/* Right panel */}
                <aside className={styles.details}>
                    {selectedCase ? (
                        <>
                            <MedicalPanel
                                caseRecord={selectedCase}
                                onStatusUpdate={handleStatusUpdate}
                            />
                            <SignalGrid signals={signals} />
                        </>
                    ) : (
                        <>
                            <div className={styles.noSelection}>
                                <span className={`${styles.noSelectionIcon} material-icons-round`}>location_searching</span>
                                <p>Select a case from the feed to view medical details</p>
                            </div>
                            <SignalGrid signals={signals} />
                        </>
                    )}
                </aside>
            </div>

            <AnimatePresence>
                {latestNotification && (
                    <Toast
                        message={latestNotification.message}
                        title={latestNotification.title}
                        type={latestNotification.type}
                        onClose={clearLatestNotification}
                    />
                )}
            </AnimatePresence>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                user={user}
                theme={theme}
                onToggleTheme={toggleTheme}
            />
        </div >
    );
}
