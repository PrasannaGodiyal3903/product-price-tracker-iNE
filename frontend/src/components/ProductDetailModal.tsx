import React, { useEffect, useState, useCallback } from 'react';
import { TrackedProduct, PriceHistory, ScrapeLog } from '../types';
import { fetchPriceHistory, fetchScrapeLogs, triggerManualScrape } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Props {
  product: TrackedProduct;
  onClose: () => void;
  onScrapeComplete: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export const ProductDetailModal: React.FC<Props> = ({ product, onClose, onScrapeComplete, onToast }) => {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [tab, setTab] = useState<'history' | 'logs'>('history');

  const loadData = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([
        fetchPriceHistory(product.id),
        fetchScrapeLogs(product.id)
      ]);
      setHistory(h);
      setLogs(l);
    } catch {
      // silently fail — data might not be available yet
    } finally {
      setLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const result = await triggerManualScrape(product.id);
      if (result.success) {
        onToast('Scraped successfully: ' + product.product_name, 'success');
      } else {
        onToast(result.message || 'Scrape completed with issues', 'error');
      }
      await loadData();
      onScrapeComplete();
    } catch (err: any) {
      onToast('Scrape failed: ' + err.message, 'error');
    } finally {
      setScraping(false);
    }
  };

  // Chart data
  const chartData = history.map(h => ({
    time: new Date(h.scraped_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    price: Number(h.price),
    stock: h.stock_status
  }));

  const latestPrice = history.length ? Number(history[history.length - 1].price) : null;
  const minPrice = history.length ? Math.min(...history.map(h => Number(h.price))) : null;
  const maxPrice = history.length ? Math.max(...history.map(h => Number(h.price))) : null;
  const inStock = product.latest_stock_status?.toLowerCase().includes('in stock');

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        {/* Modal header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {product.category && (
              <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.35rem' }}>
                {product.category}
              </div>
            )}
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.2 }}>
              {product.product_name}
            </h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', fontSize: '.75rem', color: 'var(--muted)' }}>
              {product.brand && <span>by {product.brand}</span>}
              <a href={product.product_url} target="_blank" rel="noreferrer"
                style={{ color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View on Store
              </a>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '.25rem', color: 'var(--muted)', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--border)' }}>
          {[
            { label: 'Current Price', value: latestPrice ? 'Rs.' + latestPrice.toLocaleString('en-IN') : '—', serif: true },
            { label: 'Min Seen', value: minPrice ? 'Rs.' + minPrice.toLocaleString('en-IN') : '—', serif: true },
            { label: 'Max Seen', value: maxPrice ? 'Rs.' + maxPrice.toLocaleString('en-IN') : '—', serif: true },
            { label: 'Stock', value: product.latest_stock_status || 'Unknown', badge: true, inStock },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '.875rem 1rem',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              background: 'var(--wash)'
            }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.3rem' }}>
                {stat.label}
              </div>
              {stat.badge ? (
                <span className={inStock ? 'badge badge-success' : 'badge badge-error'} style={{ fontSize: '.7rem' }}>
                  {stat.value}
                </span>
              ) : (
                <div style={{ fontFamily: stat.serif ? 'var(--serif)' : 'inherit', fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-.01em' }}>
                  {stat.value}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Scrape button */}
        <div style={{ padding: '.875rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '.8125rem', color: 'var(--muted)' }}>
            {product.last_scraped_at
              ? 'Last scraped: ' + new Date(product.last_scraped_at).toLocaleString('en-IN')
              : 'Not yet scraped'}
          </span>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn btn-primary"
            style={{ padding: '.45rem .875rem', fontSize: '.75rem' }}
          >
            {scraping ? (
              <><svg className="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9"/></svg> Scraping…</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Scrape Now</>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['history', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '.65rem 1.5rem',
                fontSize: '.75rem',
                fontWeight: 700,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                border: 'none',
                borderBottom: t === tab ? '2px solid var(--ink)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                color: t === tab ? 'var(--ink)' : 'var(--muted)',
                marginBottom: -1,
                fontFamily: 'inherit',
              }}
            >
              {t === 'history' ? 'Price History' : 'Scrape Logs'}
              {t === 'history' && history.length > 0 && (
                <span style={{ marginLeft: '.4rem', fontSize: '.6rem', fontFamily: 'var(--mono)', background: 'var(--border)', padding: '.1em .4em' }}>
                  {history.length}
                </span>
              )}
              {t === 'logs' && logs.length > 0 && (
                <span style={{ marginLeft: '.4rem', fontSize: '.6rem', fontFamily: 'var(--mono)', background: 'var(--border)', padding: '.1em .4em' }}>
                  {logs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ minHeight: 300 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
              Loading…
            </div>
          ) : tab === 'history' ? (
            <div>
              {history.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
                  No price history yet. Trigger a scrape to record the first data point.
                </div>
              ) : (
                <>
                  {/* Chart */}
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.75rem' }}>
                      Price Over Time (Rs.)
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false}
                          tickFormatter={v => 'Rs.' + Number(v).toLocaleString('en-IN')} width={72} />
                        <Tooltip
                          formatter={(v: any) => ['Rs.' + Number(v).toLocaleString('en-IN'), 'Price']}
                          contentStyle={{ border: '1px solid var(--border)', background: 'var(--white)', fontSize: 12, borderRadius: 0 }}
                          labelStyle={{ fontWeight: 700, fontSize: 11 }}
                        />
                        <Line type="monotone" dataKey="price" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3, fill: 'var(--ink)' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* History table */}
                  <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78125rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--wash)' }}>
                          {['Date & Time', 'Price', 'Stock Status', 'Qty'].map(h => (
                            <th key={h} style={{ padding: '.5rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '.65rem', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...history].reverse().map((h, i) => (
                          <tr key={h.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--white)' : 'var(--wash)' }}>
                            <td style={{ padding: '.5rem 1rem', fontFamily: 'var(--mono)', fontSize: '.7rem', color: 'var(--muted)' }}>
                              {new Date(h.scraped_at).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '.5rem 1rem', fontWeight: 700, fontFamily: 'var(--serif)' }}>
                              Rs.{Number(h.price).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '.5rem 1rem' }}>
                              <span className={h.stock_status.toLowerCase().includes('in stock') ? 'badge badge-success' : 'badge badge-error'} style={{ fontSize: '.6rem' }}>
                                {h.stock_status}
                              </span>
                            </td>
                            <td style={{ padding: '.5rem 1rem', fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: '.7rem' }}>
                              {h.stock_quantity ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Logs tab */
            <div>
              {logs.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
                  No scrape logs yet.
                </div>
              ) : (
                <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                  {logs.map((log, i) => (
                    <div key={log.id} style={{
                      padding: '.875rem 1.5rem',
                      borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                      background: i % 2 === 0 ? 'var(--white)' : 'var(--wash)',
                      display: 'flex', gap: '1rem', alignItems: 'flex-start'
                    }}>
                      <div style={{ flexShrink: 0, paddingTop: '.1rem' }}>
                        <span className={
                          log.status === 'SUCCESS' ? 'badge badge-success' :
                          log.status === 'RETRY'   ? 'badge badge-warn' :
                                                     'badge badge-error'
                        } style={{ fontSize: '.6rem' }}>
                          {log.status}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.78125rem', color: 'var(--ink)', marginBottom: '.25rem', lineHeight: 1.4 }}>
                          {log.message}
                        </div>
                        <div style={{ fontSize: '.7rem', color: 'var(--muted)', fontFamily: 'var(--mono)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span>Attempt #{log.attempt_number}</span>
                          <span>{log.duration_ms}ms</span>
                          {log.error_type && <span style={{ color: 'var(--error)' }}>{log.error_type}</span>}
                          <span>{new Date(log.started_at).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
