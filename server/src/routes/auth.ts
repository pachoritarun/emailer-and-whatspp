import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth-service.js';
import { logger } from '../services/logger.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const result = await AuthService.login(username, password, ipAddress, userAgent);
    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    logger.error('AUTH_ROUTE_LOGIN_ERR', 'Error in login route: ' + err.message);
    return res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
});

// POST /api/auth/change-credentials
authRouter.post('/change-credentials', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const sessionValidation = AuthService.validateToken(token);

    const { userId, newUsername, newPassword } = req.body;
    const targetUserId = userId || (sessionValidation.valid ? sessionValidation.session?.userId : undefined);

    if (!targetUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required to update credentials' });
    }

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const result = await AuthService.changeCredentials(targetUserId, newUsername, newPassword, ipAddress, userAgent);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    logger.error('AUTH_ROUTE_CHANGE_CREDS_ERR', 'Error changing credentials: ' + err.message);
    return res.status(500).json({ success: false, error: 'Internal server error while changing credentials' });
  }
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const validation = AuthService.validateToken(token);

  if (!validation.valid || !validation.session) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid' });
  }

  return res.json({
    success: true,
    user: validation.session
  });
});

// GET /api/auth/sender-activity (Developer visibility into Sender activity)
authRouter.get('/sender-activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const activities = await AuthService.getSenderActivity(limit);

    return res.json({
      success: true,
      total: activities.length,
      activities
    });
  } catch (err: any) {
    logger.error('AUTH_SENDER_ACTIVITY_ERR', 'Error retrieving sender activity: ' + err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve sender activity logs' });
  }
});
