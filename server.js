require('dotenv').config({ override: true });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const booksRouter = require('./routes/books');
const uploadRouter = require('./routes/upload');
const audioRouter = require('./routes/audio');

const app = express();

// Configuração do CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://08gabrielluis.github.io'] // frontend hospedado no GitHub Pages
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // permitir requisições sem origin (curl, postman, servidores)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: origin not allowed'));
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Servir assets estáticos do seu projeto
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/aud', express.static(path.join(__dirname, 'aud')));
app.use('/', express.static(path.join(__dirname)));

// API
// NOTE: registramos as rotas relacionadas a GridFS *depois* da conexão com o DB

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/audiobooks';
mongoose.connect(mongoUri)
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
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    app.listen(port, host, () => {
      console.log(`Servidor rodando em http://${host}:${port}`);
      console.log('Ambiente:', process.env.NODE_ENV);
    });
  })
  .catch(err => console.error('Erro ao conectar MongoDB', err));
