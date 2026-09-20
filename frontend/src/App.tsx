import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SearchBar } from './components/SearchBar';
import { TrackedList } from './components/TrackedList';
import { ProductDetailModal } from './components/ProductDetailModal';
import { Toast, ToastMessage } from './components/Toast';
import { TrackedProduct } from './types';
import { fetchTrackedProducts } from './api';

let toastId = 0;

export default function App() {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<TrackedProduct | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchTrackedProducts();
      setProducts(data);
    } catch (err: any) {
      addToast('Failed to load products: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProducts();
  };

  const trackedUrlsSet = new Set(products.map(p => p.product_url.toLowerCase()));

  // Sync selected product with latest data after refresh
  useEffect(() => {
    if (selectedProduct) {
      const updated = products.find(p => p.id === selectedProduct.id);
      if (updated) setSelectedProduct(updated);
    }
  }, [products]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--wash)' }}>
      <Navbar onRefresh={handleRefresh} isRefreshing={isRefreshing} productCount={products.length} />

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Search & discover */}
        <SearchBar
          onProductTracked={loadProducts}
          alreadyTrackedUrls={trackedUrlsSet}
          onToast={addToast}
        />

        {/* Tracked products section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-.01em' }}>
                Tracked Products
              </h2>
              <p style={{ margin: '.2rem 0 0', fontSize: '.78125rem', color: 'var(--muted)' }}>
                Live prices and stock from the INE mock store. Scraped on demand or via scheduled cron.
              </p>
            </div>
            {products.length > 0 && (
              <span style={{ fontSize: '.7rem', color: 'var(--muted)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                {products.filter(p => p.latest_price !== null).length}/{products.length} with price data
              </span>
            )}
          </div>

          {loading ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
              <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 1rem', display: 'block' }}>
                <path d="M21 12a9 9 0 1 1-9-9"/>
              </svg>
              Loading tracked products…
            </div>
          ) : (
            <TrackedList
              products={products}
              onSelectProduct={setSelectedProduct}
              onRefresh={loadProducts}
              onToast={addToast}
            />
          )}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 1.5rem', textAlign: 'center', background: 'var(--white)' }}>
        <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>
          INE Software Engineer Assignment · Product Price Tracker ·{' '}
          <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer"
            style={{ color: 'var(--ink)', fontWeight: 600 }}>demo.inelabteamdev.com</a>
        </span>
      </footer>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onScrapeComplete={loadProducts}
          onToast={addToast}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
