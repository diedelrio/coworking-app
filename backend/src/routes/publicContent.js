
// backend/src/routes/publicContent.js
const express = require("express");
const prisma = require("../prisma");

const router = express.Router();

// Public: only published items
router.get("/content", async (_req, res) => {
  const rows = await prisma.publicContent.findMany({
    where: { published: true },
    orderBy: [{ key: "asc" }],
    select: { key: true, content: true, updatedAt: true },
  });

  // Return as map {key: content}
  const map = {};
  for (const r of rows) map[r.key] = r.content;
  res.json({ items: rows, map });
});

module.exports = router;
