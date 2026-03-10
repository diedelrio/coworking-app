
// backend/src/routes/adminPricing.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired, requireAdmin } = require("../middlewares/auth");

const router = express.Router();

// all admin routes
router.use(authRequired, requireAdmin);

// GET lists
router.get("/lists", async (_req, res) => {
  const rows = await prisma.priceList.findMany({
    orderBy: [{ priority: "desc" }, { id: "desc" }],
    include: { items: true, targetTags: { include: { tag: true } } },
  });
  res.json(rows);
});

// POST list
router.post("/lists", async (req, res) => {
  const { name, priority = 0, active = true, validFrom = null, validTo = null, tagIds = [] } = req.body || {};
  if (!name) return res.status(400).json({ message: "name required" });

  const row = await prisma.priceList.create({
    data: {
      name: String(name),
      priority: Number(priority) || 0,
      active: Boolean(active),
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      ...(Array.isArray(tagIds) && tagIds.length
        ? { targetTags: { createMany: { data: tagIds.map((id) => ({ tagId: Number(id) })) } } }
        : {}),
    },
  });
  res.json(row);
});

// PUT list
router.put("/lists/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, priority, active, validFrom, validTo } = req.body || {};

  const row = await prisma.priceList.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(priority !== undefined ? { priority: Number(priority) || 0 } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
      ...(validFrom !== undefined ? { validFrom: validFrom ? new Date(validFrom) : null } : {}),
      ...(validTo !== undefined ? { validTo: validTo ? new Date(validTo) : null } : {}),
    },
  });
  res.json(row);
});

// PUT list tags (segmentación)
router.put("/lists/:id/tags", async (req, res) => {
  const priceListId = Number(req.params.id);
  const { tagIds = [] } = req.body || {};
  if (!Array.isArray(tagIds)) return res.status(400).json({ message: "tagIds must be an array" });

  // Reemplazo total (simple y consistente)
  await prisma.priceListTargetTag.deleteMany({ where: { priceListId } });
  if (tagIds.length) {
    await prisma.priceListTargetTag.createMany({
      data: tagIds.map((id) => ({ priceListId, tagId: Number(id) })),
      skipDuplicates: true,
    });
  }

  const row = await prisma.priceList.findUnique({
    where: { id: priceListId },
    include: { items: true, targetTags: { include: { tag: true } } },
  });

  res.json(row);
});

// POST item in list
router.post("/lists/:id/items", async (req, res) => {
  const priceListId = Number(req.params.id);
  const { scope, spaceType = null, spaceId = null, unit = "HOUR", price } = req.body || {};
  if (!scope) return res.status(400).json({ message: "scope required" });
  if (price === undefined || price === null) return res.status(400).json({ message: "price required" });

  const row = await prisma.priceItem.create({
    data: {
      priceListId,
      scope,
      spaceType,
      spaceId: spaceId !== null && spaceId !== undefined ? Number(spaceId) : null,
      unit,
      price,
    },
  });
  res.json(row);
});

// PUT item
router.put("/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { scope, spaceType, spaceId, unit, price } = req.body || {};

  const row = await prisma.priceItem.update({
    where: { id },
    data: {
      ...(scope !== undefined ? { scope } : {}),
      ...(spaceType !== undefined ? { spaceType } : {}),
      ...(spaceId !== undefined ? { spaceId: spaceId !== null ? Number(spaceId) : null } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(price !== undefined ? { price } : {}),
    },
  });
  res.json(row);
});

// DELETE item
router.delete("/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.priceItem.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
