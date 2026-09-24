import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxFileSize },
}).single('file');

export function contractFileUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    next();
    return;
  }
  upload(req, res, next);
}
