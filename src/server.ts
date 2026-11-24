import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { paymentRouter } from './routes/payment.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Middleware: capture rawBody Buffer for HMAC SHA-256 signature verification
  app.use(
    express.json({
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(express.urlencoded({ extended: true }));

  // Serve static files from public/ directory
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // Mount payment & wallet API routes
  app.use('/api', paymentRouter);

  // Fallback to index.html
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

const app = createApp();
export default app;

// Start server if executed directly (and not on Vercel serverless)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 CRAZY WALLET - Multi-Role Payment & Treasury System`);
    console.log(`======================================================`);
    console.log(`📍 Web App URL:      http://localhost:${PORT}`);
    console.log(`🔔 Webhook Endpoint: http://localhost:${PORT}/api/webhook/xenpay`);
    console.log(`🔑 Admin Account:    admin@crazywallet.com / admin123`);
    console.log(`👤 Demo Creator:     rahul@creator.com / creator123`);
    console.log(`======================================================\n`);
  });
}
