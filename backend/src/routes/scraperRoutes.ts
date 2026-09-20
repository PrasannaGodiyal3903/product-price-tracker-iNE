import { Router } from 'express';
import { ScraperController } from '../controllers/scraperController';
import { requireCronAuth } from '../middleware/auth';

export const scraperRouter = Router();

// Cron-job.org scheduled run endpoint
scraperRouter.post('/run', requireCronAuth, ScraperController.runScheduledScraper);
