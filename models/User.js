const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:           { type: String, required: true, unique: true },
  name:            { type: String, required: true },
  mobileNo:        { type: String, required: true },
  githubUsername:  { type: String, required: true },
  rollNo:          { type: String, required: true, unique: true },
  accessCode:      { type: String, required: true },
  clientSecret:    { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
