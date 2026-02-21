'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import styles from './analytics.module.css';

// ── Dummy Data ──────────────────────────────────────────────────
const ACCIDENTS_BY_HOUR = [
    { hour: '00:00', count: 12 }, { hour: '02:00', count: 8 }, { hour: '04:00', count: 5 },
    { hour: '06:00', count: 18 }, { hour: '08:00', count: 42 }, { hour: '10:00', count: 35 },
    { hour: '12:00', count: 28 }, { hour: '14:00', count: 31 }, { hour: '16:00', count: 45 },
    { hour: '18:00', count: 58 }, { hour: '20:00', count: 32 }, { hour: '22:00', count: 15 },
];

const CRASH_TYPES = [
    { name: 'Confirmed Crash', value: 450, color: '#ef4444' },
    { name: 'Pothole', value: 120, color: '#f59e0b' },
    { name: 'Hard Brake', value: 280, color: '#3b82f6' },
    { name: 'Manual SOS', value: 85, color: '#8b5cf6' },
];

const RESPONSE_TIME_TREND = [
    { day: 'Mon', time: 12.5 }, { day: 'Tue', time: 11.2 }, { day: 'Wed', time: 13.8 },
    { day: 'Thu', time: 10.5 }, { day: 'Fri', time: 9.8 }, { day: 'Sat', time: 11.5 },
    { day: 'Sun', time: 10.8 },
];

const RECENT_HISTORY = [
    { id: 'ACC-2026-X12J92', type: 'CONFIRMED_CRASH', location: 'Baner Road', time: '10:24 AM', status: 'RESOLVED', severity: 'HIGH' },
    { id: 'ACC-2026-L92K11', type: 'MANUAL_SOS', location: 'FC Road', time: '11:15 AM', status: 'RESOLVED', severity: 'MEDIUM' },
    { id: 'ACC-2026-M02P34', type: 'POTHOLE', location: 'Kothrud', time: '12:42 PM', status: 'CANCELLED', severity: 'LOW' },
    { id: 'ACC-2026-Q88R19', type: 'HARD_BRAKE', location: 'Hinjewadi', time: '01:05 PM', status: 'RESOLVED', severity: 'MEDIUM' },
];

interface StoredUser {
    name: string;
    role: string;
    email: string;
}

export default function AnalyticsPage() {
    const router = useRouter();
    const [user, setUser] = useState<StoredUser | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('rescuedge_user');
            if (!stored) {
                router.replace('/');
                return;
            }
            setUser(JSON.parse(stored));
        } catch {
            router.replace('/');
        }
    }, [router]);

    if (!user) return null;

    return (
        <div className={styles.layout}>
            <Navbar user={user} connected={true} activeIncidents={3} />

            <main className={styles.body}>
                <header className={styles.header}>
                    <h1 className={styles.title}>System Analytics</h1>
                    <p className={styles.subtitle}>Real-time performance metrics and incident distribution</p>
                </header>

                {/* Stats Cards */}
                <section className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Total Incidents</span>
                            <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                <span className="material-icons-round">notification_important</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>1,284</div>
                        <div className={`${styles.statTrend} ${styles.trendUp}`}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>trending_up</span>
                            <span>12% from last month</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Avg Response Time</span>
                            <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                <span className="material-icons-round">speed</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>11.4m</div>
                        <div className={`${styles.statTrend} ${styles.trendDown}`}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>trending_down</span>
                            <span>8% faster than avg</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Lives Saved</span>
                            <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                                <span className="material-icons-round">favorite</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>942</div>
                        <div className={`${styles.statTrend} ${styles.trendUp}`}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>trending_up</span>
                            <span>42 this week</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Active Responders</span>
                            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                <span className="material-icons-round">emergency</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>54</div>
                        <div className={styles.statTrend}>
                            <span>Across 12 zones</span>
                        </div>
                    </div>
                </section>

                {/* Charts */}
                <section className={styles.chartsGrid}>
                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <h3 className={styles.chartTitle}>Incidents Heatmap (24h)</h3>
                            <span className="material-icons-round" style={{ color: 'var(--text-muted)' }}>more_vert</span>
                        </div>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={ACCIDENTS_BY_HOUR}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px' }}
                                        itemStyle={{ color: '#ef4444' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#ef4444" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <h3 className={styles.chartTitle}>Distribution by Type</h3>
                        </div>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={CRASH_TYPES}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {CRASH_TYPES.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {CRASH_TYPES.map(type => (
                                <div key={type.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: type.color }} />
                                    <span style={{ color: 'var(--text-muted)' }}>{type.name}</span>
                                    <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{type.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Recent History Table */}
                <section className={styles.tableContainer}>
                    <div className={styles.tableHeader}>
                        <h3 className={styles.chartTitle}>Recent Deployment History</h3>
                        <button className="btn btn-outlined" style={{ padding: '6px 12px', fontSize: '12px' }}>Export CSV</button>
                    </div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Incident ID</th>
                                <th>Type</th>
                                <th>Location</th>
                                <th>Time</th>
                                <th>Severity</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {RECENT_HISTORY.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: '600', fontFamily: 'monospace' }}>{row.id}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: CRASH_TYPES.find(t => t.name.toUpperCase() === row.type.replace('_', ' '))?.color || '#fff' }} />
                                            {row.type}
                                        </div>
                                    </td>
                                    <td>{row.location}</td>
                                    <td>{row.time}</td>
                                    <td>
                                        <span style={{
                                            color: row.severity === 'HIGH' ? '#ef4444' : row.severity === 'MEDIUM' ? '#f59e0b' : '#3b82f6',
                                            fontSize: '11px', fontWeight: '700'
                                        }}>
                                            {row.severity}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${row.status === 'RESOLVED' ? 'badge-blue' : 'badge-red'}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </main>
        </div>
    );
}
