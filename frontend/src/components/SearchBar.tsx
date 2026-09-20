import React, { useState } from 'react';
import { CatalogItem } from '../types';
import { CatalogSearchResult, searchCatalog, trackProduct } from '../api';

interface Props {
  onProductTracked: () => void;
  alreadyTrackedUrls: Set<string>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export const SearchBar: React.FC<Props> = ({ onProductTracked, alreadyTrackedUrls, onToast }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string, cat: string) => {
    setLoading(true);
    try {
      const data = await searchCatalog(q, cat, 1, 40);
      setResult(data);
      setSearched(true);
    } catch (err: any) {
      onToast(err.message || 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, category);
  };

  const handleCategoryClick = (cat: string) => {
    setCategory(cat);
    doSearch(query, cat);
  };

  const handleTrack = async (item: CatalogItem) => {
    setTrackingId(item.id);
    try {
      await trackProduct({
        product_name: item.name,
        product_url: item.product_url,
        external_product_id: item.id,
        category: item.category,
        brand: item.brand
      });
      onToast('Now tracking ' + item.name, 'success');
      onProductTracked();
    } catch (err: any) {
      onToast(err.message || 'Could not track product', 'error');
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <section className="card">
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: '.9375rem', fontWeight: 700, letterSpacing: '-.01em' }}>
          Search Product Catalog
        </h2>
        <p style={{ margin: '.2rem 0 0', fontSize: '.78125rem', color: 'var(--muted)' }}>
          Discover products from{' '}
          <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer"
            style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline', textDecorationThickness: 1 }}>
            demo.inelabteamdev.com
          </a>{' '}
          — 1,000 real products, all categories
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} style={{ padding: '1rem 1.5rem', display: 'flex', gap: '.5rem' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search by name, brand, or SKU  (e.g. "Ironwood", "Keyboard", "AUR-10540")'
          style={{
            flex: 1,
            padding: '.5875rem .875rem',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            color: 'var(--ink)',
            fontSize: '.875rem',
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color .15s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--ink)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ gap: '.375rem' }}>
          {loading ? (
            <svg className="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          )}
          Search
        </button>
      </form>

      {/* Category pills */}
      {result && result.categories.length > 0 && (
        <div style={{ padding: '.25rem 1.5rem .875rem', display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}>
          {['', ...result.categories].map(cat => {
            const active = cat === category;
            return (
              <button key={cat || '__all__'}
                onClick={() => handleCategoryClick(cat)}
                style={{
                  padding: '.175rem .55rem',
                  fontSize: '.65rem',
                  fontWeight: 700,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  border: '1px solid',
                  cursor: 'pointer',
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--white)' : 'var(--muted)',
                  borderColor: active ? 'var(--ink)' : 'var(--border)',
                  fontFamily: 'inherit',
                  transition: 'all .12s',
                }}
              >
                {cat || 'All'}
              </button>
            );
          })}
        </div>
      )}

      {/* Results list */}
      {result && (
        <>
          <div style={{ padding: '.45rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--wash)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {result.total.toLocaleString()} result{result.total !== 1 ? 's' : ''}{category ? ' · ' + category : ''}
            </span>
            {result.total > result.items.length && (
              <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
                Showing {result.items.length} of {result.total}
              </span>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {result.items.length === 0 && searched ? (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
                No products found. Try different keywords.
              </div>
            ) : result.items.map((item, idx) => {
              const isTracked = alreadyTrackedUrls.has(item.product_url.toLowerCase());
              const isTracking = trackingId === item.id;
              return (
                <div key={item.id}
                  style={{
                    padding: '.75rem 1.5rem',
                    borderBottom: idx < result.items.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    background: 'var(--white)',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--wash)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                      <a href={item.product_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: '.875rem', fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {item.name}
                      </a>
                      <span style={{ fontSize: '.6rem', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{item.sku}</span>
                    </div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.15rem' }}>
                      {item.brand} · <em>{item.category}</em>
                    </div>
                  </div>

                  {isTracked ? (
                    <span className="badge badge-success">✓ Tracked</span>
                  ) : (
                    <button
                      onClick={() => handleTrack(item)}
                      disabled={isTracking}
                      className="btn btn-ghost"
                      style={{ padding: '.3rem .65rem', whiteSpace: 'nowrap', fontSize: '.7rem' }}
                    >
                      {isTracking
                        ? <svg className="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9"/></svg>
                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                      }
                      Track
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
