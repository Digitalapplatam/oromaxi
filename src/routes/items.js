import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// =====================
// CREATE ITEM
// =====================

const createItemSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  category: z.string(),
  material: z.string(),
  purity: z.string().optional(),
  weight: z.number().positive(),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string(),
  year: z.string().optional(),
  expectedPrice: z.number().positive(),
  minAcceptable: z.number().positive().optional(),
  saleType: z.enum(['definitive', 'buyback', 'auction']),
  buybackMonthly: z.number().optional(),
  buybackMaxMonths: z.number().optional(),
  city: z.string(),
  images: z.array(z.string()).optional(),
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = createItemSchema.parse(req.body);

    const item = await prisma.item.create({
      data: {
        ...data,
        userId: req.user.userId,
        images: data.images || [],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Item created successfully',
      item,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// =====================
// GET ALL ITEMS (with visibility filters)
// =====================

router.get('/', async (req, res) => {
  try {
    const { category, material, city, saleType, minPrice, maxPrice, page = 1 } = req.query;
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    let where = {
      status: 'active',
      adminApproved: true,
    };

    // CRITICAL: Visibility logic
    // For 'buyback' items, only show to jewelry users
    const userRole = req.headers['x-user-role'] || 'user';

    if (userRole !== 'jewelry' && userRole !== 'admin') {
      // Normal users can only see 'definitive' and 'auction' items
      where.saleType = {
        in: ['definitive', 'auction'],
      };
    }

    if (category) where.category = category;
    if (material) where.material = material;
    if (city) where.city = city;
    if (saleType && (userRole === 'jewelry' || userRole === 'admin')) {
      where.saleType = saleType;
    }

    if (minPrice || maxPrice) {
      where.expectedPrice = {};
      if (minPrice) where.expectedPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.expectedPrice.lte = parseFloat(maxPrice);
    }

    const items = await prisma.item.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
            city: true,
          },
        },
        offers: {
          select: { id: true, amount: true },
        },
      },
    });

    const total = await prisma.item.count({ where });

    res.json({
      items,
      pagination: {
        total,
        pages: Math.ceil(total / pageSize),
        currentPage: parseInt(page),
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// =====================
// GET SINGLE ITEM
// =====================

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
            city: true,
          },
        },
        offers: {
          where: { status: 'pending' },
          select: {
            id: true,
            amount: true,
            maker: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Increment views
    await prisma.item.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
    });

    res.json(item);
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

// =====================
// UPDATE ITEM (seller only)
// =====================

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedItem = await prisma.item.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({
      message: 'Item updated successfully',
      item: updatedItem,
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// =====================
// DELETE ITEM (seller only)
// =====================

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.item.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
