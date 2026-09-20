import { Request, Response, NextFunction } from 'express';

/**
 * Middleware protecting scheduled cron triggers.
 * Checks Bearer token or x-cron-secret header against CRON_SECRET.
 */
export function requireCronAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredSecret = process.env.CRON_SECRET || 'cron-secret-ine-2026';

  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-cron-secret'];

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === 'string') {
    token = customHeader.trim();
  }

  if (!token || token !== configuredSecret) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid CRON_SECRET authentication token.'
    });
    return;
  }

  next();
}
