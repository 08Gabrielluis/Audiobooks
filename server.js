require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const booksRouter = require('./routes/books');
const uploadRouter = require('./routes/upload');
const audioRouter = require('./routes/audio');

const app = express();
app.use(cors());
app.use(express.json());

// Servir assets estáticos do seu projeto
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/aud', express.static(path.join(__dirname, 'aud')));
app.use('/', express.static(path.join(__dirname)));

// API
// NOTE: registramos as rotas relacionadas a GridFS *depois* da conexão com o DB

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/audiobooks';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB conectado');
    // inicializa GridFSBucket e anexa ao app locals
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'audios' });
      app.locals.gfsBucket = bucket;
      console.log('GridFSBucket inicializado');
    } catch (e) {
      console.error('Erro ao inicializar GridFSBucket', e);
    }
    // agora que o DB/bucket estão prontos, registra as rotas que dependem dele
    app.use('/api/books', booksRouter);
    app.use('/api/upload', uploadRouter);
    app.use('/api/audio', audioRouter);
    // Inicia o servidor somente depois que o DB e rotas estiverem prontas
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
  })
  .catch(err => console.error('Erro ao conectar MongoDB', err));
