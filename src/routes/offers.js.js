import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authMiddleware, jewelryMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// =====================
// CREATE OFFER
// =====================

const createOfferSchema = z.object({
  itemId: z.string(),
  amount: z.number().positive(),
  message: z.string().optional(),
});

router.post('/', authMiddleware, jewelryMiddleware, async (req, res) => {
  try {
    const data = createOfferSchema.parse(req.body);

    // Get item
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot offer on own item' });
    }

    // Check if jewelry can access this sale type
    if (item.saleType === 'buyback') {
      // Only jewelry can offer on buyback
      if (req.user.role !== 'jewelry' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Cannot offer on this item type' });
      }
    }

    // Create offer (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const offer = await prisma.offer.create({
      data: {
        itemId: data.itemId,
        makerId: req.user.userId,
        receiverId: item.userId,
        amount: data.amount,
        message: data.message,
        expiresAt,
      },
      include: {
        maker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
          },
        },
        item: {
          select: {
            id: true,
            title: true,
            expectedPrice: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Offer created successfully',
      offer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create offer error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// =====================
// GET OFFERS FOR ITEM
// =====================

router.get('/item/:itemId', authMiddleware, async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const offers = await prisma.offer.findMany({
      where: { itemId: req.params.itemId },
      include: {
        maker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(offers);
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ error: 'Failed to get offers' });
  }
});

// =====================
// ACCEPT OFFER
// =====================

router.patch('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        item: true,
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.receiverId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer cannot be accepted' });
    }

    // Create settlement
    const settlement = await prisma.settlement.create({
      data: {
        offerId: offer.id,
        itemId: offer.itemId,
        sellerId: offer.receiverId,
        buyerId: offer.makerId,
        amount: offer.amount,
        platformFee: offer.amount * 0.08,
        sellerReceives: offer.amount * 0.92,
        isBuyback: offer.item.saleType === 'buyback',
        buybackRate: offer.item.buybackMonthly,
        buybackDueDate: offer.item.buybackMaxMonths
          ? new Date(Date.now() + offer.item.buybackMaxMonths * 30 * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    // Update offer status
    await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    // Update item status
    await prisma.item.update({
      where: { id: offer.itemId },
      data: { status: 'pending' },
    });

    res.json({
      message: 'Offer accepted',
      settlement,
    });
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// =====================
// REJECT OFFER
// =====================

router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.receiverId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: req.body.reason || 'Rejected by seller',
      },
    });

    res.json({
      message: 'Offer rejected',
      offer: updatedOffer,
    });
  } catch (error) {
    console.error('Reject offer error:', error);
    res.status(500).json({ error: 'Failed to reject offer' });
  }
});

export default router;
