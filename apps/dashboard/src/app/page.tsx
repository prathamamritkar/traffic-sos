'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

// ── Demo provisioned accounts ────────────────────────────────────
const DEMO_ACCOUNTS: Record<string, { role: string; name: string }> = {
    'admin@rapidrescue.app': { role: 'ADMIN', name: 'Admin User' },
    'responder@rapidrescue.app': { role: 'RESPONDER_ADMIN', name: 'Responder Admin' },
};
// Password fallback only for development; production SHOULD set this env var.
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'rapidrescue2026';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Prevent double-submit if user clicks button twice quickly
    const submittingRef = useRef(false);

    // Redirect already-authenticated users and cleanup theme
    useEffect(() => {
        try {
            const token = localStorage.getItem('rapidrescue_token');
            const userData = localStorage.getItem('rapidrescue_user');
            if (token && userData) {
                // Both session artifacts exist — safe to redirect
                router.replace('/dashboard');
            } else {
                // Clear stale/partial session data
                if (token && !userData) {
                    localStorage.removeItem('rapidrescue_token');
                }
                // Ensure login page always starts in a clean light state
                // to prevent theme leakage from previous sessions
                document.documentElement.removeAttribute('data-theme');
            }
        } catch {
            // localStorage unavailable
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingRef.current) return;

        // Client-side validation before any async work
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail) {
            setError('Email address is required.');
            return;
        }
        if (!password) {
            setError('Password is required.');
            return;
        }

        submittingRef.current = true;
        setLoading(true);
        setError('');

        // Simulated network latency for demo realism
        await new Promise<void>((r) => setTimeout(r, 800));

        const user = DEMO_ACCOUNTS[trimmedEmail];
        if (!user || password !== DEMO_PASSWORD) {
            setError('Invalid credentials. Use one of the provisioned test accounts below.');
            setLoading(false);
            submittingRef.current = false;
            return;
        }

        // Build a structured session payload (base64-encoded JSON — demo only,
        // NOT a real JWT; a production build would call an auth API endpoint).
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            userId: `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            role: user.role,
            name: user.name,
            email: trimmedEmail,
            iat: now,
            exp: now + 7 * 24 * 3600,
        };

        try {
            const token = btoa(JSON.stringify(payload));
            localStorage.setItem('rapidrescue_token', token);
            localStorage.setItem('rapidrescue_user', JSON.stringify(payload));
        } catch {
            setError('Unable to save session. Ensure cookies/storage are not blocked.');
            setLoading(false);
            submittingRef.current = false;
            return;
        }

        router.push('/dashboard');
        // Note: don't reset submittingRef — navigation is in progress
    };

    const fillDemo = (demoEmail: string) => {
        setEmail(demoEmail);
        setPassword(DEMO_PASSWORD);
        setError('');
    };

    return (
        <div className={styles.root}>
            {/* Decorative background */}
            <div className={styles.bg} aria-hidden="true">
                <div className={styles.bgOrb1} />
                <div className={styles.bgOrb2} />
                <div className={styles.bgGrid} />
            </div>

            <div className={styles.content}>
                {/* Left — branding */}
                <aside className={styles.brand} aria-hidden="true">
                    <div className={styles.brandInner}>
                        <div className={styles.brandLogo}>
                            <span className={styles.brandIcon}>+</span>
                        </div>
                        <h1 className={styles.brandTitle}>RapidRescue</h1>
                        <p className={styles.brandTag}>ADGC Command Center</p>

                        <div className={styles.brandFeatures}>
                            {[
                                { icon: 'explore', label: 'Live accident tracking on map' },
                                { icon: 'emergency', label: 'Real-time ambulance dispatch' },
                                { icon: 'traffic', label: 'Green Corridor orchestration' },
                                { icon: 'bolt', label: 'AI-powered scene intelligence' },
                            ].map(({ icon, label }) => (
                                <div key={label} className={styles.brandFeature}>
                                    <span className={`${styles.brandFeatureIcon} material-icons-round`}>{icon}</span>
                                    <span className={styles.brandFeatureLabel}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Right — login card */}
                <main className={styles.formWrapper}>
                    <div className={styles.card} role="main">
                        {/* Card header */}
                        <div className={styles.cardHeader}>
                            <div className={styles.logoMark} aria-hidden="true">
                                <span
                                    className="material-icons-round"
                                    style={{ fontSize: 28, color: 'var(--md-sys-color-primary)' }}
                                >
                                    local_hospital
                                </span>
                            </div>
                            <div>
                                <h2 className={styles.cardTitle}>Sign in</h2>
                                <p className={styles.cardSub}>Command Center access only</p>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className={styles.form} noValidate>
                            {/* Email */}
                            <div className={styles.field}>
                                <label htmlFor="email" className={styles.label}>
                                    Email address
                                </label>
                                <div className={styles.inputWrapper}>
                                    <span className={`material-icons-round ${styles.inputIcon}`}>
                                        mail
                                    </span>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                        className={`md-text-field ${styles.input}`}
                                        placeholder="you@rapidrescue.app"
                                        autoComplete="email"
                                        required
                                        disabled={loading}
                                        aria-describedby={error ? 'login-error' : undefined}
                                        aria-invalid={!!error}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className={styles.field}>
                                <label htmlFor="password" className={styles.label}>
                                    Password
                                </label>
                                <div className={styles.inputWrapper}>
                                    <span className={`material-icons-round ${styles.inputIcon}`}>
                                        lock
                                    </span>
                                    <input
                                        id="password"
                                        type={showPass ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        className={`md-text-field ${styles.input} ${styles.inputWithAction}`}
                                        placeholder="Enter password"
                                        autoComplete="current-password"
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.inputAction}
                                        onClick={() => setShowPass((v) => !v)}
                                        aria-label={showPass ? 'Hide password' : 'Show password'}
                                        tabIndex={0}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 18 }}>
                                            {showPass ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div id="login-error" className={styles.errorBox} role="alert">
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>
                                        error_outline
                                    </span>
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                id="login-btn"
                                type="submit"
                                className={`btn btn-primary ${styles.submitBtn}`}
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? (
                                    <span className={styles.spinner} aria-hidden="true" />
                                ) : (
                                    <span className="material-icons-round" style={{ fontSize: 18 }}>
                                        login
                                    </span>
                                )}
                                {loading ? 'Authenticating…' : 'Sign In'}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className={styles.dividerRow}>
                            <span className={styles.dividerLine} />
                            <span className={styles.dividerText}>Provisioned test accounts</span>
                            <span className={styles.dividerLine} />
                        </div>

                        {/* Demo accounts */}
                        <div className={styles.demoAccounts}>
                            <button
                                id="demo-admin-btn"
                                className={styles.demoAccount}
                                onClick={() => fillDemo('admin@rapidrescue.app')}
                                type="button"
                                disabled={loading}
                            >
                                <div className={styles.demoAccountAvatar} data-role="admin">A</div>
                                <div className={styles.demoAccountInfo}>
                                    <span className={styles.demoAccountName}>Admin User</span>
                                    <span className={styles.demoAccountEmail}>admin@rapidrescue.app</span>
                                </div>
                                <span className="badge badge-red">ADMIN</span>
                            </button>

                            <button
                                id="demo-responder-btn"
                                className={styles.demoAccount}
                                onClick={() => fillDemo('responder@rapidrescue.app')}
                                type="button"
                                disabled={loading}
                            >
                                <div className={styles.demoAccountAvatar} data-role="responder">R</div>
                                <div className={styles.demoAccountInfo}>
                                    <span className={styles.demoAccountName}>Responder Admin</span>
                                    <span className={styles.demoAccountEmail}>responder@rapidrescue.app</span>
                                </div>
                                <span className="badge badge-blue">RESPONDER</span>
                            </button>
                        </div>

                        <p className={styles.passwordHint}>
                            Shared demo password:{' '}
                            <code className={styles.code}>{DEMO_PASSWORD}</code>
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
