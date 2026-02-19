// ============================================================
// JWT Auth Middleware — validates RCTF envelope auth block
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RCTFAuth, Role } from '../../../../shared/models/rctf';

const JWT_SECRET = process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod';

export interface AuthenticatedRequest extends Request {
    rctfAuth?: RCTFAuth;
}

export function authMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    // Accept token from Authorization header OR from RCTF body envelope
    const headerToken = req.headers.authorization?.replace('Bearer ', '');
    const bodyToken = (req.body as { auth?: RCTFAuth })?.auth?.token;
    const token = headerToken ?? bodyToken;

    if (!token) {
        res.status(401).json({ error: 'Missing authentication token' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as RCTFAuth;
        req.rctfAuth = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
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
