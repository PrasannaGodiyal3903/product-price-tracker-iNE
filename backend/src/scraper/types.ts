export interface ParsedPriceResult {
  success: true;
  price: number;
  rawPriceString: string;
  currency: string;
  stockStatus: 'In Stock' | 'Out of Stock';
  stockQuantity: number | null;
  rawStockText: string;
}

export interface ParseFailureResult {
  success: false;
  errorType: 'PRICE_NOT_FOUND' | 'STOCK_NOT_FOUND' | 'INVALID_PRICE' | 'PAGE_ERROR' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
}

export type ExtractionResult = ParsedPriceResult | ParseFailureResult;

export interface ScrapeAttemptResult {
  attemptNumber: number;
  status: 'SUCCESS' | 'RETRY' | 'FAILED';
  message: string;
  errorType?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  data?: ParsedPriceResult;
}

export interface ScraperOptions {
  headless?: boolean;
  maxRetries?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
  onAttempt?: (attempt: ScrapeAttemptResult) => Promise<void> | void;
}
