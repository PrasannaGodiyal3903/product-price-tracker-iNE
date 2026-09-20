import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CatalogItem } from '../types';
import { CatalogSearchResult, searchCatalog, trackProduct } from '../api';

interface Props {
  onProductTracked: () => void;
  alreadyTrackedUrls: Set<string>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const DEFAULT_CATEGORIES = [
  'Audio',
  'Bags',
  'Footwear',
  'Kitchen',
  'Laptops',
  'Monitors',
  'Peripherals',
  'Power',
  'Smart Home',
  'Wearables'
];

export const SearchBar: React.FC<Props> = ({ onProductTracked, alreadyTrackedUrls, onToast }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchReqIdRef = useRef(0);

  // Perform search with race-condition prevention
  const executeSearch = useCallback(async (q: string, cat: string) => {
    const trimmed = q.trim();

    // Empty query and no category: clean state, do not spam API
    if (!trimmed && !cat) {
      setResult(null);
      setLoading(false);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    const currentReqId = ++searchReqIdRef.current;
    setLoading(true);
    setSearchError(null);

    try {
      const data = await searchCatalog(trimmed, cat, 1, 40);
      // Only commit if this request is still the latest one
      if (currentReqId === searchReqIdRef.current) {
        setResult(data);
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
        setHasSearched(true);
      }
    } catch (err: any) {
      if (currentReqId === searchReqIdRef.current) {
        setSearchError(err.message || 'Failed to search catalog');
        onToast(err.message || 'Search failed', 'error');
      }
    } finally {
      if (currentReqId === searchReqIdRef.current) {
        setLoading(false);
      }
    }
  }, [onToast]);

  // Debounce search while typing (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(query, category);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, category, executeSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, category);
  };

  const handleCategoryToggle = (cat: string) => {
    setCategory(prev => (prev === cat ? '' : cat));
  };

  const handleClearSearch = () => {
    setQuery('');
    setCategory('');
    setResult(null);
    setHasSearched(false);
    setSearchError(null);
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
      onToast('Started tracking ' + item.name, 'success');
      onProductTracked();
    } catch (err: any) {
      onToast(err.message || 'Could not track product', 'error');
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <section className="card" style={{ marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-.01em' }}>
          Search Mock Store Catalog
        </h2>
        <p style={{ margin: '.25rem 0 0', fontSize: '.8125rem', color: 'var(--muted)' }}>
          Search real products by partial product name, brand, or SKU from{' '}
          <a
            href="https://demo.inelabteamdev.com/"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline' }}
          >
            demo.inelabteamdev.com
          </a>
        </p>
      </div>

      {/* Search Input Box */}
      <div style={{ padding: '1.25rem 1.5rem 0.75rem' }}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Search by product name, brand, or SKU (e.g. "auralite", "aur", "wireless", "HEL-10620")…'
              style={{
                width: '100%',
                padding: '.625rem .875rem .625rem 2.25rem',
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
            {/* Search icon inside input */}
            <div
              style={{
                position: 'absolute',
                left: '.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}
            >
              {loading ? (
                <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              )}
            </div>

            {/* Clear button if input has text */}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Clear input"
                style={{
                  position: 'absolute',
                  right: '.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: '.25rem',
                  fontSize: '.75rem'
                }}
              >
                ✕
              </button>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ gap: '.375rem' }}>
            {loading ? (
              <>
                <svg className="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                </svg>
                Searching…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Search
              </>
            )}
          </button>
        </form>

        {/* Category Pills Filter */}
        <div style={{ marginTop: '.875rem', display: 'flex', flexWrap: 'wrap', gap: '.375rem', alignItems: 'center' }}>
          <span style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginRight: '.25rem' }}>
            Categories:
          </span>
          <button
            type="button"
            onClick={() => setCategory('')}
            style={{
              padding: '.2rem .6rem',
              fontSize: '.65rem',
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              border: '1px solid',
              cursor: 'pointer',
              background: !category ? 'var(--ink)' : 'transparent',
              color: !category ? 'var(--white)' : 'var(--muted)',
              borderColor: !category ? 'var(--ink)' : 'var(--border)',
              fontFamily: 'inherit',
              transition: 'all .12s'
            }}
          >
            All
          </button>
          {categories.map(cat => {
            const active = category.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryToggle(cat)}
                style={{
                  padding: '.2rem .6rem',
                  fontSize: '.65rem',
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  border: '1px solid',
                  cursor: 'pointer',
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--white)' : 'var(--muted)',
                  borderColor: active ? 'var(--ink)' : 'var(--border)',
                  fontFamily: 'inherit',
                  transition: 'all .12s'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state */}
      {searchError && (
        <div style={{ margin: '.5rem 1.5rem 1rem', padding: '.75rem 1rem', background: '#fdf0ef', border: '1px solid #f5c6c2', color: 'var(--error)', fontSize: '.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{searchError}</span>
          <button onClick={() => executeSearch(query, category)} className="btn btn-ghost" style={{ padding: '.2rem .5rem', fontSize: '.7rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Results Header / Loading Bar */}
      {loading && !result && (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
          <svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-9-9" />
          </svg>
          Searching catalog for real products…
        </div>
      )}

      {/* When empty / prompt state */}
      {!loading && !hasSearched && !result && (
        <div style={{ padding: '1.25rem 1.5rem 1.5rem', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: '.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            Search supports partial product names (e.g. <code>auralite</code>, <code>aur</code>), brands, and SKUs (e.g. <code>HEL-10620</code>).
          </span>
          <span style={{ fontSize: '.7rem', fontFamily: 'var(--mono)' }}>
            Real-time typing search enabled
          </span>
        </div>
      )}

      {/* When results are present */}
      {result && (
        <>
          <div
            style={{
              padding: '.5rem 1.5rem',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--wash)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '.75rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {result.total.toLocaleString()} {result.total === 1 ? 'Product found' : 'Products found'}
              {category ? ' in ' + category : ''}
              {query ? ' for "' + query.trim() + '"' : ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              {result.total > result.items.length && (
                <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
                  Showing first {result.items.length} of {result.total}
                </span>
              )}
              {(query || category) && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="btn btn-ghost"
                  style={{ padding: '.15rem .45rem', fontSize: '.65rem' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {result.items.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '.9375rem', fontWeight: 700, color: 'var(--ink)' }}>
                  No products found
                </div>
                <p style={{ margin: '.35rem 0 0', fontSize: '.8125rem', color: 'var(--muted)' }}>
                  No catalog items match <strong>"{query.trim() || category}"</strong>. Check for typos or try broader keywords like "watch", "keyboard", "audio", or "case".
                </p>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="btn btn-ghost"
                  style={{ marginTop: '1rem', fontSize: '.75rem' }}
                >
                  Reset Search
                </button>
              </div>
            ) : (
              result.items.map((item, idx) => {
                const isTracked = alreadyTrackedUrls.has(item.product_url.toLowerCase());
                const isTracking = trackingId === item.id;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '.875rem 1.5rem',
                      borderBottom: idx < result.items.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      background: 'var(--white)',
                      transition: 'background .1s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--wash)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '.875rem',
                            fontWeight: 600,
                            color: 'var(--ink)',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {item.name}
                        </a>
                        <span
                          style={{
                            fontSize: '.625rem',
                            fontFamily: 'var(--mono)',
                            color: 'var(--muted)',
                            background: 'var(--wash)',
                            padding: '.1em .4em',
                            border: '1px solid var(--border)'
                          }}
                        >
                          {item.sku}
                        </span>
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem', display: 'flex', gap: '.5rem' }}>
                        <span>{item.brand}</span>
                        <span>·</span>
                        <span style={{ fontStyle: 'italic' }}>{item.category}</span>
                      </div>
                    </div>

                    {isTracked ? (
                      <span className="badge badge-success" style={{ whiteSpace: 'nowrap' }}>
                        ✓ Tracked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTrack(item)}
                        disabled={isTracking}
                        className="btn btn-ghost"
                        style={{ padding: '.35rem .75rem', whiteSpace: 'nowrap', fontSize: '.7rem' }}
                      >
                        {isTracking ? (
                          <>
                            <svg className="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 12a9 9 0 1 1-9-9" />
                            </svg>
                            Tracking…
                          </>
                        ) : (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Track
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
};
