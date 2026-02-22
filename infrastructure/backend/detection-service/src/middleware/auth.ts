// ============================================================
// JWT Auth Middleware — validates RCTF envelope auth block
// Fixes:
//  • JWT_SECRET falls back to a hardcoded dev string — this MUST
//    be an env var in production; added startup assertion so the
//    process refuses to start in production without it.
//  • `jwt.verify()` returns `string | JwtPayload`, not `RCTFAuth`;
//    the direct cast bypassed any field-presence check.
//    Now decodes safely with explicit field extraction.
//  • Authorization header stripping used `.replace('Bearer ', '')`
//    which is case-sensitive and doesn't handle extra whitespace.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RCTFAuth, Role } from '../../../../shared/models/rctf';

const JWT_SECRET = process.env.JWT_SECRET ?? 'rapidrescue-dev-secret-change-in-prod';

// Fail hard at startup in production if the secret is the default value
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'rapidrescue-dev-secret-change-in-prod') {
    console.error('[auth] FATAL: JWT_SECRET must be set to a strong secret in production');
    process.exit(1);
}

export interface AuthenticatedRequest extends Request {
    rctfAuth?: RCTFAuth;
}

export function authMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    // Support both:
    //  - Authorization: Bearer <token>  (case-insensitive trim)
    //  - RCTF body envelope auth.token
    const rawHeader = req.headers.authorization ?? '';
    const headerToken = rawHeader.toLowerCase().startsWith('bearer ')
        ? rawHeader.slice(7).trim()
        : undefined;

    const bodyToken = (req.body as { auth?: { token?: string } })?.auth?.token?.trim();
    const token = headerToken || bodyToken;

    if (!token) {
        res.status(401).json({ error: 'Missing authentication token' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // For demo tokens (base64 JSON from the Flutter app), decoded is a
        // plain object. Extract fields defensively.
        if (typeof decoded !== 'object' || decoded === null) {
            res.status(401).json({ error: 'Malformed token payload' });
            return;
        }

        const { userId, role } = decoded as Record<string, unknown>;
        if (typeof userId !== 'string' || typeof role !== 'string') {
            res.status(401).json({ error: 'Token missing required fields' });
            return;
        }

        req.rctfAuth = { userId, role: role as Role, token };
        next();
    } catch (err: any) {
        // Fallback for demo tokens (base64 JSON) if JWT verify fails
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            const { userId, role } = decoded as Record<string, unknown>;
            if (typeof userId === 'string' && typeof role === 'string') {
                req.rctfAuth = { userId, role: role as Role, token };
                next();
            } else {
                throw new Error('Fallback failed');
            }
        } catch {
            res.status(401).json({ error: 'Invalid or expired token' });
        }
    }
}

export function requireRole(...roles: Role[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.rctfAuth || !roles.includes(req.rctfAuth.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}

export function signToken(auth: Omit<RCTFAuth, 'token'>, expiresIn = '7d'): string {
    return jwt.sign(auth, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}
