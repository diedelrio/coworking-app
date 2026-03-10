
// backend/src/routes/meNotifications.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired);

router.get("/", async (req, res) => {
  const userId = Number(req.user.id);
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
  res.json(rows);
});

router.post("/:id/seen", async (req, res) => {
  const userId = Number(req.user.id);
  const id = Number(req.params.id);
  const row = await prisma.notification.updateMany({
    where: { id, userId, seenAt: null },
    data: { seenAt: new Date() },
  });
  res.json({ ok: true, updated: row.count });
});

module.exports = router;
