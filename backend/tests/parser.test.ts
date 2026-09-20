
import { describe, it, expect } from 'vitest';
import { normalizePriceString, parseStockText, validateAndBuildResult } from '../src/scraper/parser';

describe('Price and Stock Parser Unit Tests', () => {
  // Requirement 1: Successful price extraction across diverse formatting variants
  describe('1. Successful price extraction & normalization', () => {
    it('should parse standard Indian Rupee format', () => {
      expect(normalizePriceString('₹ 16,619')).toBe(16619);
      expect(normalizePriceString('₹69,999')).toBe(69999);
      expect(normalizePriceString('Rs. 14,065.00')).toBe(14065);
    });

    it('should parse spaced thousands format', () => {
      expect(normalizePriceString('₹ 16 619')).toBe(16619);
      expect(normalizePriceString('42 500')).toBe(42500);
    });

    it('should parse European number format (dots for thousands, comma for decimals)', () => {
      expect(normalizePriceString('€ 16.619,00')).toBe(16619);
      expect(normalizePriceString('2.499,00')).toBe(2499);
    });

    it('should parse trailing tax strings', () => {
      expect(normalizePriceString('₹16,619/- (incl. of all taxes)')).toBe(16619);
      expect(normalizePriceString('₹8,999 (incl. GST)')).toBe(8999);
    });

    it('should convert fullwidth Unicode digits (0xFF10 - 0xFF19) to standard integers', () => {
      expect(normalizePriceString('１６６１９')).toBe(16619);
      expect(normalizePriceString('₹９９９９')).toBe(9999);
    });

    it('should strip zero-width and non-breaking space permutations', () => {
      const complexStr = '₹\u00A0\u200B1\u00A0\u200B6\u00A0\u200B,\u00A0\u200B6\u00A0\u200B1\u00A0\u200B9';
      expect(normalizePriceString(complexStr)).toBe(16619);
    });
  });

  // Requirement 2: Successful stock extraction
  describe('2. Successful stock extraction', () => {
    it('should correctly parse positive stock quantities and variants', () => {
      expect(parseStockText('In stock · 70 left')).toEqual({ status: 'In Stock', quantity: 70 });
      expect(parseStockText('Only 5 left')).toEqual({ status: 'In Stock', quantity: 5 });
      expect(parseStockText('12 in stock')).toEqual({ status: 'In Stock', quantity: 12 });
      expect(parseStockText('Seller has 30 units')).toEqual({ status: 'In Stock', quantity: 30 });
      expect(parseStockText('In Stock')).toEqual({ status: 'In Stock', quantity: null });
    });

    it('should identify out of stock conditions', () => {
      expect(parseStockText('Out of stock')).toEqual({ status: 'Out of Stock', quantity: 0 });
      expect(parseStockText('Sold out')).toEqual({ status: 'Out of Stock', quantity: 0 });
      expect(parseStockText('')).toEqual({ status: 'Out of Stock', quantity: 0 });
    });
  });

  // Requirement 3: Invalid price handling
  describe('3. Invalid price rejection', () => {
    it('should reject non-numeric, negative, and zero prices', () => {
      expect(normalizePriceString('Not a price')).toBeNull();
      expect(normalizePriceString('₹0')).toBeNull();
      expect(normalizePriceString('-500')).toBeNull();
      expect(normalizePriceString('')).toBeNull();
    });

    it('should yield INVALID_PRICE error in validateAndBuildResult', () => {
      const res = validateAndBuildResult('N/A', 'In stock');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorType).toBe('INVALID_PRICE');
      }
    });
  });

  // Requirement 4: Missing price selector
  describe('4. Missing price selector handling', () => {
    it('should return PRICE_NOT_FOUND when price is null or empty', () => {
      const res = validateAndBuildResult(null, 'In stock');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorType).toBe('PRICE_NOT_FOUND');
      }
    });
  });

  // Requirement 5: Missing stock selector
  describe('5. Missing stock selector handling', () => {
    it('should return STOCK_NOT_FOUND when stock string is missing', () => {
      const res = validateAndBuildResult('₹14,999', '');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorType).toBe('STOCK_NOT_FOUND');
      }
    });
  });
});
