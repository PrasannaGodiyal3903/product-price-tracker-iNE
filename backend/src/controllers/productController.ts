import { Request, Response, NextFunction } from 'express';
import { Repository } from '../db/repository';
import { CatalogService } from '../services/catalogService';

export class ProductController {
  /**
   * Search and discover INE mock store catalog (all 1,000 products)
   */
  public static async searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = ((req.query.q as string) || '').trim();
      const category = ((req.query.category as string) || '').trim();
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.limit || req.query.pageSize) || 20;

      const result = await CatalogService.searchProducts({
        query: q,
        category,
        page,
        pageSize
      });

      res.json({
        success: true,
        count: result.items.length,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        categories: result.categories,
        items: result.items
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Track product
   */
  public static async trackProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { product_name, product_url, external_product_id, category, brand } = req.body;

      if (!product_name || !product_url) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Both product_name and product_url are required.'
        });
        return;
      }

      // Validate URL belongs to INE store
      if (!product_url.includes('demo.inelabteamdev.com')) {
        res.status(400).json({
          success: false,
          error: 'INVALID_STORE_URL',
          message: 'Only products from https://demo.inelabteamdev.com/ are permitted.'
        });
        return;
      }

      // Check if already tracked
      const existing = await Repository.findProductByUrl(product_url);
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'ALREADY_TRACKED',
          message: 'This product is already being tracked.',
          product: existing
        });
        return;
      }

      const created = await Repository.createProduct({
        product_name,
        product_url,
        external_product_id: external_product_id ? Number(external_product_id) : null,
        category,
        brand
      });

      res.status(201).json({
        success: true,
        message: 'Product successfully tracked.',
        product: created
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List tracked products
   */
  public static async listTracked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await Repository.listTrackedProducts();
      res.json({ success: true, count: products.length, products });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single tracked product
   */
  public static async getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const product = await Repository.findProductById(id);
      if (!product) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Tracked product not found.' });
        return;
      }
      res.json({ success: true, product });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get price history
   */
  public static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const history = await Repository.getPriceHistory(id);
      res.json({ success: true, count: history.length, history });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get scrape logs
   */
  public static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const logs = await Repository.getScrapeLogs(id);
      res.json({ success: true, count: logs.length, logs });
    } catch (err) {
      next(err);
    }
  }
}
