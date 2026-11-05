import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/index.js';
import { generateToken, authMiddleware, AuthenticatedRequest } from '../auth/jwt.js';

export const authRouter = Router();

// Registration
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, confirmPassword, selectedCharacter, characterColor } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match' });
      return;
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      return;
    }

    // Check if user already exists
    const existing = await db.findUserByUsername(trimmedUsername);
    if (existing) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const userId = `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const user = await db.createUser({
      id: userId,
      username: trimmedUsername,
      password_hash,
      selected_character: selectedCharacter || 'ranger',
      character_color: characterColor || '#2e7d32'
    });

    const token = generateToken({ userId: user.id, username: user.username });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        profile: user.profile,
        statistics: user.statistics
      }
    });
  } catch (err: any) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const trimmedUsername = username.trim();
    const user = await db.findUserByUsername(trimmedUsername);

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = generateToken({ userId: user.id, username: user.username });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        profile: user.profile,
        statistics: user.statistics
      }
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Current User Profile
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      profile: user.profile,
      statistics: user.statistics
    });
  } catch (err: any) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

