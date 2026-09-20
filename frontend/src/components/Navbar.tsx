import React from 'react';

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  productCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh, isRefreshing, productCount }) => {
  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--white)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '.625rem', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>
            ◧ INE Store
          </span>
          <span style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, paddingTop: 2 }}>
            Price Tracker
          </span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {productCount > 0 && (
            <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              {productCount} product{productCount !== 1 ? 's' : ''} tracked
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-ghost"
            style={{ padding: '.3rem .7rem', fontSize: '.7rem', gap: '.35rem' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={isRefreshing ? 'spin' : ''}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            </svg>
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
};
