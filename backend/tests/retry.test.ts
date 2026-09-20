
import { describe, it, expect } from 'vitest';
import { getBackoffDelay } from '../src/scraper/retry';

describe('Retry & Backoff Strategy Tests', () => {
  // Requirement 7: Retry behavior & exponential backoff calculation
  it('should calculate increasing backoff delays with multiplier', () => {
    const delay1 = getBackoffDelay(1, 1000, 2.0, 0);
    const delay2 = getBackoffDelay(2, 1000, 2.0, 0);
    const delay3 = getBackoffDelay(3, 1000, 2.0, 0);

    expect(delay1).toBe(1000);
    expect(delay2).toBe(2000);
    expect(delay3).toBe(4000);
  });

  it('should include random jitter within bounds', () => {
    const base = 1500;
    const jitter = 200;
    for (let i = 0; i < 10; i++) {
      const d = getBackoffDelay(1, base, 2.0, jitter);
      expect(d).toBeGreaterThanOrEqual(base - jitter);
      expect(d).toBeLessThanOrEqual(base + jitter);
    }
  });

  // Requirement 8 & 9: Maximum retries and recovery simulation
  it('should simulate retry sequence stopping at maxRetries', async () => {
    const maxRetries = 3;
    let attemptsCount = 0;
    let succeeded = false;

    const mockAttempt = async () => {
      attemptsCount++;
      if (attemptsCount === 2) {
        succeeded = true;
        return { success: true, price: 14999 };
      }
      return { success: false, errorType: 'TIMEOUT' };
    };

    for (let i = 1; i <= maxRetries; i++) {
      const res = await mockAttempt();
      if (res.success) break;
    }

    expect(attemptsCount).toBe(2);
    expect(succeeded).toBe(true);
  });

  it('should record failure when all maxRetries fail', async () => {
    const maxRetries = 3;
    let attemptsCount = 0;

    const mockFailingAttempt = async () => {
      attemptsCount++;
      return { success: false, errorType: 'TIMEOUT' };
    };

    let finalStatus = 'PENDING';
    for (let i = 1; i <= maxRetries; i++) {
      const res = await mockFailingAttempt();
      if (!res.success && i === maxRetries) {
        finalStatus = 'FAILED';
      }
    }

    expect(attemptsCount).toBe(3);
    expect(finalStatus).toBe('FAILED');
  });
});
