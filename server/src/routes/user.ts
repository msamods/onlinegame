import { Router, Response } from 'express';
import { db } from '../database/index.js';
import { authMiddleware, AuthenticatedRequest } from '../auth/jwt.js';

export const userRouter = Router();

// Update Character Customization
userRouter.post('/character', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { selectedCharacter, characterColor } = req.body;
    const userId = req.user!.userId;

    const updated = await db.updateProfile(userId, {
      selected_character: selectedCharacter,
      character_color: characterColor
    });

    res.json({ message: 'Character updated successfully', profile: updated });
  } catch (err: any) {
    console.error('[User] Update character failed:', err);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// Global Leaderboard
userRouter.get('/leaderboard', async (_req, res: Response) => {
  try {
    const leaderboard = await db.getLeaderboard(25);
    res.json(leaderboard);
  } catch (err: any) {
    console.error('[User] Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

