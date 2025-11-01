const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/audio/:id  -> stream do arquivo GridFS
router.get('/:id', async (req, res) => {
  const bucket = req.app.locals.gfsBucket;
  if (!bucket) return res.status(500).json({ error: 'GridFS não inicializado' });

  let fileId;
  try {
    fileId = new mongoose.Types.ObjectId(req.params.id);
  } catch (e) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  // localizar metadados do arquivo
  const filesCursor = bucket.find({ _id: fileId });
  const files = await filesCursor.toArray();
  if (!files || files.length === 0) return res.status(404).json({ error: 'Arquivo não encontrado' });

  const file = files[0];
  res.set('Content-Type', file.contentType || 'application/octet-stream');
  res.set('Accept-Ranges', 'bytes');

  // Processa Range request se presente
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
    const chunksize = (end - start) + 1;

    res.status(206);
    res.set('Content-Range', `bytes ${start}-${end}/${file.length}`);
    res.set('Content-Length', chunksize);

    const downloadStream = bucket.openDownloadStream(fileId, {
      start,
      end: end + 1
    });
    downloadStream.on('error', (err) => {
      console.error('Erro ao streamar arquivo', err);
      res.sendStatus(500);
    });
    downloadStream.pipe(res);
  } else {
    // Sem Range - envia arquivo completo
    res.set('Content-Length', file.length);
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', (err) => {
      console.error('Erro ao streamar arquivo', err);
      res.sendStatus(500);
    });
    downloadStream.pipe(res);
  }
});

module.exports = router;
