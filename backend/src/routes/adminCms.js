
// backend/src/routes/adminCms.js
const express = require("express");
const prisma = require("../prisma");
const { authRequired, requireAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired, requireAdmin);

// list all
router.get("/", async (_req, res) => {
  const rows = await prisma.publicContent.findMany({ orderBy: [{ key: "asc" }] });
  res.json(rows);
});

// upsert by key
router.put("/:key", async (req, res) => {
  const key = String(req.params.key);
  const { content = "", published } = req.body || {};

  const row = await prisma.publicContent.upsert({
    where: { key },
    update: {
      content: String(content),
      ...(published !== undefined ? { published: Boolean(published) } : {}),
    },
    create: {
      key,
      content: String(content),
      published: Boolean(published ?? false),
    },
  });

  res.json(row);
});

module.exports = router;
