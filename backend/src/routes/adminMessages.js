
// backend/src/routes/adminMessages.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired, requireAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired, requireAdmin);

// list conversations with user info
router.get("/conversations", async (_req, res) => {
  const rows = await prisma.conversation.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, lastName: true, email: true } },
    },
  });
  res.json(rows);
});

router.get("/conversations/:id/messages", async (req, res) => {
  const convId = Number(req.params.id);
  const conv = await prisma.conversation.findUnique({ where: { id: convId } });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });

  const messages = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
  });

  // Mark CLIENT messages as read when admin opens
  await prisma.message.updateMany({
    where: { conversationId: convId, senderRole: "CLIENT", readAt: null },
    data: { readAt: new Date() },
  });

  res.json(messages);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const convId = Number(req.params.id);
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ message: "body required" });

  const conv = await prisma.conversation.findUnique({ where: { id: convId } });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });

  const msg = await prisma.message.create({
    data: { conversationId: convId, senderRole: "ADMIN", body: String(body) },
  });

  // Create notification for user
  await prisma.notification.create({
    data: {
      userId: conv.userId,
      type: "NEW_MESSAGE",
      payload: JSON.stringify({ conversationId: convId, messageId: msg.id }),
    },
  });

  res.json(msg);
});

module.exports = router;
