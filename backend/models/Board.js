const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  points: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  }],
  color: { type: String, default: '#000000' },
  fillColor: { type: String, default: 'transparent' },
  size: { type: Number, default: 2 },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const BoardSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  elements: [ElementSchema],
  version: { type: Number, default: 1 },
  metadata: { type: Object, default: {} }
}, { timestamps: true });

// Optimize lookups by roomId and update order
BoardSchema.index({ roomId: 1, updatedAt: -1 });

module.exports = mongoose.model('Board', BoardSchema);
