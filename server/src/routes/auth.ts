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

// GET /api/auth/users - List all portal user profiles
authRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await AuthService.getUsers();
    return res.json({ success: true, users });
  } catch (err: any) {
    logger.error('AUTH_GET_USERS_ERR', 'Error fetching users: ' + err.message);
    return res.status(500).json({ success: false, error: 'Failed to load user profiles' });
  }
});

// POST /api/auth/users - Create a new user profile
authRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const validation = AuthService.validateToken(token);

    const result = await AuthService.createUser(req.body, validation.session?.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(201).json(result);
  } catch (err: any) {
    logger.error('AUTH_CREATE_USER_ERR', 'Error creating user: ' + err.message);
    return res.status(500).json({ success: false, error: 'Failed to create user profile' });
  }
});

// DELETE /api/auth/users/:id - Delete a user profile
authRouter.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const validation = AuthService.validateToken(token);

    const result = await AuthService.deleteUser(req.params.id, validation.session?.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    logger.error('AUTH_DELETE_USER_ERR', 'Error deleting user: ' + err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete user profile' });
  }
});

// PATCH /api/auth/users/:id/status - Toggle user active status
authRouter.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const validation = AuthService.validateToken(token);
    const { isActive } = req.body;

    const result = await AuthService.toggleUserStatus(req.params.id, Boolean(isActive), validation.session?.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    logger.error('AUTH_TOGGLE_USER_ERR', 'Error toggling user status: ' + err.message);
    return res.status(500).json({ success: false, error: 'Failed to update user status' });
  }
});
