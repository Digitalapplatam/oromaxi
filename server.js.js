import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './src/db/prisma.js';
import authRoutes from './src/routes/auth.js';
import itemsRoutes from './src/routes/items.js';
import offersRoutes from './src/routes/offers.js';
import usersRoutes from './src/routes/users.js';
import adminRoutes from './src/routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// =====================
// MIDDLEWARE
// =====================

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// HEALTH CHECK
// =====================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// =====================
// ROUTES
// =====================

app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

// =====================
// ERROR HANDLER
// =====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: err.status || 500,
  });
});

// =====================
// 404 HANDLER
// =====================

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// =====================
// START SERVER
// =====================

async function start() {
  try {
    // Test DB connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
