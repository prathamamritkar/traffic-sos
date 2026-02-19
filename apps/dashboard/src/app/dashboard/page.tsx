'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { StatsBar } from '@/components/StatsBar';
import { SOSFeed } from '@/components/SOSFeed';
import { MedicalPanel } from '@/components/MedicalPanel';
import { SignalGrid } from '@/components/SignalGrid';
import { useLiveData } from '@/hooks/useLiveData';
import type { CaseRecord, TrafficSignalPayload } from '@/types/rctf';
import styles from './dashboard.module.css';

// Dynamically import LiveMap — Leaflet requires window (not available on server)
const LiveMap = dynamic(() => import('@/components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className={styles.mapLoading}>
            <span>🗺️ Loading map…</span>
        </div>
    ),
});

// ── Seed signals ─────────────────────────────────────────────────
const INITIAL_SIGNALS: TrafficSignalPayload[] = [
    { signalId: 'SIG-001', junctionId: 'Deccan Gymkhana', location: { lat: 18.5167, lng: 73.8478 }, state: 'GREEN', duration: 45, corridor: true },
    { signalId: 'SIG-002', junctionId: 'FC Road Junction', location: { lat: 18.5236, lng: 73.8478 }, state: 'GREEN', duration: 45, corridor: true },
    { signalId: 'SIG-003', junctionId: 'Shivajinagar', location: { lat: 18.5308, lng: 73.8474 }, state: 'RED', duration: 0, corridor: false },
    { signalId: 'SIG-004', junctionId: 'Baner Road', location: { lat: 18.5590, lng: 73.7868 }, state: 'RED', duration: 0, corridor: false },
    { signalId: 'SIG-005', junctionId: 'Aundh', location: { lat: 18.5590, lng: 73.8077 }, state: 'YELLOW', duration: 0, corridor: false },
    { signalId: 'SIG-006', junctionId: 'Kothrud', location: { lat: 18.5074, lng: 73.8077 }, state: 'RED', duration: 0, corridor: false },
];

interface StoredUser {
    name: string;
    role: string;
    email: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<StoredUser | null>(null);
    const [selectedCase, setSelected] = useState<CaseRecord | null>(null);
    const [signals, setSignals] = useState<TrafficSignalPayload[]>(INITIAL_SIGNALS);

    const { cases, ambulanceLocations, connected } = useLiveData();

    // ── Auth guard ───────────────────────────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem('rescuedge_user');
            if (!stored) {
                router.replace('/');
                return;
            }
            const parsed = JSON.parse(stored) as StoredUser;
            // Minimal shape validation before trusting localStorage data
            if (!parsed?.name || !parsed?.role) {
                localStorage.removeItem('rescuedge_user');
                localStorage.removeItem('rescuedge_token');
                router.replace('/');
                return;
            }
            setUser(parsed);
        } catch {
            // Corrupt localStorage data — clear and redirect to login
            localStorage.removeItem('rescuedge_user');
            localStorage.removeItem('rescuedge_token');
            router.replace('/');
        }
    }, [router]);

    // ── Auto-select first active case (only on initial load) ─────
    useEffect(() => {
        if (!selectedCase && cases.length > 0) {
            const active = cases.find(
                (c) => c.status !== 'RESOLVED' && c.status !== 'CANCELLED'
            );
            if (active) setSelected(active);
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
        window.addEventListener('rescuedge-signal-update', handler);
        return () => window.removeEventListener('rescuedge-signal-update', handler);
    }, []);

    // ── Simulate corridor signal countdown ───────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            setSignals((prev) =>
                prev.map((s) => ({
                    ...s,
                    duration: s.corridor ? Math.max(0, (s.duration ?? 45) - 1) : s.duration,
                }))
            );
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // ── Don't render until auth resolves ────────────────────────
    if (!user) return null;

    const active = cases.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CANCELLED').length;
    const resolved = cases.filter((c) => c.status === 'RESOLVED').length;

    return (
        <div className={styles.layout}>
            <Navbar user={user} connected={connected} activeIncidents={active} />

            <div className={styles.body}>
                {/* Left sidebar */}
                <aside className={styles.sidebar}>
                    <StatsBar
                        total={cases.length}
                        active={active}
                        resolved={resolved}
                        responders={2}
                    />
                    <SOSFeed
                        cases={cases}
                        selectedId={selectedCase?.accidentId}
                        onSelect={setSelected}
                    />
                </aside>

                {/* Center map */}
                <main className={styles.main}>
                    <LiveMap
                        cases={cases}
                        ambulanceLocations={ambulanceLocations}
                        signals={signals}
                        selectedCase={selectedCase}
                        onCaseSelect={setSelected}
                    />
                </main>

                {/* Right panel */}
                <aside className={styles.details}>
                    {selectedCase ? (
                        <>
                            <MedicalPanel caseRecord={selectedCase} />
                            <SignalGrid signals={signals} />
                        </>
                    ) : (
                        <>
                            <div className={styles.noSelection}>
                                <span className={styles.noSelectionIcon}>📍</span>
                                <p>Select a case from the feed to view medical details</p>
                            </div>
                            <SignalGrid signals={signals} />
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
