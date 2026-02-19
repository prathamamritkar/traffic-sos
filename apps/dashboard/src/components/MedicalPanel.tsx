import { useState, useEffect } from 'react';
import type { CaseRecord } from '@/types/rctf';
import { CaseTimeline } from './CaseTimeline';
import styles from './MedicalPanel.module.css';

interface MedicalPanelProps {
    caseRecord: CaseRecord;
}

export function MedicalPanel({ caseRecord }: MedicalPanelProps) {
    const { medicalProfile: mp, metrics, accidentId, status, createdAt } = caseRecord;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>Medical Profile</span>
                <span className="badge badge-red">{accidentId}</span>
            </div>

            {/* Vital Stats */}
            <div className={styles.vitals}>
                <VitalCard label="Blood Group" value={mp.bloodGroup} highlight />
                <VitalCard label="Age" value={`${mp.age} yrs`} />
                <VitalCard label="Gender" value={mp.gender} />
            </div>

            {/* Intelligent Scene Analysis (from Bystander Vision AI) */}
            {caseRecord.sceneAnalysis && (
                <Section title="🧠 Intelligent Scene Analysis">
                    <MetricRow
                        label="Severity"
                        value={caseRecord.sceneAnalysis.injurySeverity}
                        alert={caseRecord.sceneAnalysis.injurySeverity === 'CRITICAL'}
                    />
                    <MetricRow
                        label="Victims"
                        value={caseRecord.sceneAnalysis.victimCount.toString()}
                    />
                    <MetricRow
                        label="Urgency"
                        value={caseRecord.sceneAnalysis.urgencyLevel}
                        alert={caseRecord.sceneAnalysis.urgencyLevel === 'IMMEDIATE'}
                    />
                    {caseRecord.sceneAnalysis.visibleHazards.length > 0 && (
                        <div className={styles.tags} style={{ marginTop: '0.5rem' }}>
                            {caseRecord.sceneAnalysis.visibleHazards.map((h) => (
                                <span key={h} className="badge badge-yellow">⚠️ {h}</span>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {/* Crash Metrics */}
            <Section title="Crash Metrics">
                <MetricRow label="G-Force" value={`${metrics.gForce.toFixed(1)}g`} alert={metrics.gForce > 5} />
                <MetricRow label="Speed Before" value={`${metrics.speedBefore} km/h`} />
                <MetricRow label="Speed After" value={`${metrics.speedAfter} km/h`} />
                <MetricRow label="ML Confidence" value={`${(metrics.mlConfidence * 100).toFixed(0)}%`} />
                <MetricRow label="Crash Type" value={metrics.crashType} />
                <MetricRow label="Rollover" value={metrics.rolloverDetected ? 'YES ⚠️' : 'No'} alert={metrics.rolloverDetected} />
            </Section>

            {/* Medical Info — only rendered when data exists */}
            {mp.allergies.length > 0 && (
                <Section title="⚠️ Allergies">
                    <div className={styles.tags}>
                        {mp.allergies.map((a) => (
                            <span key={a} className="badge badge-red">{a}</span>
                        ))}
                    </div>
                </Section>
            )}

            {mp.medications.length > 0 && (
                <Section title="Medications">
                    <div className={styles.tags}>
                        {mp.medications.map((m) => (
                            <span key={m} className="badge badge-blue">{m}</span>
                        ))}
                    </div>
                </Section>
            )}

            {mp.conditions.length > 0 && (
                <Section title="Medical Conditions">
                    <div className={styles.tags}>
                        {mp.conditions.map((c) => (
                            <span key={c} className="badge badge-yellow">{c}</span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Emergency Contacts — guarded: empty array means no Section rendered */}
            {mp.emergencyContacts.length > 0 && (
                <Section title="Emergency Contacts">
                    {mp.emergencyContacts.map((contact) => (
                        <div key={contact} className={styles.contact}>
                            <span>📞</span>
                            <a href={`tel:${contact}`} className={styles.contactLink}>
                                {contact}
                            </a>
                        </div>
                    ))}
                </Section>
            )}

            {/* Case Timeline */}
            <CaseTimeline caseRecord={caseRecord} />

            {/* Case Info */}
            <Section title="Case Info">
                <MetricRow label="Status" value={status} />
                <MetricRow
                    label="Created"
                    value={new Date(createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })}
                />
                {caseRecord.responderId && (
                    <MetricRow label="Responder" value={caseRecord.responderId} />
                )}
            </Section>

            {/* Live Evidence Stream */}
            <Section title="🔴 Live Evidence Stream">
                <BroadcastPlayer accidentId={accidentId} />
            </Section>
        </div>
    );
}

// ── BroadcastPlayer ──────────────────────────────────────────────
function BroadcastPlayer({ accidentId }: { accidentId: string }) {
    const [chunk, setChunk] = useState(0);
    const [token, setToken] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    // Retrieve auth token — null if not available (never uses a fake fallback)
    useEffect(() => {
        try {
            setToken(localStorage.getItem('rescuedge_token'));
        } catch {
            setToken(null);
        }
    }, []);

    // Reset error state when chunk rotates (new segment might be valid)
    useEffect(() => {
        const interval = setInterval(() => {
            setChunk((c) => (c + 1) % 5);
            setHasError(false);
        }, 12_000);
        return () => clearInterval(interval);
    }, []);

    // Use env var — never hardcode localhost
    const baseUrl = process.env.NEXT_PUBLIC_DETECTION_API_URL ?? '';
    const videoUrl = token && baseUrl
        ? `${baseUrl}/api/broadcast/${encodeURIComponent(accidentId)}/stream/${chunk}?token=${encodeURIComponent(token)}`
        : null;

    // No auth token or service URL not configured
    if (!videoUrl) {
        return (
            <div className={styles.streamOffline}>
                <span>📡</span>
                <p>Evidence stream unavailable — service not configured</p>
            </div>
        );
    }

    return (
        <div className={styles.streamContainer}>
            {hasError ? (
                // Visible fallback card instead of invisible collapsed element
                <div className={styles.streamOffline}>
                    <span>📡</span>
                    <p>Awaiting stream for chunk {chunk}…</p>
                </div>
            ) : (
                <video
                    key={videoUrl}
                    autoPlay
                    muted
                    controls
                    className={styles.videoPlayer}
                    onError={() => setHasError(true)}
                >
                    <source src={videoUrl} type="video/mp4" />
                    Your browser does not support the video element.
                </video>
            )}
            <div className={styles.streamOverlay}>
                <span className={styles.pulseDot} />
                LIVE · CHUNK {chunk}
            </div>
        </div>
    );
}

// ── Sub-components ───────────────────────────────────────────────

function VitalCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`${styles.vitalCard} ${highlight ? styles.vitalHighlight : ''}`}>
            <div className={styles.vitalValue}>{value}</div>
            <div className={styles.vitalLabel}>{label}</div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionTitle}>{title}</div>
            <div className={styles.sectionContent}>{children}</div>
        </div>
    );
}

function MetricRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
    return (
        <div className={styles.metricRow}>
            <span className={styles.metricLabel}>{label}</span>
            <span className={`${styles.metricValue} ${alert ? styles.metricAlert : ''}`}>
                {value}
            </span>
        </div>
    );
}
