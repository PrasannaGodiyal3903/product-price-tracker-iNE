import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { ScraperController } from '../controllers/scraperController';

export const productRouter = Router();

// Product catalog search
productRouter.get('/search', ProductController.searchProducts);

// Tracking endpoints
productRouter.post('/track', ProductController.trackProduct);
productRouter.get('/tracked', ProductController.listTracked);

// Product details, history, logs, manual scrape
productRouter.get('/:id', ProductController.getProduct);
productRouter.get('/:id/history', ProductController.getHistory);
productRouter.get('/:id/logs', ProductController.getLogs);
productRouter.post('/:id/scrape', ScraperController.scrapeSingleProduct);
