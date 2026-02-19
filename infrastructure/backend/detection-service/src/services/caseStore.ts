// ============================================================
// In-memory case store (replace with Turso/SQLite in production)
// ============================================================
import type { CaseRecord } from '../../../../shared/models/rctf';

// Simple in-memory Map — survives restarts if using Redis in prod
export const caseStore = new Map<string, CaseRecord>();

// Cleanup resolved/cancelled cases older than 24h
setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, record] of caseStore.entries()) {
        if (
            (record.status === 'RESOLVED' || record.status === 'CANCELLED') &&
            new Date(record.createdAt).getTime() < cutoff
        ) {
            caseStore.delete(id);
        }
    }
}, 60 * 60 * 1000); // every hour
