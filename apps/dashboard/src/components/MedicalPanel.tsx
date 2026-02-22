'use client';
import { useState } from 'react';
import type { CaseRecord, CaseStatus } from '@/types/rctf';
import { CaseTimeline } from './CaseTimeline';
import styles from './MedicalPanel.module.css';

interface MedicalPanelProps {
    caseRecord: CaseRecord;
    onStatusUpdate: (id: string, status: CaseStatus) => Promise<void>;
}

const URGENCY_CLASS: Record<string, string> = {
    IMMEDIATE: 'urgencyImmediate',
    HIGH: 'urgencyHigh',
    NORMAL: 'urgencyNormal',
};

export function MedicalPanel({ caseRecord, onStatusUpdate }: MedicalPanelProps) {
    const [updating, setUpdating] = useState(false);
    const m = caseRecord.medicalProfile;
    const c = caseRecord.metrics;
    const s = caseRecord.sceneAnalysis;

    const handleStatus = async (status: CaseStatus) => {
        setUpdating(true);
        try {
            await onStatusUpdate(caseRecord.accidentId, status);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className={styles.panel}>
            {/* 1. Header & ID */}
            <div className={styles.header}>
                <div className={styles.caseId}>
                    <span className={styles.id}>{caseRecord.accidentId}</span>
                    <span className={styles.timestamp}>
                        Detected {new Date(caseRecord.createdAt).toLocaleTimeString()}
                    </span>
                </div>
                <span className="badge badge-sos">Live SOS</span>
            </div>

            {/* 1.5 Timeline progression */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>timeline</span>
                    <span>Operation Progression</span>
                </div>
                <CaseTimeline caseRecord={caseRecord} />
            </div>

            {/* 2. Medical Profile Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>monitor_heart</span>
                    <span>Victim Medical Profile</span>
                </div>
                <div className={styles.grid}>
                    <div className={styles.item}>
                        <span className={styles.label}>Blood Group</span>
                        <span className={`${styles.value} ${styles.bloodGroup}`}>{m.bloodGroup}</span>
                    </div>
                    <div className={styles.item}>
                        <span className={styles.label}>Identity</span>
                        <span className={styles.value}>{m.age}y / {m.gender}</span>
                    </div>
                </div>

                <div className={styles.item}>
                    <span className={styles.label}>Allergies</span>
                    <div className={styles.list}>
                        {m.allergies.length > 0 ? (
                            m.allergies.map(a => <span key={a} className={`${styles.chip} ${styles.critical}`}>{a}</span>)
                        ) : (
                            <span className={styles.value}>None Reported</span>
                        )}
                    </div>
                </div>

                <div className={styles.item}>
                    <span className={styles.label}>Conditions</span>
                    <div className={styles.list}>
                        {m.conditions.map(cond => <span key={cond} className={styles.chip}>{cond}</span>)}
                    </div>
                </div>

                <div className={styles.item}>
                    <span className={styles.label}>Emergency Contacts</span>
                    <div className={styles.list}>
                        {m.emergencyContacts.map(phone => (
                            <span key={phone} className={styles.value} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-icons-round" style={{ fontSize: '12px' }}>call</span>
                                {phone}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Crash Metrics */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>insights</span>
                    <span>Telemetry Metrics</span>
                </div>
                <div className={styles.metrics}>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{c.gForce.toFixed(1)}g</span>
                        <span className={styles.metricLabel}>Impact</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{c.speedBefore}</span>
                        <span className={styles.metricLabel}>km/h Pre</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{(c.mlConfidence * 100).toFixed(0)}%</span>
                        <span className={styles.metricLabel}>ML Conf</span>
                    </div>
                </div>
                <div className={styles.item}>
                    <span className={styles.label}>Detection Logic</span>
                    <span className={styles.value}>{c.crashType}{c.rolloverDetected ? ' (Rollover)' : ''}</span>
                </div>
            </div>

            {/* 4. Scene Analysis (AI) */}
            {s && (
                <div className={styles.sceneAnalysis}>
                    <div className={styles.sceneTitle}>
                        <span className="material-icons-round" style={{ fontSize: '18px' }}>auto_awesome</span>
                        <span>Gemini Vision Triage</span>
                        <div className={`${styles.urgency} ${styles[URGENCY_CLASS[s.urgencyLevel] ?? 'urgencyNormal']}`}>
                            {s.urgencyLevel}
                        </div>
                    </div>
                    <p className={styles.sceneText}>
                        AI suggests: {s.suggestedActions.join('. ')}
                    </p>
                    <div className={styles.item}>
                        <span className={styles.label}>Injury Severity</span>
                        <span className={styles.value} style={{ color: 'var(--color-sos-red)' }}>{s.injurySeverity}</span>
                    </div>
                    <div className={styles.item}>
                        <span className={styles.label}>Visible Hazards</span>
                        <div className={styles.list}>
                            {s.visibleHazards.map(h => <span key={h} className={styles.chip}>{h}</span>)}
                        </div>
                    </div>
                </div>
            )}

            {/* 4.5. Victim Accident Photo */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>photo_camera</span>
                    <span>Victim Accident Photo</span>
                </div>
                <div className={styles.photoContainer} style={{ 
                    width: '100%', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '300px'
                }}>
                    <img 
                        src="/images/accident-scene-3.jpg" 
                        alt="Victim accident scene from mobile app"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                </div>
            </div>

            {/* 5. Command Actions */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>visibility</span>
                    <span>Scene Hazards & Victims</span>
                </div>
                <div className={styles.statusActions}>
                    <div className={styles.btnGroup}>
                        {caseRecord.status === 'DETECTED' && (
                            <button
                                className={`${styles.updateBtn} btn btn-sos`}
                                onClick={() => handleStatus('DISPATCHED')}
                                disabled={updating}
                            >
                                {updating ? '...' : 'Dispatch Help'}
                            </button>
                        )}
                        {caseRecord.status === 'DISPATCHED' && (
                            <button
                                className={`${styles.updateBtn} btn btn-primary`}
                                onClick={() => handleStatus('EN_ROUTE')}
                                disabled={updating}
                            >
                                {updating ? '...' : 'Ambulance En-Route'}
                            </button>
                        )}
                        {caseRecord.status === 'EN_ROUTE' && (
                            <button
                                className={`${styles.updateBtn} btn btn-primary`}
                                onClick={() => handleStatus('ARRIVED')}
                                disabled={updating}
                            >
                                {updating ? '...' : 'Confirm Arrival'}
                            </button>
                        )}
                        {caseRecord.status === 'ARRIVED' && (
                            <button
                                className={`${styles.updateBtn} btn btn-primary`}
                                onClick={() => handleStatus('RESOLVED')}
                                disabled={updating}
                            >
                                {updating ? '...' : 'Resolve Case'}
                            </button>
                        )}
                        {caseRecord.status === 'RESOLVED' && (
                            <div className={styles.resolvedBanner}>
                                <span className="material-icons-round">verified</span>
                                Case Successfully Resolved
                            </div>
                        )}
                        {caseRecord.status !== 'RESOLVED' && caseRecord.status !== 'CANCELLED' && (
                            <button
                                className={`${styles.updateBtn} btn btn-outlined`}
                                onClick={() => handleStatus('CANCELLED')}
                                disabled={updating}
                            >
                                Cancel Case
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
