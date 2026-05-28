import express from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// =====================
// GET USER PROFILE
// =====================

router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        city: true,
        rating: true,
        totalReviews: true,
        soldCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// =====================
// UPDATE PROFILE
// =====================

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.params.id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        profileImage: req.body.profileImage,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        profileImage: true,
      },
    });

    res.json({
      message: 'Profile updated',
      user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =====================
// GET USER ITEMS
// =====================

router.get('/:id/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      where: { userId: req.params.id },
      include: {
        offers: {
          select: { id: true, amount: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  } catch (error) {
    console.error('Get user items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

export default router;
