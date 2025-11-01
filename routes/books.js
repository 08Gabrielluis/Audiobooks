const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const multer = require('multer');

// configura multer para aceitar qualquer arquivo (capa + múltiplos áudios)
// limitamos o número total de arquivos a 31 (1 capa + até 30 capítulos)
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 31 } });

// POST /api/books/upload - Endpoint integrado (capa + áudios + metadados)
// usamos upload.any() para aceitar campos dinâmicos como chapters[0][audio], chapters[1][audio], ...
router.post('/upload', upload.any(), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        // obtém o GridFSBucket a partir do app
        const bucket = req.app && req.app.locals && req.app.locals.gfsBucket;
        if (!bucket) return res.status(500).json({ error: 'GridFS não inicializado' });

        // localizar arquivo de capa entre os arquivos enviados
        const coverFile = req.files.find(f => f.fieldname === 'cover');
        if (!coverFile) return res.status(400).json({ error: 'Imagem de capa é obrigatória' });
        const coverUploadStream = bucket.openUploadStream(coverFile.originalname, {
            contentType: coverFile.mimetype,
            metadata: { type: 'cover' }
        });
        coverUploadStream.end(coverFile.buffer);
        await new Promise((resolve, reject) => {
            coverUploadStream.on('finish', resolve);
            coverUploadStream.on('error', reject);
        });

        // Processa cada capítulo enviado (áudio)
        const playlist = [];
        let metadata = {};// metadados do livro (título, autor, etc.)
        try {// tenta parsear metadados JSON
            metadata = JSON.parse(req.body.metadata || '{}');
        } catch (e) {
            return res.status(400).json({ error: 'Metadados inválidos. Envie um JSON válido no campo "metadata".' });
        }
        


        // Processa arquivos de áudio cujo fieldname corresponda a chapters[<index>][audio]
        // aceita índices dinâmicos até 30 capítulos
        const chapterFiles = req.files.filter(f => /^chapters\[\d+\]\[audio\]$/.test(f.fieldname));
        if (chapterFiles.length === 0) {
            return res.status(400).json({ error: 'Pelo menos um arquivo de áudio é obrigatório' });
        }

        // limitar a 30 capítulos
        if (chapterFiles.length > 30) {
            return res.status(400).json({ error: 'Máximo de 30 capítulos permitido' });
        }

        // Para cada capítulo, extrair índice a partir do fieldname e obter título/ordem do req.body
        for (const f of chapterFiles) {
            const m = f.fieldname.match(/^chapters\[(\d+)\]\[audio\]$/);
            const idx = m ? parseInt(m[1], 10) : null;
            const title = req.body[`chapters[${idx}][title]`] || `Capítulo ${idx + 1}`;
            const order = parseInt(req.body[`chapters[${idx}][order]`]) || (idx + 1);

            // Upload do áudio para GridFS
            const audioUploadStream = bucket.openUploadStream(f.originalname, {
                contentType: f.mimetype,
                metadata: { type: 'audio', chapter: idx + 1 }
            });
            audioUploadStream.end(f.buffer);
            await new Promise((resolve, reject) => {
                audioUploadStream.on('finish', resolve);
                audioUploadStream.on('error', reject);
            });

            playlist.push({
                fileId: audioUploadStream.id,
                filename: f.originalname,
                title,
                order
            });
        }

        if (playlist.length === 0) {
            return res.status(400).json({ error: 'Pelo menos um arquivo de áudio é obrigatório' });
        }

        // Ordena playlist pela ordem especificada
        playlist.sort((a, b) => a.order - b.order);

        // Cria o Book com todas as referências
        const book = await Book.create({
            ...metadata,
            cover: {
                fileId: coverUploadStream.id,
                filename: coverFile.originalname
            },
            playlist
        });
        res.status(201).json(book);

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/books
router.get('/', async (req, res) => {
    try {
        const books = await Book.find().lean();
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/books/:id
router.get('/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).lean();
        if (!book) return res.status(404).json({ error: 'Livro não encontrado' });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/books  (recebe JSON com fields)
router.post('/', async (req, res) => {
    try {
        const created = await Book.create(req.body);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/books/:id
router.put('/:id', async (req, res) => {
    try {
        const updated = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Livro não encontrado' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/books/:id
router.delete('/:id', async (req, res) => {
    try {
        const removed = await Book.findByIdAndDelete(req.params.id);
        if (!removed) return res.status(404).json({ error: 'Livro não encontrado' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



module.exports = router;

