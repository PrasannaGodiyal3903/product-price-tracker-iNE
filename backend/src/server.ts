import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { productRouter } from './routes/productRoutes';
import { scraperRouter } from './routes/scraperRoutes';
import { errorHandler } from './middleware/errorHandler';
import { CatalogService } from './services/catalogService';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: [frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', /\.vercel\.app$/],
  credentials: true
}));

app.use(express.json());

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'product-price-tracker-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: process.env.SUPABASE_URL ? 'SUPABASE' : 'LOCAL_FALLBACK'
  });
});

// App routes
app.use('/api/products', productRouter);
app.use('/api/scraper', scraperRouter);

// Global Error Handler
app.use(errorHandler);

let activeServer: http.Server | null = null;

export function startServer(port: number | string = PORT): Promise<http.Server> {
  return new Promise((resolve) => {
    activeServer = app.listen(port, () => {
      console.log(`==================================================`);
      console.log(`Product Price Tracker Backend running on port ${port}`);
      console.log(`Health Check: http://localhost:${port}/api/health`);
      console.log(`==================================================`);
      resolve(activeServer!);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (activeServer) {
      if (typeof activeServer.closeAllConnections === 'function') {
        activeServer.closeAllConnections();
      }
      activeServer.close(() => {
        activeServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Only listen if not imported in test mode
if (process.env.NODE_ENV !== 'test' && !process.env.E2E_TEST) {
  startServer().then(() => {
    CatalogService.getAllProducts().catch(err => {
      console.warn('[Server] Initial catalog pre-warm note:', err.message);
    });
  });
}

export default app;
