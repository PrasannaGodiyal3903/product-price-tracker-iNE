import { ExtractionResult } from './types';

/**
 * Normalizes raw price strings from the mock store into an integer/float.
 * Handles:
 * - Indian Rupee formatting ("₹ 16,619", "Rs. 16,619.00")
 * - Euro notation ("€ 16.619,00")
 * - Spaced thousands ("16 619")
 * - Fullwidth unicode numbers ("１６６１９")
 * - Zero-width spaces and non-breaking spaces ("₹\u00A0\u200B1...")
 * - Trailing taxes notices ("/- (incl. of all taxes)")
 */
export function normalizePriceString(raw: string | null | undefined): number | null {
  if (!raw || typeof raw !== 'string') return null;

  let s = raw.trim();

  // 1. Convert fullwidth unicode digits (\uFF10 to \uFF19) to standard digits 0-9
  s = s.replace(/[\uFF10-\uFF19]/g, ch => String(ch.charCodeAt(0) - 0xFF10));

  // 2. Remove invisible zero-width spaces (\u200B), non-breaking spaces (\u00A0), narrow spaces (\u202F)
  s = s.replace(/[\u200B\u00A0\u202F\s]/g, '');

  // 3. Remove currency prefixes & suffixes
  s = s.replace(/[₹$€£]|Rs\.?|INR/gi, '');
  s = s.replace(/\/\-.*$/i, ''); // e.g. "/- (incl. of all taxes)"
  s = s.replace(/\(incl.*$/i, '');

  // 4. Handle European comma decimal (e.g. 16.619,00) vs Standard (16,619.00)
  if (/\d+\.\d{3},\d{2}/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\d+,\d{3}\.\d{2}/.test(s)) {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }

  const num = parseFloat(s);
  if (isNaN(num) || num <= 0) return null;

  return Math.round(num);
}

/**
 * Parses raw stock badge text into standardized status and quantity
 */
export function parseStockText(rawStock: string | null | undefined): {
  status: 'In Stock' | 'Out of Stock';
  quantity: number | null;
} {
  if (!rawStock || typeof rawStock !== 'string') {
    return { status: 'Out of Stock', quantity: 0 };
  }

  const s = rawStock.trim();
  const lower = s.toLowerCase();

  if (lower.includes('out of stock') || lower.includes('sold out')) {
    return { status: 'Out of Stock', quantity: 0 };
  }

  // Extract quantity if present e.g. "In stock · 70 left", "Only 5 left", "20 in stock", "Seller has 15 units"
  const qtyMatch = s.match(/(\d+)\s*(?:left|in stock|units)?/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  return {
    status: 'In Stock',
    quantity: isNaN(qty as number) ? null : qty
  };
}

/**
 * Validates extracted price and stock, returning a strictly typed ExtractionResult.
 * Ensures that invalid, null, NaN, or non-positive values NEVER pass as successful scrapes.
 */
export function validateAndBuildResult(
  rawPrice: string | null | undefined,
  rawStock: string | null | undefined
): ExtractionResult {
  if (!rawPrice || rawPrice.trim().length === 0) {
    return {
      success: false,
      errorType: 'PRICE_NOT_FOUND',
      message: 'Visible price element was not found in the product DOM.'
    };
  }

  const price = normalizePriceString(rawPrice);
  if (price === null || isNaN(price) || price <= 0) {
    return {
      success: false,
      errorType: 'INVALID_PRICE',
      message: `Extracted price value "${rawPrice}" could not be parsed into a positive numeric price.`
    };
  }

  if (!rawStock || rawStock.trim().length === 0) {
    return {
      success: false,
      errorType: 'STOCK_NOT_FOUND',
      message: 'Stock status element was missing from the product DOM.'
    };
  }

  const { status, quantity } = parseStockText(rawStock);

  return {
    success: true,
    price,
    rawPriceString: rawPrice.trim(),
    currency: 'INR',
    stockStatus: status,
    stockQuantity: quantity,
    rawStockText: rawStock.trim()
  };
}
