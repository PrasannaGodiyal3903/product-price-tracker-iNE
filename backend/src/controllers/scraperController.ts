import { Request, Response, NextFunction } from 'express';
import { Repository } from '../db/repository';
import { ProductScraper } from '../scraper/scraper';

const scraper = new ProductScraper();

export class ScraperController {
  /**
   * Manual scrape trigger for single product (POST /api/products/:id/scrape)
   */
  public static async scrapeSingleProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id;
      const product = await Repository.findProductById(productId);

      if (!product) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
        return;
      }

      console.log(`[SCRAPER] Initiating scrape for product ${product.product_name} (${product.id})`);

      const { finalResult, attempts } = await scraper.scrapeProductWithRetry(product.product_url, {
        headless: true,
        maxRetries: 3,
        timeoutMs: 15000,
        onAttempt: async (attempt) => {
          await Repository.recordScrapeLog({
            product_id: product.id,
            attempt_number: attempt.attemptNumber,
            status: attempt.status,
            message: attempt.message,
            error_type: attempt.errorType,
            started_at: attempt.startedAt,
            finished_at: attempt.finishedAt,
            duration_ms: attempt.durationMs
          });
        }
      });

      // Insert price history strictly if valid
      let historyRecord = null;
      if (finalResult.success) {
        historyRecord = await Repository.recordPriceHistory({
          product_id: product.id,
          price: finalResult.price,
          currency: finalResult.currency,
          stock_status: finalResult.stockStatus,
          stock_quantity: finalResult.stockQuantity,
          raw_stock_text: finalResult.rawStockText
        });
      }

      res.json({
        success: finalResult.success,
        result: finalResult,
        attemptsCount: attempts.length,
        attempts,
        priceHistory: historyRecord
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Scheduled cron endpoint for cron-job.org (POST /api/scraper/run)
   * Protected by requireCronAuth
   */
  public static async runScheduledScraper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[CRON] Scheduled scraper batch job triggered.');
      const products = await Repository.listTrackedProducts();
      const active = products.filter(p => p.is_active);

      if (active.length === 0) {
        res.json({
          success: true,
          message: 'No active tracked products to process.',
          processed: 0,
          successful: 0,
          failed: 0
        });
        return;
      }

      let successful = 0;
      let failed = 0;

      // Process products sequentially to prevent overwhelming the target store
      for (const prod of active) {
        try {
          const { finalResult } = await scraper.scrapeProductWithRetry(prod.product_url, {
            headless: true,
            maxRetries: 2,
            timeoutMs: 15000,
            onAttempt: async (attempt) => {
              await Repository.recordScrapeLog({
                product_id: prod.id,
                attempt_number: attempt.attemptNumber,
                status: attempt.status,
                message: attempt.message,
                error_type: attempt.errorType,
                started_at: attempt.startedAt,
                finished_at: attempt.finishedAt,
                duration_ms: attempt.durationMs
              });
            }
          });

          if (finalResult.success) {
            successful++;
            await Repository.recordPriceHistory({
              product_id: prod.id,
              price: finalResult.price,
              currency: finalResult.currency,
              stock_status: finalResult.stockStatus,
              stock_quantity: finalResult.stockQuantity,
              raw_stock_text: finalResult.rawStockText
            });
          } else {
            failed++;
          }
        } catch (e: any) {
          failed++;
          console.error(`[CRON ERROR] Failed scraping product ${prod.id}:`, e.message);
        }
      }

      res.json({
        success: true,
        processed: active.length,
        successful,
        failed,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      next(err);
    }
  }
}
