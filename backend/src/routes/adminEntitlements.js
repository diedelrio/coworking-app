
// backend/src/routes/adminEntitlements.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired, requireAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired, requireAdmin);

// Grant entitlement manually (MVP)
router.post("/grant", async (req, res) => {
  const { userId, type = "HOURS_PACK", initialAmount, validFrom = null, validTo = null } = req.body || {};
  const uid = Number(userId);
  const init = Number(initialAmount);

  if (!uid || !Number.isFinite(uid)) return res.status(400).json({ message: "userId required" });
  if (!Number.isFinite(init) || init <= 0) return res.status(400).json({ message: "initialAmount must be > 0" });

  const row = await prisma.userEntitlement.create({
    data: {
      userId: uid,
      type,
      initialAmount: init,
      remainingAmount: init,
      unit: "HOUR",
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
    },
  });
  res.json(row);
});

router.get("/user/:userId", async (req, res) => {
  const uid = Number(req.params.userId);
  const rows = await prisma.userEntitlement.findMany({
    where: { userId: uid },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  res.json(rows);
});

module.exports = router;
