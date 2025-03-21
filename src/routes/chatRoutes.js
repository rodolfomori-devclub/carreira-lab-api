// routes/chatRoutes.js
import express from 'express';
import { processChat } from '../controllers/chatController.js';

const router = express.Router();

// Rota para processamento de mensagens de chat
router.post('/chat', processChat);

export default router;