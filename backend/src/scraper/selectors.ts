/**
 * Resilient selector candidates for the INE Store
 * The store uses dynamic layout rotation, randomized utility classes (e.g. pw-k2, pv-k2),
 * and decoy elements.
 */
export const SELECTORS = {
  // Price containers
  priceBlock: [
    '.price-block',
    '[class*="price-block"]',
    'section.detail .price-main',
    '.price-main'
  ],

  // Interactive buttons
  revealButton: [
    'button[aria-label="Reveal price"]',
    'button:has-text("Reveal price")',
    'button:has-text("REVEAL PRICE")',
    '.price-idle button'
  ],
  tryAgainButton: [
    'button:has-text("Try again")',
    'button:has-text("TRY AGAIN")',
    '.price-error button'
  ],

  // Cookie overlay
  cookieOverlay: [
    '.cookie-overlay',
    '[class*="cookie-overlay"]',
    '[aria-label="Cookie consent"]'
  ],
  cookieAcceptButton: [
    'button[aria-label="Accept cookies"]',
    'button:has-text("Accept cookies")',
    '.cookie-actions button'
  ],

  // Product metadata
  productName: [
    'h1',
    '.product-title',
    'main h1',
    '.detail h1'
  ],
  stockBadge: [
    '.stock-badge',
    '[class*="stock-badge"]',
    '.price-facets .stock-badge'
  ]
};
