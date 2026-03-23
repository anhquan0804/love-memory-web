const express = require('express');

const router = express.Router();

// GET /api/config
// Returns public configuration values safe to expose to the frontend
router.get('/', (_req, res) => {
  res.json({
    name1:            process.env.NAME_1             || 'Bạn',
    name2:            process.env.NAME_2             || 'Người yêu',
    anniversaryDate:  process.env.ANNIVERSARY_DATE   || '',
  });
});

module.exports = router;
