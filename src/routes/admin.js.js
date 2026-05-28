import express from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// =====================
// APPROVE ITEMS
// =====================

router.patch('/items/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        adminApproved: true,
        approvedAt: new Date(),
      },
    });

    res.json({
      message: 'Item approved',
      item,
    });
  } catch (error) {
    console.error('Approve item error:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

// =====================
// REJECT ITEM
// =====================

router.patch('/items/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        rejectionReason: req.body.reason,
      },
    });

    res.json({
      message: 'Item rejected',
      item,
    });
  } catch (error) {
    console.error('Reject item error:', error);
    res.status(500).json({ error: 'Failed to reject item' });
  }
});

// =====================
// VERIFY JEWELRY
// =====================

router.patch('/jewelry/:id/verify', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const jewelry = await prisma.jewelry.update({
      where: { id: req.params.id },
      data: {
        status: 'verified',
        verifiedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({
      message: 'Jewelry verified',
      jewelry,
    });
  } catch (error) {
    console.error('Verify jewelry error:', error);
    res.status(500).json({ error: 'Failed to verify jewelry' });
  }
});

// =====================
// GET PENDING ITEMS
// =====================

router.get('/items/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      where: {
        adminApproved: false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(items);
  } catch (error) {
    console.error('Get pending items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// =====================
// GET PENDING JEWELRY
// =====================

router.get('/jewelry/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const jewelry = await prisma.jewelry.findMany({
      where: {
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(jewelry);
  } catch (error) {
    console.error('Get pending jewelry error:', error);
    res.status(500).json({ error: 'Failed to get jewelry' });
  }
});

// =====================
// GET STATS
// =====================

router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalItems = await prisma.item.count();
    const totalJewelry = await prisma.jewelry.count({
      where: { status: 'verified' },
    });
    const totalSettlements = await prisma.settlement.count({
      where: { status: 'completed' },
    });
    const totalVolume = await prisma.settlement.aggregate({
      where: { status: 'completed' },
      _sum: {
        amount: true,
      },
    });

    res.json({
      totalUsers,
      totalItems,
      totalJewelry,
      totalSettlements,
      totalVolume: totalVolume._sum.amount || 0,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
