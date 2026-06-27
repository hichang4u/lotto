import { useState, useEffect } from 'react';
import type { PageKey } from './types';
import { getPageFromPath } from './constants';
import { LottoPage } from './components/lotto/LottoPage';
import { PensionPage } from './components/pension/PensionPage';

function App() {
    const [activePage, setActivePage] = useState<PageKey>(() => getPageFromPath(window.location.pathname));
    const [syncMessage, setSyncMessage] = useState('');
    const [syncError, setSyncError] = useState('');

    // popstate 기반 라우팅
    useEffect(() => {
        const handleLocationChange = () => {
            setActivePage(getPageFromPath(window.location.pathname));
        };
        window.addEventListener('popstate', handleLocationChange);
        handleLocationChange();
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    // toast 자동 소멸
    useEffect(() => {
        if (!syncMessage && !syncError) return;
        const timeout = window.setTimeout(() => {
            setSyncMessage('');
            setSyncError('');
        }, 3500);
        return () => window.clearTimeout(timeout);
    }, [syncMessage, syncError]);

    const navigateToPage = (page: PageKey) => {
        const nextPath = page === 'pension' ? '/pension' : '/lotto';
        if (window.location.pathname !== nextPath) {
            window.history.pushState({}, '', nextPath);
        }
        setActivePage(page);
    };

    return (
        <div className="min-h-screen text-slate-900">
            <div className="app-shell relative overflow-hidden">
                {/* 공통 Toast */}
                {(syncMessage || syncError) && (
                    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(92vw,420px)]">
                        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl ${syncError ? 'border-rose-200 bg-rose-50/95 text-rose-700' : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'}`}>
                            {syncError || syncMessage}
                        </div>
                    </div>
                )}

                {/* 헤더 */}
                <header className="relative border-b border-slate-200/70 bg-white/95">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5 sm:px-6 sm:py-3 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                            <img
                                src="/images/logo_dong.svg"
                                alt="동행복권"
                                className="header-brand-logo"
                            />
                            <nav className="header-nav" aria-label="복권 메뉴">
                                <button
                                    type="button"
                                    aria-current={activePage === 'lotto' ? 'page' : undefined}
                                    className={`header-nav-link ${activePage === 'lotto' ? 'is-active' : ''}`}
                                    onClick={() => navigateToPage('lotto')}
                                >
                                    로또6/45
                                </button>
                                <button
                                    type="button"
                                    aria-current={activePage === 'pension' ? 'page' : undefined}
                                    className={`header-nav-link ${activePage === 'pension' ? 'is-active' : ''}`}
                                    onClick={() => navigateToPage('pension')}
                                >
                                    연금복권720+
                                </button>
                            </nav>
                        </div>
                    </div>
                </header>

                {/* 메인 */}
                <main className="relative mx-auto max-w-7xl px-5 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
                    {activePage === 'lotto' ? (
                        <LottoPage
                            onSyncMessage={setSyncMessage}
                            onSyncError={setSyncError}
                        />
                    ) : (
                        <PensionPage
                            onSyncMessage={setSyncMessage}
                            onSyncError={setSyncError}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
