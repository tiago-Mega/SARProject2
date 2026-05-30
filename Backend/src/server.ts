/**
 * Express app to serve Angular single page auction site
 * Modernized with TypeScript and best practices
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import favicon from 'serve-favicon';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import { Server } from 'socket.io'
import bodyParser from 'body-parser';
import { Request, Response } from 'express';

import config from './config/config';
import { connectDatabase } from './config/db';
import apiRoutes from './routes/api.routes';
import socketService from './services/socket.service';
import errorHandler from './middlewares/errorHandler';

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Whitelist only your known frontend origins instead of allowing all origins
const allowedOrigins = [
  `https://localhost:${config.httpsPort}`,
  `http://localhost:${config.port}`,
  // Add your production domain here when deploying, e.g.:
  // 'https://auction.example.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-origin requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── HELMET + CSP ────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Fallback for any directive not explicitly listed
        defaultSrc: ["'self'"],

        // Scripts: only from the same origin (Angular bundle)
        scriptSrc: ["'self'"],

        // Styles: Angular injects some critical styles at runtime
        // 'unsafe-inline' is acceptable here since Angular controls this output
        styleSrc: ["'self'", "'unsafe-inline'"],

        // API calls + Socket.IO WebSocket connections
        // wss: is required for Socket.IO over HTTPS
        connectSrc: [
          "'self'",
          `https://localhost:${config.httpsPort}`,
          `wss://localhost:${config.httpsPort}`
        ],

        // Images: same-origin and base64 data URIs (used by Angular and icons)
        imgSrc: ["'self'", "data:"],

        // Fonts: same-origin only
        fontSrc: ["'self'"],

        // Prevent the app from being embedded in an iframe (anti-clickjacking)
        frameAncestors: ["'none'"],

        // Only allow form submissions to the same origin
        formAction: ["'self'"],

        // Upgrade any accidental HTTP sub-resource requests to HTTPS
        upgradeInsecureRequests: [],
      },
    },

    // HSTS: tell browsers to always use HTTPS for the next year
    // Only enable this when you are sure the site always runs on HTTPS
    strictTransportSecurity: {
      maxAge: 31536000,       // 1 year in seconds
      includeSubDomains: true,
    },

    // Prevent browsers from sniffing MIME types
    noSniff: true,

    // Disable the outdated X-XSS-Protection header (modern browsers use CSP instead)
    xssFilter: false,

    // Prevent sending the Referer header to other origins
    referrerPolicy: { policy: 'same-origin' },
  })
);

// ─── LOGGING ─────────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ─── SERVE ANGULAR ────────────────────────────────────────────────────────────
const angularDistPath = path.join(__dirname, '../../dist/auction-sar');
if (fs.existsSync(angularDistPath)) {
  app.use(express.static(angularDistPath));

  if (fs.existsSync(path.join(angularDistPath, 'favicon.ico'))) {
    app.use(favicon(path.join(angularDistPath, 'favicon.ico')));
  }

  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(angularDistPath, 'index.html'));
  });
} else {
  app.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'API is running',
      message: 'Angular frontend not built. Access API endpoints directly at /api/*'
    });
  });
}

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── HTTP → HTTPS REDIRECT ───────────────────────────────────────────────────
const httpApp = express();
httpApp.set('port', config.port);

httpApp.get('*', (req: Request, res: Response) => {
  const host = req.headers.host?.split(':')[0];
  res.redirect(301, `https://${host}:${config.httpsPort}${req.url}`);
});

const httpServer = http.createServer(httpApp);

// ─── HTTPS SERVER ─────────────────────────────────────────────────────────────
const httpsOptions = {
  key: fs.readFileSync(config.sslKeyPath),
  cert: fs.readFileSync(config.sslCertPath)
};

const httpsServer = https.createServer(httpsOptions, app);

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpsServer, {
  cors: {
    origin: allowedOrigins,  // Reuse the same whitelist
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  transports: ['websocket', 'polling']
});

socketService.init(io);

// ─── START ────────────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDatabase();

    httpServer.listen(config.port, () => {
      console.log(`HTTP redirect server running on http://localhost:${config.port}`);
    });

    httpsServer.listen(config.httpsPort, () => {
      console.log(`HTTPS API running on https://localhost:${config.httpsPort}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// ─── PROCESS GUARDS ───────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  process.exit(1);
});

startServer();