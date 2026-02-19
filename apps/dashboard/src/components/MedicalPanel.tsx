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
                <span className={`badge badge-red`}>{accidentId}</span>
            </div>

            {/* Vital Stats */}
            <div className={styles.vitals}>
                <VitalCard label="Blood Group" value={mp.bloodGroup} highlight />
                <VitalCard label="Age" value={`${mp.age} yrs`} />
                <VitalCard label="Gender" value={mp.gender} />
            </div>

            {/* Case Scene Analysis (from Bystander Vision) */}
            {caseRecord.sceneAnalysis && (
                <Section title="🧠 Intelligent Scene Analysis">
                    <MetricRow label="Severity" value={caseRecord.sceneAnalysis.injurySeverity} alert={caseRecord.sceneAnalysis.injurySeverity === 'CRITICAL'} />
                    <MetricRow label="Victims" value={caseRecord.sceneAnalysis.victimCount.toString()} />
                    <MetricRow label="Urgency" value={caseRecord.sceneAnalysis.urgencyLevel} alert={caseRecord.sceneAnalysis.urgencyLevel === 'IMMEDIATE'} />
                    <div className={styles.tags} style={{ marginTop: '0.5rem' }}>
                        {caseRecord.sceneAnalysis.visibleHazards.map(h => (
                            <span key={h} className="badge badge-yellow">⚠️ {h}</span>
                        ))}
                    </div>
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

            {/* Medical Info */}
            {mp.allergies.length > 0 && (
                <Section title="⚠️ Allergies">
                    <div className={styles.tags}>
                        {mp.allergies.map((a) => (
                            <span key={a} className={`badge badge-red`}>{a}</span>
                        ))}
                    </div>
                </Section>
            )}

            {mp.medications.length > 0 && (
                <Section title="Medications">
                    <div className={styles.tags}>
                        {mp.medications.map((m) => (
                            <span key={m} className={`badge badge-blue`}>{m}</span>
                        ))}
                    </div>
                </Section>
            )}

            {mp.conditions.length > 0 && (
                <Section title="Medical Conditions">
                    <div className={styles.tags}>
                        {mp.conditions.map((c) => (
                            <span key={c} className={`badge badge-yellow`}>{c}</span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Emergency Contacts */}
            <Section title="Emergency Contacts">
                {mp.emergencyContacts.map((contact) => (
                    <div key={contact} className={styles.contact}>
                        <span>📞</span>
                        <a href={`tel:${contact}`} className={styles.contactLink}>{contact}</a>
                    </div>
                ))}
            </Section>

            {/* Case Timeline */}
            <CaseTimeline caseRecord={caseRecord} />

            {/* Case Status */}
            <Section title="Case Info">
                <MetricRow label="Status" value={status} />
                <MetricRow label="Created" value={new Date(createdAt).toLocaleTimeString()} />
                {caseRecord.responderId && (
                    <MetricRow label="Responder" value={caseRecord.responderId} />
                )}
            </Section>

            {/* Live Media Stream */}
            <Section title="🔴 Live Evidence Stream">
                <BroadcastPlayer accidentId={accidentId} />
            </Section>
        </div>
    );
}

function BroadcastPlayer({ accidentId }: { accidentId: string }) {
    const [chunk, setChunk] = useState(0);
    const [token, setToken] = useState<string | null>(null);

    // Retrieve signed access token from auth state
    useEffect(() => {
        const stored = localStorage.getItem('rescuedge_token');
        setToken(stored || 'fallback-token');
    }, []);

    // Simulated chunk rotation
    useEffect(() => {
        const interval = setInterval(() => {
            setChunk(c => (c + 1) % 5); // cycle through 5 chunks
        }, 12000); // 12s segments
        return () => clearInterval(interval);
    }, []);

    const videoUrl = `http://localhost:3001/api/broadcast/${accidentId}/stream/${chunk}?token=${token}`;

    return (
        <div className={styles.streamContainer}>
            <video
                key={videoUrl}
                autoPlay
                muted
                controls
                className={styles.videoPlayer}
                onError={(e) => {
                    // Fallback for missing chunks
                    (e.target as HTMLVideoElement).style.display = 'none';
                }}
            >
                <source src={videoUrl} type="video/mp4" />
                No video feed available
            </video>
            <div className={styles.streamOverlay}>
                <span className={styles.pulseDot}></span>
                LIVE CHUNK ${chunk}
            </div>
        </div>
    );
}

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
            <span className={`${styles.metricValue} ${alert ? styles.metricAlert : ''}`}>{value}</span>
        </div>
    );
}
