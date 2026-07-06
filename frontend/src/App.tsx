import { useState, useEffect } from 'react';
import type { PageKey } from './types';
import { getPageFromPath } from './constants';
import { LottoPage } from './components/lotto/LottoPage';
import { PensionPage } from './components/pension/PensionPage';

function App() {
    const [activePage, setActivePage] = useState<PageKey>(() => getPageFromPath(window.location.pathname));
    const [syncMessage, setSyncMessage] = useState('');
    const [syncError, setSyncError] = useState('');

    // popstate 기반 라우팅 처리
    useEffect(() => {
        const handleLocationChange = () => {
            setActivePage(getPageFromPath(window.location.pathname));
        };
        window.addEventListener('popstate', handleLocationChange);
        handleLocationChange();
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    // toast 자동 소멸 타이머
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
        <div className="min-h-screen text-black">
            <div className="app-shell relative overflow-hidden">
                {/* 네오 브루탈리즘 스타일 공통 Toast */}
                {(syncMessage || syncError) && (
                    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(92vw,380px)]">
                        <div 
                            className={`border-3 border-black p-4 text-sm font-extrabold shadow-[4px_4px_0px_0px_#000000] rounded-xl ${
                                syncError ? 'bg-[#ff6b6b] text-black' : 'bg-[#22c55e] text-black'
                            }`}
                        >
                            {syncError || syncMessage}
                        </div>
                    </div>
                )}

                {/* 헤더 영역 경계선 블랙 실선 적용 */}
                <header className="relative border-b-3 border-black bg-white/95">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                            <img
                                src="/images/logo_dong.svg"
                                alt="동행복권"
                                className="header-brand-logo"
                            />
                            {/* 네비게이션 메뉴 */}
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

                {/* 메인 레이아웃 */}
                <main className="relative mx-auto max-w-5xl px-6 py-10 sm:px-8 lg:px-12">
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
