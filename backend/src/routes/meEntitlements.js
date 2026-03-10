
// backend/src/routes/meEntitlements.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired);

router.get("/", async (req, res) => {
  const userId = Number(req.user.id);
  const now = new Date();

  const rows = await prisma.userEntitlement.findMany({
    where: {
      userId,
      remainingAmount: { gt: 0 },
      OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      AND: [{ OR: [{ validTo: null }, { validTo: { gte: now } }] }],
    },
    orderBy: [{ validTo: "asc" }, { id: "asc" }],
  });

  res.json(rows);
});

module.exports = router;
