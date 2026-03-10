
// backend/src/routes/meMessages.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired);

async function getOrCreateConversation(userId) {
  const existing = await prisma.conversation.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { userId } });
}

// list conversations (for now: single per user)
router.get("/conversations", async (req, res) => {
  const userId = Number(req.user.id);
  const conv = await getOrCreateConversation(userId);
  const last = await prisma.message.findFirst({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "desc" },
    select: { body: true, createdAt: true, senderRole: true },
  });
  res.json([{ ...conv, lastMessage: last }]);
});

// list messages
router.get("/conversations/:id/messages", async (req, res) => {
  const userId = Number(req.user.id);
  const convId = Number(req.params.id);

  const conv = await prisma.conversation.findFirst({ where: { id: convId, userId } });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });

  const messages = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
  });

  // Mark as read for CLIENT messages? Here: mark ADMIN messages as read when user opens
  await prisma.message.updateMany({
    where: { conversationId: convId, senderRole: "ADMIN", readAt: null },
    data: { readAt: new Date() },
  });

  res.json(messages);
});

// post message
router.post("/conversations/:id/messages", async (req, res) => {
  const userId = Number(req.user.id);
  const convId = Number(req.params.id);
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ message: "body required" });

  const conv = await prisma.conversation.findFirst({ where: { id: convId, userId } });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });

  const msg = await prisma.message.create({
    data: { conversationId: convId, senderRole: "CLIENT", body: String(body) },
  });

  // notification for user (optional) - for now notify admin via existing email infra in later iteration.
  res.json(msg);
});

module.exports = router;
