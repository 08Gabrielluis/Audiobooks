const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Types: { ObjectId } } = require('mongoose');

// Usamos memoryStorage e depois gravamos no GridFSBucket
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/upload (campo 'files' multipart, pode enviar vários)
router.post('/', upload.array('files'), async (req, res) => {
  const bucket = req.app.locals.gfsBucket;
  if (!bucket) return res.status(500).json({ error: 'GridFS não inicializado' });

  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const results = [];
  try {
    for (const file of req.files) {
      // criar upload stream
      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype
      });

      // grava buffer no uploadStream
      uploadStream.end(file.buffer);

      // esperar fim
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => resolve());
        uploadStream.on('error', reject);
      });

      results.push({ fileId: uploadStream.id, filename: file.originalname });
    }

    res.json({ uploaded: results });
  } catch (err) {
    console.error('Erro upload GridFS', err);
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;


