'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Seed users
    const INITIAL_USERS: Record<string, { role: string; name: string }> = {
        'admin@rescuedge.app': { role: 'ADMIN', name: 'Admin User' },
        'responder@rescuedge.app': { role: 'RESPONDER_ADMIN', name: 'Responder Admin' },
    };

    useEffect(() => {
        const token = localStorage.getItem('rescuedge_token');
        if (token) router.push('/dashboard');
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        await new Promise((r) => setTimeout(r, 800)); // simulate auth

        const user = INITIAL_USERS[email];
        if (!user || password !== 'rescuedge2026') {
            setError('Invalid credentials. Use official testing accounts.');
            setLoading(false);
            return;
        }

        // Build RCTF JWT payload (demo — in prod, backend signs this)
        const payload = {
            userId: `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            role: user.role,
            name: user.name,
            email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        };

        // For demo: store as base64 (real app: backend JWT)
        const token = btoa(JSON.stringify(payload));
        localStorage.setItem('rescuedge_token', token);
        localStorage.setItem('rescuedge_user', JSON.stringify(payload));
        router.push('/dashboard');
    };

    return (
        <div className={styles.container}>
            <div className={styles.bg} />
            <div className={styles.card}>
                <div className={styles.logo}>
                    <div className={styles.logoIcon}>🚑</div>
                    <div>
                        <h1 className={styles.logoTitle}>RescuEdge</h1>
                        <p className={styles.logoSub}>ADGC Command Center</p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.field}>
                        <label className={styles.label}>Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                            placeholder="admin@rescuedge.app"
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            placeholder="••••••••••"
                            required
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button id="login-btn" type="submit" className={styles.btn} disabled={loading}>
                        {loading ? <span className={styles.spinner} /> : null}
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div className={styles.demo}>
                    <p className={styles.demoTitle}>Provisioned Testing Accounts (password: rescuedge2026)</p>
                    <div className={styles.demoList}>
                        <button className={styles.demoBtn} onClick={() => setEmail('admin@rescuedge.app')}>
                            👤 admin@rescuedge.app — ADMIN
                        </button>
                        <button className={styles.demoBtn} onClick={() => setEmail('responder@rescuedge.app')}>
                            🚑 responder@rescuedge.app — RESPONDER_ADMIN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
