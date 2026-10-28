// backend/src/routes/adminOperations.js
// Agrupa las rutas de /api/admin/operations (cada tema vive en routes/operations/).
const express = require('express');

const router = express.Router();

router.use(require('./operations/completion'));
router.use(require('./operations/usersBatch'));
router.use(require('./operations/catalogs'));
router.use(require('./operations/bulkEmail'));
router.use(require('./operations/bulkTokens'));

module.exports = router;
