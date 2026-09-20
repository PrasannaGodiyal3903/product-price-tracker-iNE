import React, { useState } from 'react';
import { TrackedProduct } from '../types';
import { triggerManualScrape } from '../api';

interface Props {
  products: TrackedProduct[];
  onSelectProduct: (product: TrackedProduct) => void;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export const TrackedList: React.FC<Props> = ({ products, onSelectProduct, onRefresh, onToast }) => {
  const [scrapingId, setScrapingId] = useState<string | null>(null);

  const handleScrapeNow = async (e: React.MouseEvent, product: TrackedProduct) => {
    e.stopPropagation();
    setScrapingId(product.id);
    try {
      const result = await triggerManualScrape(product.id);
      if (result.success) {
        onToast('Scraped: ' + product.product_name, 'success');
      } else {
        onToast(result.message || 'Scrape finished with issues', 'error');
      }
      onRefresh();
    } catch (err: any) {
      onToast('Scrape failed: ' + err.message, 'error');
    } finally {
      setScrapingId(null);
    }
  };

  if (products.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginBottom: '.5rem', opacity: .2 }}>◧</div>
        <h3 style={{ margin: '0 0 .375rem', fontSize: '1rem', fontWeight: 700 }}>No products tracked yet</h3>
        <p style={{ margin: 0, fontSize: '.8125rem', color: 'var(--muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          Search the catalog above, then click Track on any product to start monitoring its price.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
      {products.map(p => {
        const isScraping = scrapingId === p.id;
        const hasPrice = p.latest_price !== null && p.latest_price !== undefined;
        const price = hasPrice ? 'Rs.' + p.latest_price!.toLocaleString('en-IN') : null;
        const lastScraped = p.last_scraped_at
          ? new Date(p.last_scraped_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null;
        const inStock = p.latest_stock_status?.toLowerCase().includes('in stock');
        const outOfStock = p.latest_stock_status && !inStock;

        return (
          <div
            key={p.id}
            style={{
              background: 'var(--white)',
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '.875rem',
              transition: 'background .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
            onClick={() => onSelectProduct(p)}
          >
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {p.category && (
                  <div style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.3rem' }}>
                    {p.category}
                  </div>
                )}
                <h3 style={{ margin: 0, fontSize: '.9375rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, letterSpacing: '-.01em' }}>
                  {p.product_name}
                </h3>
                {p.brand && (
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.25rem' }}>{p.brand}</div>
                )}
              </div>
              <a
                href={p.product_url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                title="View on INE Store"
                style={{ color: 'var(--muted)', padding: '.25rem', flexShrink: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            {/* Price block */}
            <div style={{ background: 'var(--wash)', padding: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.25rem' }}>
                  Current Price
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.02em', lineHeight: 1 }}>
                  {price || <span style={{ fontSize: '1rem', color: 'var(--muted)', fontFamily: 'var(--sans)' }}>Not scraped yet</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.35rem' }}>
                  Stock
                </div>
                {p.latest_stock_status ? (
                  <span className={inStock ? 'badge badge-success' : 'badge badge-error'}>
                    {p.latest_stock_status}
                  </span>
                ) : (
                  <span className="badge badge-neutral">—</span>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.7rem', color: 'var(--muted)' }}>
              <span>{lastScraped ? 'Scraped ' + lastScraped : 'Never scraped'}</span>
              {p.last_scrape_status && (
                <span className={
                  p.last_scrape_status === 'SUCCESS' ? 'badge badge-success' :
                  p.last_scrape_status === 'RETRY'   ? 'badge badge-warn' :
                                                       'badge badge-error'
                } style={{ fontSize: '.6rem' }}>
                  {p.last_scrape_status}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '.5rem', paddingTop: '.25rem', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={e => handleScrapeNow(e, p)}
                disabled={isScraping}
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: 'center', padding: '.4rem .5rem', fontSize: '.7rem' }}
              >
                {isScraping ? (
                  <><svg className="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9"/></svg> Scraping…</>
                ) : (
                  <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Scrape Now</>
                )}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onSelectProduct(p); }}
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: 'center', padding: '.4rem .5rem', fontSize: '.7rem' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                History
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
