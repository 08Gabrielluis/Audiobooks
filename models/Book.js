const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String },
  // cover agora é referência ao GridFS ao invés de URL
  cover: {
    fileId: { type: mongoose.Schema.Types.ObjectId },
    filename: { type: String }
  },
  summary: { type: String },
  // playlist mantém array de capítulos
  playlist: [{
    fileId: { type: mongoose.Schema.Types.ObjectId },
    filename: { type: String },
    title: { type: String }, // título do capítulo
    order: { type: Number }  // ordem do capítulo
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Book', BookSchema);
