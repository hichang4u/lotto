import { useState, useEffect } from 'react';
import type { DrawResult, LottoSet, LottoRuleWeight, LottoBacktestDiagnostics } from '../types';
import {
    API_URL,
    PAGE_SIZE,
    FALLBACK_LABELS,
    LAST_SYNC_STORAGE_KEY,
    LAST_SYNC_DRAW_STORAGE_KEY,
} from '../constants';

export function useLottoPage() {
    const [sets, setSets] = useState<LottoSet[]>([]);
    const [ruleWeights, setRuleWeights] = useState<LottoRuleWeight[]>([]);
    const [backtestDiagnostics, setBacktestDiagnostics] = useState<LottoBacktestDiagnostics | null>(null);
    const [backtestLoading, setBacktestLoading] = useState(false);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState<DrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    const [syncLoading, setSyncLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [syncError, setSyncError] = useState('');
    const [lastSyncedDraw, setLastSyncedDraw] = useState<number | null>(() => {
        const saved = localStorage.getItem(LAST_SYNC_DRAW_STORAGE_KEY);
        if (!saved) return null;
        const parsed = Number(saved);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    });
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
        const saved = localStorage.getItem(LAST_SYNC_STORAGE_KEY);
        if (!saved) return null;
        const parsed = new Date(saved);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    });

    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<DrawResult | null>(null);
    const [searchError, setSearchError] = useState('');
    const [page, setPage] = useState(0);

    const loadResults = async () => {
        setResultsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/results?limit=50`);
            setResults(res.ok ? await res.json() : []);
        } catch {
            setResults([]);
        } finally {
            setResultsLoading(false);
        }
    };

    const loadBacktestDiagnostics = async () => {
        setBacktestLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/generate/backtest?draws=120`);
            if (!res.ok) throw new Error();
            setBacktestDiagnostics(await res.json());
        } catch {
            setBacktestDiagnostics(null);
        } finally {
            setBacktestLoading(false);
        }
    };

    const syncLatestResults = async (
        onMessage: (msg: string) => void,
        onError: (err: string) => void,
    ) => {
        setSyncLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/sync`, { method: 'POST' });
            const data = await res.json() as { success?: boolean; syncedCount?: number; latestDraw?: number; error?: string };
            if (!res.ok || !data.success) throw new Error(data.error || '동기화에 실패했습니다.');

            await loadResults();
            const now = new Date();
            setLastSyncedAt(now);
            setLastSyncedDraw(data.latestDraw ?? null);
            localStorage.setItem(LAST_SYNC_STORAGE_KEY, now.toISOString());
            if (data.latestDraw) localStorage.setItem(LAST_SYNC_DRAW_STORAGE_KEY, String(data.latestDraw));

            onMessage(
                data.syncedCount && data.syncedCount > 0
                    ? `${data.syncedCount}개 회차를 새로 가져왔습니다. 최신 ${data.latestDraw}회까지 반영됐어요.`
                    : `이미 최신 상태입니다. 현재 ${data.latestDraw}회까지 반영되어 있어요.`,
            );
        } catch (error) {
            onError(error instanceof Error ? error.message : '동기화 중 오류가 발생했습니다.');
        } finally {
            setSyncLoading(false);
        }
    };

    const generateNumbers = async () => {
        setLoading(true);
        setSets([]);
        setRuleWeights([]);
        try {
            const res = await fetch(`${API_URL}/api/generate`, { method: 'POST' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setSets(data.sets);
            setRuleWeights(Array.isArray(data.ruleWeights) ? data.ruleWeights : []);
        } catch {
            const fallback = FALLBACK_LABELS.map(label => {
                const s = new Set<number>();
                while (s.size < 6) s.add(Math.floor(Math.random() * 45) + 1);
                return { label, numbers: Array.from(s).sort((a, b) => a - b) };
            });
            setSets(fallback);
            setRuleWeights([]);
        } finally {
            setLoading(false);
        }
    };

    const searchDraw = async () => {
        const no = Number(searchInput);
        if (!no || no < 1) return;
        setSearchError('');
        setSearchResult(null);
        try {
            const res = await fetch(`${API_URL}/api/results?drwNo=${no}`);
            if (!res.ok) { setSearchError(`${no}회차 데이터가 없습니다.`); return; }
            setSearchResult(await res.json());
        } catch {
            setSearchError('조회 중 오류가 발생했습니다.');
        }
    };

    const scrollToLookupSection = () => {
        document.getElementById('lookup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    useEffect(() => {
        loadResults();
        loadBacktestDiagnostics();
    }, []);

    // 파생 상태
    const latestDraw = results[0] ?? null;
    const totalPages = Math.ceil(Math.max(results.length - 1, 0) / PAGE_SIZE);
    const pagedResults = results.slice(1).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    return {
        // state
        latestDraw,
        sets,
        ruleWeights,
        backtestDiagnostics,
        backtestLoading,
        loading,
        results,
        resultsLoading,
        syncLoading,
        syncMessage,
        syncError,
        lastSyncedAt,
        lastSyncedDraw,
        searchInput,
        searchResult,
        searchError,
        page,
        totalPages,
        pagedResults,
        // actions
        setSearchInput,
        setSearchResult,
        setSearchError,
        setPage,
        setSyncMessage,
        setSyncError,
        syncLatestResults,
        generateNumbers,
        loadBacktestDiagnostics,
        searchDraw,
        scrollToLookupSection,
    };
}
