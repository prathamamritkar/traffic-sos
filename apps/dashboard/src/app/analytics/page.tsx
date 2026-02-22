'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import { INITIAL_CASES } from '@/hooks/useLiveData';
import styles from './analytics.module.css';

interface StoredUser {
    name: string;
    role: string;
    email: string;
}

const DEFAULT_USER: StoredUser = {
    name: 'Admin User',
    role: 'ADMIN',
    email: 'admin@rescuedge.app',
};

const ACCIDENTS_BY_HOUR = [
    { hour: '00:00', count: 12 },
    { hour: '02:00', count: 8 },
    { hour: '04:00', count: 5 },
    { hour: '06:00', count: 18 },
    { hour: '08:00', count: 42 },
    { hour: '10:00', count: 35 },
    { hour: '12:00', count: 28 },
    { hour: '14:00', count: 31 },
    { hour: '16:00', count: 45 },
    { hour: '18:00', count: 58 },
    { hour: '20:00', count: 32 },
    { hour: '22:00', count: 15 },
];

const CRASH_COLORS = ['#B3261E', '#934B00', '#0061A4', '#6750A4'];

export default function AnalyticsPage() {
    const router = useRouter();
    const [user, setUser] = useState<StoredUser>(DEFAULT_USER);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('rapidrescue_user');
            if (!stored) {
                router.replace('/');
                return;
            }
            setUser(JSON.parse(stored));
        } catch {
            router.replace('/');
        }
    }, [router]);

    const totalIncidents = INITIAL_CASES.length;
    const activeIncidents = INITIAL_CASES.filter(c => c.status !== 'RESOLVED' && c.status !== 'CANCELLED').length;
    const resolvedIncidents = INITIAL_CASES.filter(c => c.status === 'RESOLVED').length;

    const avgResponseMinutes = useMemo(() => {
        const completed = INITIAL_CASES.filter(c => c.resolvedAt);
        if (completed.length === 0) return 11.4;

        const totalMinutes = completed.reduce((sum, item) => {
            const created = new Date(item.createdAt).getTime();
            const resolved = new Date(item.resolvedAt as string).getTime();
            if (Number.isNaN(created) || Number.isNaN(resolved) || resolved <= created) return sum;
            return sum + (resolved - created) / 60000;
        }, 0);

        return Number((totalMinutes / completed.length).toFixed(1));
    }, []);

    const crashTypeDistribution = useMemo(() => {
        const counts = new Map<string, number>();
        for (const item of INITIAL_CASES) {
            const key = item.metrics?.crashType || 'Unknown';
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        return Array.from(counts.entries()).map(([name, value], index) => ({
            name,
            value,
            color: CRASH_COLORS[index % CRASH_COLORS.length],
        }));
    }, []);

    const recentHistory = useMemo(() => {
        return INITIAL_CASES
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(item => ({
                id: item.accidentId,
                type: item.metrics?.crashType || 'Unknown',
                location: `${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`,
                time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                severity: item.sceneAnalysis?.injurySeverity || 'UNKNOWN',
                status: item.status,
            }));
    }, []);

    const livesSaved = resolvedIncidents * 2;

    return (
        <div className={styles.layout}>
            <Navbar user={user} connected={true} activeIncidents={activeIncidents} />

            <main className={styles.body}>
                <header className={styles.header}>
                    <h1 className={styles.title}>System Analytics</h1>
                    <p className={styles.subtitle}>Mock dashboard performance metrics and incident distribution</p>
                </header>

                <section className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Total Incidents</span>
                            <div className={styles.statIcon} style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-primary)' }}>
                                <span className="material-icons-round">car_crash</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>{totalIncidents}</div>
                        <div className={`${styles.statTrend} ${styles.trendUp}`}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>sync</span>
                            <span>From dashboard mock cases</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Avg Response Time</span>
                            <div className={styles.statIcon} style={{ background: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-secondary)' }}>
                                <span className="material-icons-round">timer</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>{avgResponseMinutes}m</div>
                        <div className={`${styles.statTrend} ${styles.trendDown}`}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>schedule</span>
                            <span>Computed from resolved mock records</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Lives Saved</span>
                            <div className={styles.statIcon} style={{ background: 'var(--md-sys-color-tertiary-container)', color: 'var(--md-sys-color-tertiary)' }}>
                                <span className="material-icons-round">volunteer_activism</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>{livesSaved}</div>
                        <div className={`${styles.statTrend} ${styles.trendUp}`}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>monitor_heart</span>
                            <span>Derived from resolved incidents</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <span className={styles.statLabel}>Active Incidents</span>
                            <div className={styles.statIcon} style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-error)' }}>
                                <span className="material-icons-round">emergency</span>
                            </div>
                        </div>
                        <div className={styles.statValue}>{activeIncidents}</div>
                        <div className={styles.statTrend}>
                            <span>Synchronized with dashboard status</span>
                        </div>
                    </div>
                </section>

                <section className={styles.chartsGrid}>
                    <div className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <h3 className={styles.chartTitle}>Incidents Heatmap (24h)</h3>
                        </div>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={ACCIDENTS_BY_HOUR}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--md-sys-color-primary)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--md-sys-color-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" vertical={false} />
                                    <XAxis dataKey="hour" stroke="var(--md-sys-color-on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--md-sys-color-on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--md-sys-color-surface-container-highest)',
                                            border: '1px solid var(--md-sys-color-outline-variant)',
                                            borderRadius: '8px',
                                            color: 'var(--md-sys-color-on-surface)',
                                        }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="var(--md-sys-color-primary)" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
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
                                        data={crashTypeDistribution}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {crashTypeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--md-sys-color-surface-container-highest)',
                                            border: '1px solid var(--md-sys-color-outline-variant)',
                                            borderRadius: '8px',
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {crashTypeDistribution.map(type => (
                                <div key={type.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: type.color }} />
                                    <span style={{ color: 'var(--text-muted)' }}>{type.name}</span>
                                    <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{type.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

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
                            {recentHistory.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: '600', fontFamily: 'monospace' }}>{row.id}</td>
                                    <td>{row.type}</td>
                                    <td>{row.location}</td>
                                    <td>{row.time}</td>
                                    <td>{row.severity}</td>
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
