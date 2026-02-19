import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

export const broadcastRouter = Router();

// Storage strategy: Local for now (to avoid external deps), structure follows R2/Supabase
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { accidentId } = req.params;
        const dir = path.join(UPLOAD_DIR, accidentId);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const chunkIndex = req.body.chunkIndex ?? '0';
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}_${chunkIndex}${ext}`);
    }
});

const upload = multer({ storage });

// ── POST /api/broadcast/:accidentId/upload ───────────────────
// Accepts multipart/form-data with 'video' and 'audio'
broadcastRouter.post('/:accidentId/upload', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), (req: Request, res: Response) => {
    const { accidentId } = req.params;
    const { chunkIndex, timestamp } = req.body;

    console.log(`[detection-service] Media chunk ${chunkIndex} received for ${accidentId}`);

    res.status(201).json({
        payload: {
            accidentId,
            chunkIndex,
            status: 'UPLOADED',
            url: `/api/broadcast/${accidentId}/stream/${chunkIndex}`
        }
    });
});

// ── GET /api/broadcast/:accidentId/stream/:chunkIndex ────────
// JWT-gated access to media chunks
broadcastRouter.get('/:accidentId/stream/:chunkIndex', (req: Request, res: Response) => {
    const { accidentId, chunkIndex } = req.params;
    const token = req.query.token as string;

    // JWT Validation
    const JWT_SECRET = process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod';
    try {
        if (!token) throw new Error('Missing token');
        jwt.verify(token, JWT_SECRET);
    } catch (e) {
        res.status(401).json({ error: 'Unauthorized media access' });
        return;
    }

    // Serve the video file (prioritize video)
    const filePath = path.join(UPLOAD_DIR, accidentId, `video_${chunkIndex}.mp4`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        // Try audio
        const audioPath = path.join(UPLOAD_DIR, accidentId, `audio_${chunkIndex}.m4a`);
        if (fs.existsSync(audioPath)) {
            res.sendFile(audioPath);
        } else {
            res.status(404).json({ error: 'Chunk not found' });
        }
    }
});

/**
 * Generate a time-limited shareable URL for emergency contacts
 */
export function generateSignedStreamUrl(accidentId: string): string {
    const JWT_SECRET = process.env.JWT_SECRET ?? 'rescuedge-dev-secret-change-in-prod';
    const token = jwt.sign({ accidentId, purpose: 'emergency_broadcast' }, JWT_SECRET, { expiresIn: '2h' });
    const baseUrl = process.env.PUBLIC_URL ?? 'http://localhost:3001';
    return `${baseUrl}/api/broadcast/${accidentId}/stream/0?token=${token}`; // Points to first chunk as entry
}
