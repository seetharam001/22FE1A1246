require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const ShortUrl = require('./models/shorturl');

const app = express();
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('Database Connected'))
  .catch(error => console.error('Database connection error:', error));

// Registration API
app.post('/evaluation-service/register', async (req, res) => {
  try {
    const { email, name, mobileNo, githubUsername, rollNo, accessCode } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { rollNo }] });
    if (exists) {
      return res.status(400).json({
        message: 'You can register only once.',
        email: exists.email,
        name: exists.name,
        rollNo: exists.rollNo
      });
    }

    const clientSecret = crypto.randomBytes(16).toString('hex');
    const user = new User({ email, name, mobileNo, githubUsername, rollNo, accessCode, clientSecret });
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

// Authentication API
app.post('/evaluation-service/auth', async (req, res) => {
  try {
    const { email, name, rollNo, accessCode, clientID, clientSecret } = req.body;

    const user = await User.findOne({ _id: clientID, email, name, rollNo, accessCode, clientSecret });
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

    const expiresIn = 24 * 60 * 60; // 1 day in seconds

    const token = jwt.sign(
      { sub: user._id, email: user.email, name: user.name, rollNo: user.rollNo },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.status(200).json({
      token_type: "Bearer",
      access_token: token,
      expires_in: Math.floor(Date.now() / 1000) + expiresIn
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
}

function generateShortcode(length = 6) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

// Create Short URL
app.post('/shorturls', authMiddleware, async (req, res) => {
  try {
    const { url, validity, shortcode } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url.' });
    }

    const validityMinutes = parseInt(validity) > 0 ? parseInt(validity) : 30;
    const expiry = new Date(Date.now() + validityMinutes * 60 * 1000);

    let finalShortcode = shortcode;
    if (shortcode) {
      const existing = await ShortUrl.findOne({ shortcode });
      if (existing) {
        return res.status(400).json({ error: 'Shortcode already in use. Choose a different one.' });
      }
    } else {
      let isUnique = false;
      while (!isUnique) {
        finalShortcode = generateShortcode();
        isUnique = !(await ShortUrl.findOne({ shortcode: finalShortcode }));
      }
    }

    const shortUrl = new ShortUrl({
      url,
      shortcode: finalShortcode,
      createdBy: req.user.sub,
      validity: validityMinutes,
      expiry,
      clicks: []
    });

    await shortUrl.save();

    res.status(201).json({
      shortLink: `${req.protocol}://${req.get('host')}/r/${finalShortcode}`,
      expiry: expiry.toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Redirect short URL
app.get('/r/:shortcode', async (req, res) => {
  try {
    const { shortcode } = req.params;
    const shortUrl = await ShortUrl.findOne({ shortcode });
    if (!shortUrl) return res.status(404).json({ error: 'Short link not found' });

    if (new Date() > shortUrl.expiry) {
      return res.status(410).json({ error: 'Short link has expired' });
    }

    shortUrl.clicks.push({
      timestamp: new Date(),
      referrer: req.get('Referer') || '',
      sourceIP: req.ip
    });
    await shortUrl.save();

    res.redirect(shortUrl.url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retrieve Short URL Statistics
app.get('/shorturls/:shortcode', authMiddleware, async (req, res) => {
  try {
    const { shortcode } = req.params;
    const shortUrl = await ShortUrl.findOne({ shortcode });
    if (!shortUrl) return res.status(404).json({ error: 'Short link not found' });

    res.status(200).json({
      url: shortUrl.url,
      createdAt: shortUrl.createdAt,
      expiry: shortUrl.expiry,
      validity: shortUrl.validity,
      clicks: shortUrl.clicks.length,
      clickDetails: shortUrl.clicks.map(c => ({
        timestamp: c.timestamp,
        referrer: c.referrer,
        sourceIP: c.sourceIP
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('AffordMed Backend API Running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
