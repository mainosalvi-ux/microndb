const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initSchema } = require('./db');

const app = express();

// Configuración obligatoria para que express-rate-limit funcione en Render
app.set('trust proxy', 1); 

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'micronation-dev-secret-change-in-prod';

app.use(helmet({ contentSecurityPolicy: false }));

// Limitadores parchados con la opción validate para evitar caídas en Render
const loginLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many attempts. Try in 15 min.' },
  validate: { trustProxy: false } 
});

const apiLimiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 200,
  validate: { trustProxy: false }
});

const joinLimiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 10, 
  message: { error: 'Too many submissions. Please wait.' },
  validate: { trustProxy: false }
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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

// --- SECCIÓN DE RUTAS CORREGIDA ---
const { router: authRouter, seedAdmin } = require('./routes/auth');
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);

// Importaciones inteligentes para evitar colapsos por enrutadores indefinidos
const adminModule = require('./routes/admin');
app.use('/api/admin', apiLimiter, adminModule.router || adminModule);

const recordsModule = require('./routes/records');
app.use('/api/records', apiLimiter, recordsModule.router || recordsModule);

const docsModule = require('./routes/documents');
app.use('/api/documents', apiLimiter, docsModule.router || docsModule);

const joinModule = require('./routes/join');
app.use('/api/join', joinLimiter, joinModule.router || joinModule);
// ----------------------------------

app.get('/join/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'join.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  await initSchema();
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`\n🌍 Micronation DB → http://localhost:${PORT}`);
    console.log(`   Admin: mainosalvi@gmail.com / salvi3141\n`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
