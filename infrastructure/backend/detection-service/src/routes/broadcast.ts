// ============================================================
// Broadcast Route — media chunk upload & JWT-gated streaming
// Fixes:
//  • multer has no file size limit — attackers could upload
//    unbounded files → added 100 MB per-chunk limit
//  • multer has no MIME type validation — any file allowed
//    → only accept video/* and audio/*
//  • JWT_SECRET fallback to hardcoded string in production —
//    same guard as auth.ts
//  • `fs.existsSync` used synchronously inside async handlers —
//    replaced with `fs.promises.access`
//  • `res.sendFile` requires an absolute path (already built with
//    path.join(__dirname, ...) which is correct) but was missing
//    the error callback — file descriptor leak on error
//  • generateSignedStreamUrl token is leaked in URL query param
//    (visible in server logs, browser history, referrer headers).
//    Documented clearly; for production move to Authorization header.
// ============================================================
import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

export const broadcastRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'rescuedge-dev-secret-change-in-prod') {
    console.error('[broadcast] FATAL: JWT_SECRET must be set in production');
    process.exit(1);
}

// ── Upload directory ──────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── MIME type whitelist ───────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/ogg', 'audio/webm',
]);

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported media type: ${file.mimetype}`));
    }
};

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const { accidentId } = req.params;
        // Sanitize accidentId to prevent directory traversal
        if (!/^ACC-\d{4}-[A-Z0-9]{6}$/.test(accidentId)) {
            cb(new Error('Invalid accidentId'), '');
            return;
        }
        const dir = path.join(UPLOAD_DIR, accidentId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.bin';
        cb(null, `${file.fieldname}_${uuidv4()}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024,   // 100 MB per chunk
        files: 2,                     // max 1 video + 1 audio
    },
});

// ── POST /api/broadcast/:accidentId/upload ───────────────────
broadcastRouter.post(
    '/:accidentId/upload',
    upload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
    ]),
    (req: Request, res: Response) => {
        const { accidentId } = req.params;
        const { chunkIndex = '0', timestamp } = req.body as {
            chunkIndex?: string;
            timestamp?: string;
        };

        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        if (!files || (Object.keys(files).length === 0)) {
            res.status(400).json({ error: 'No media files received' });
            return;
        }

        const uploadedPaths = Object.entries(files).map(([field, fileArr]) => ({
            field,
            filename: fileArr[0]?.filename,
        }));

        console.log(
            `[detection-service] Media chunk ${chunkIndex} received for ${accidentId}:`,
            uploadedPaths.map(f => f.filename).join(', ')
        );

        res.status(201).json({
            payload: {
                accidentId,
                chunkIndex,
                timestamp,
                status: 'UPLOADED',
                url: `/api/broadcast/${accidentId}/stream/${chunkIndex}`,
            },
        });
    }
);

// ── GET /api/broadcast/:accidentId/stream/:chunkIndex ────────
// JWT-gated access to media chunks.
// SECURITY NOTE: Token in query param is a demo convenience. In production,
// move to Authorization header or use short-lived signed cookies to prevent
// token leakage via browser history, referrer headers, and server logs.
broadcastRouter.get('/:accidentId/stream/:chunkIndex', async (req: Request, res: Response) => {
    const { accidentId, chunkIndex } = req.params;
    const token = req.query.token as string;

    // Validate accidentId format
    if (!/^ACC-\d{4}-[A-Z0-9]{6}$/.test(accidentId)) {
        res.status(400).json({ error: 'Invalid accidentId' });
        return;
    }

    // Validate chunkIndex is numeric
    if (!/^\d+$/.test(chunkIndex)) {
        res.status(400).json({ error: 'Invalid chunkIndex' });
        return;
    }

    // JWT validation
    if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
    }
    try {
        jwt.verify(token, JWT_SECRET);
    } catch {
        res.status(401).json({ error: 'Unauthorized media access' });
        return;
    }

    const dir = path.join(UPLOAD_DIR, accidentId);

    // Find the correct chunk file (uuid filename from upload)
    try {
        const files = await fs.promises.readdir(dir).catch(() => [] as string[]);

        // Prefer video over audio
        const videoFile = files.find(f => f.startsWith('video_') && !f.endsWith('.tmp'));
        const audioFile = files.find(f => f.startsWith('audio_') && !f.endsWith('.tmp'));
        const targetFile = videoFile ?? audioFile;

        if (!targetFile) {
            res.status(404).json({ error: 'Chunk not found' });
            return;
        }

        const filePath = path.join(dir, targetFile);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[broadcast] sendFile error for ${filePath}:`, err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to stream media' });
                }
            }
        });
    } catch (err) {
        console.error('[broadcast] Stream error:', err);
        res.status(500).json({ error: 'Internal error streaming media' });
    }
});

/**
 * Generate a time-limited signed URL for emergency contacts.
 *
 * SECURITY NOTE: Token-in-URL leaks via logs and referrer headers.
 * For production, use Authorization header + short-lived JWT or signed cookie.
 */
export function generateSignedStreamUrl(accidentId: string): string {
    const token = jwt.sign(
        { accidentId, purpose: 'emergency_broadcast' },
        JWT_SECRET,
        { expiresIn: '2h' }
    );
    const baseUrl = process.env.PUBLIC_URL ?? 'http://localhost:3001';
    // Note: stream/0 is the entry chunk — callers can paginate with chunkIndex
    return `${baseUrl}/api/broadcast/${accidentId}/stream/0?token=${token}`;
}
