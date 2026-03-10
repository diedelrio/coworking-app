
// backend/src/routes/adminContracts.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired, requireAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired, requireAdmin);

// List contracts
router.get("/", async (_req, res) => {
  const rows = await prisma.contract.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { user: { select: { id: true, name: true, lastName: true, email: true } }, space: true },
  });
  res.json(rows);
});

// Create contract
router.post("/", async (req, res) => {
  const {
    userId,
    spaceId = null,
    startDate,
    endDate = null,
    billingPeriod = "MONTHLY",
    amount,
    status = "ACTIVE",
  } = req.body || {};

  if (!userId) return res.status(400).json({ message: "userId required" });
  if (!startDate) return res.status(400).json({ message: "startDate required" });
  if (amount === undefined || amount === null) return res.status(400).json({ message: "amount required" });

  const row = await prisma.contract.create({
    data: {
      userId: Number(userId),
      spaceId: spaceId !== null && spaceId !== undefined ? Number(spaceId) : null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      billingPeriod,
      amount,
      status,
    },
  });
  res.json(row);
});

// Update contract
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    spaceId,
    startDate,
    endDate,
    billingPeriod,
    amount,
    status,
  } = req.body || {};

  const row = await prisma.contract.update({
    where: { id },
    data: {
      ...(spaceId !== undefined ? { spaceId: spaceId !== null ? Number(spaceId) : null } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : undefined } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(billingPeriod !== undefined ? { billingPeriod } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });
  res.json(row);
});

// Generate invoice for a contract for a given period (YYYY-MM)
router.post("/:id/invoices/generate", async (req, res) => {
  const contractId = Number(req.params.id);
  const { period } = req.query;

  if (!period || !/^\d{4}-\d{2}$/.test(String(period))) {
    return res.status(400).json({ message: "period=YYYY-MM required" });
  }

  const [y, m] = String(period).split("-").map(Number);
  const periodStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0));

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return res.status(404).json({ message: "Contract not found" });

  const invoice = await prisma.invoice.upsert({
    where: {
      userId_contractId_periodStart_periodEnd: {
        userId: contract.userId,
        contractId: contractId,
        periodStart,
        periodEnd,
      },
    },
    update: {
      amount: contract.amount,
      status: "DRAFT",
    },
    create: {
      userId: contract.userId,
      contractId: contractId,
      periodStart,
      periodEnd,
      amount: contract.amount,
      status: "DRAFT",
    },
  });

  res.json(invoice);
});

module.exports = router;
