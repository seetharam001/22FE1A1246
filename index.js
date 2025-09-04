require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('Database Connected'))
  .catch((error) => console.error('Database connection error:', error));

// Registration API
app.post('/evaluation-service/register', async (req, res) => {
  try {
    const { email, name, mobileNo, githubUsername, rollNo, accessCode } = req.body;

    // Prevent registering twice (by email or rollNo)
    const existingUser = await User.findOne({ $or: [{ email }, { rollNo }] });
    if (existingUser) {
      return res.status(400).json({
        message: 'You can register only once.',
        email: existingUser.email,
        name: existingUser.name,
        rollNo: existingUser.rollNo
      });
    }

    // Generate clientSecret, e.g. 32 chars hex
    const clientSecret = crypto.randomBytes(16).toString('hex');

    const user = new User({
      email,
      name,
      mobileNo,
      githubUsername,
      rollNo,
      accessCode,
      clientSecret
    });

    await user.save();
    res.status(201).json({
      accessCode,
      clientID: user._id,
      clientSecret,
      email,
      name,
      rollNo
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authorization Token API (matches screenshot)
app.post('/evaluation-service/auth', async (req, res) => {
  try {
    const { email, name, rollNo, accessCode, clientID, clientSecret } = req.body;

    // Find matching user
    const user = await User.findOne({
      _id: clientID,
      email,
      name,
      rollNo,
      accessCode,
      clientSecret
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Issue JWT
    const expiresIn = 24 * 60 * 60 * 1000; // One day in milliseconds
    const token = jwt.sign(
      {
        sub: user._id,
        email: user.email,
        name: user.name,
        rollNo: user.rollNo
      },
      process.env.JWT_SECRET,
      { expiresIn: expiresIn / 1000 } // JWT expects seconds
    );

    res.status(200).json({
      token_type: "Bearer",
      access_token: token,
      expires_in: Math.floor(Date.now()/1000) + (expiresIn / 1000)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Home route
app.get('/', (req, res) => {
  res.send('Hello Node.js and MongoDB!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
