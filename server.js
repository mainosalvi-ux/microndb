const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initSchema } = require('./db');

const app = express();
const SESSION_SECRET = process.env.SESSION_SECRET || 'micronation-dev-secret';

app.use(helmet({ contentSecurityPolicy: false }));

const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: 'Too many attempts. Try in 15 min.' } });
const apiLimiter = rateLimit({ windowMs: 60*1000, max: 200 });
const joinLimiter = rateLimit({ windowMs: 60*1000, max: 10, message: { error: 'Too many submissions. Please wait.' } });

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

const { router: authRouter, seedAdmin } = require('./routes/auth');
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/admin', apiLimiter, require('./routes/admin'));
app.use('/api/records', apiLimiter, require('./routes/records'));
app.use('/api/documents', apiLimiter, require('./routes/documents'));
app.use('/api/join', joinLimiter, require('./routes/join'));

app.get('/join/:token', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'join.html'))
);
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// For Vercel: export the app instead of listening
// For local: listen on port
if (process.env.VERCEL) {
  // Vercel calls this as a serverless function
  initSchema().then(() => seedAdmin()).catch(console.error);
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3000;
  initSchema().then(() => {
    return seedAdmin();
  }).then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🌍 Micronation DB → http://localhost:${PORT}`);
      console.log(`   Admin: mainosalvi@gmail.com / salvi3141\n`);
    });
  }).catch(err => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
}
