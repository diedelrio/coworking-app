
// backend/src/routes/adminInvoices.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired, requireAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired, requireAdmin);

router.get("/", async (_req, res) => {
  const rows = await prisma.invoice.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { user: { select: { id: true, name: true, lastName: true, email: true } }, contract: true },
  });
  res.json(rows);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const row = await prisma.invoice.update({ where: { id }, data: { ...(status ? { status } : {}) } });
  res.json(row);
});

module.exports = router;
