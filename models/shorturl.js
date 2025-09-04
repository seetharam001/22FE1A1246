const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  referrer: { type: String },
  sourceIP: { type: String }
});

const shortUrlSchema = new mongoose.Schema({
  url:         { type: String, required: true },
  shortcode:   { type: String, required: true, unique: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:   { type: Date, default: Date.now },
  validity:    { type: Number, default: 30 }, // minutes
  expiry:      { type: Date, required: true },
  clicks:      [clickSchema]
});

module.exports = mongoose.model('ShortUrl', shortUrlSchema);
