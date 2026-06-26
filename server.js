const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'micronation-dev-secret-change-in-prod';

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting — max 20 login attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests.' },
});

// Public form rate limit (citizen registration)
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please wait.' },
});

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

const { router: authRouter, seedAdmin } = require('./routes/auth');
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/admin', apiLimiter, require('./routes/admin'));
app.use('/api/records', apiLimiter, require('./routes/records'));
app.use('/api/join', joinLimiter, require('./routes/join'));

// All other routes → SPA
app.get('/join/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'join.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌍 Micronation DB → http://localhost:${PORT}`);
    console.log(`   Admin: mainosalvi@gmail.com / salvi3141\n`);
  });
});
// This line is intentionally blank — join.html is served by express.static
