import express from 'express';
import scraperRoutes from './scraperRoutes.js';

const router = express.Router();

// Prefixar todas as rotas com /api
router.use('/api', scraperRoutes);

export default router;