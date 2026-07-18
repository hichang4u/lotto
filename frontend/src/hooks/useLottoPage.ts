import { useState, useEffect, useRef } from 'react';
import type { DrawResult, LottoSet, LottoRuleWeight, LottoBacktestDiagnostics } from '../types';
import {
    API_URL,
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
    const [algorithm, setAlgorithm] = useState<string | null>(null);

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
    const [searchError, setSearchError] = useState('');
    
    // 현재 선택하여 조회 중인 회차 번호 상태
    const [currentDrawNo, setCurrentDrawNo] = useState<number | null>(null);

    // 검색이나 온디맨드 내비게이션으로 로드된 단일 회차 결과 임시 저장소
    const [searchedDraw, setSearchedDraw] = useState<DrawResult | null>(null);

    // 마지막으로 화면에 표시한 회차 (온디맨드 로딩 중에도 카드를 유지하기 위함)
    const lastShownDrawRef = useRef<DrawResult | null>(null);

    const loadResults = async () => {
        setResultsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/results?limit=50`);
            if (res.ok) {
                const data = (await res.json()) as DrawResult[];
                setResults(data);
                // 현재 보고 있는 회차가 미설정 상태라면 목록의 가장 최신 회차로 지정
                if (data.length > 0 && currentDrawNo === null) {
                    setCurrentDrawNo(data[0].drwNo);
                }
            } else {
                setResults([]);
            }
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
            // 동기화 성공 시 새로 받아온 최신 회차 번호로 상태 변경
            if (data.latestDraw) {
                setCurrentDrawNo(data.latestDraw);
            }
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
            setAlgorithm(typeof data.algorithm === 'string' ? data.algorithm : null);
        } catch {
            const fallback = FALLBACK_LABELS.map(label => {
                const s = new Set<number>();
                while (s.size < 6) s.add(Math.floor(Math.random() * 45) + 1);
                return { label, numbers: Array.from(s).sort((a, b) => a - b) };
            });
            setSets(fallback);
            setRuleWeights([]);
            setAlgorithm(null);
        } finally {
            setLoading(false);
        }
    };

    const searchDraw = async () => {
        const no = Number(searchInput);
        if (!no || no < 1) return;
        setSearchError('');

        // 이미 로드된 목록이나 캐싱된 검색 결과에 있다면 바로 번호 상태만 업데이트
        const found = results.find(r => r.drwNo === no);
        if (found) {
            setCurrentDrawNo(no);
            return;
        }
        if (searchedDraw && searchedDraw.drwNo === no) {
            setCurrentDrawNo(no);
            return;
        }

        setResultsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/results?drwNo=${no}`);
            if (!res.ok) { setSearchError(`${no}회차 데이터가 없습니다.`); return; }
            const drawData = await res.json();
            setSearchedDraw(drawData);
            setCurrentDrawNo(no);
        } catch {
            setSearchError('조회 중 오류가 발생했습니다.');
        } finally {
            setResultsLoading(false);
        }
    };

    useEffect(() => {
        loadResults();
        loadBacktestDiagnostics();
    }, []);

    // 회차 번호가 바뀌었을 때, results 목록이나 캐시에 데이터가 없으면 온디맨드로 조회해옴
    useEffect(() => {
        if (!currentDrawNo) return;

        const foundInResults = results.find(r => r.drwNo === currentDrawNo);
        if (foundInResults) return;

        if (searchedDraw && searchedDraw.drwNo === currentDrawNo) return;

        const fetchSingleDraw = async () => {
            setResultsLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/results?drwNo=${currentDrawNo}`);
                if (res.ok) {
                    const drawData = await res.json();
                    setSearchedDraw(drawData);
                } else {
                    // 없는 회차면 무한 로딩에 빠지지 않도록 직전 표시 회차로 복귀
                    setCurrentDrawNo(lastShownDrawRef.current?.drwNo ?? null);
                    setSearchError(`${currentDrawNo}회차 데이터가 없습니다.`);
                }
            } catch {
                // 조회 실패 시에도 직전 표시 회차로 복귀
                setCurrentDrawNo(lastShownDrawRef.current?.drwNo ?? null);
                setSearchError('회차 조회 중 오류가 발생했습니다.');
            } finally {
                setResultsLoading(false);
            }
        };

        fetchSingleDraw();
    }, [currentDrawNo, results, searchedDraw]);

    // 파생 상태
    const resolvedDraw = results.find(r => r.drwNo === currentDrawNo) ||
        (searchedDraw?.drwNo === currentDrawNo ? searchedDraw : null);

    if (resolvedDraw) {
        lastShownDrawRef.current = resolvedDraw;
    }

    const currentDraw = resolvedDraw ?? lastShownDrawRef.current;
    const isStale = !resolvedDraw && currentDraw !== null;
    
    // 전체 목록의 최신 회차 번호
    const maxDrawNo = results[0]?.drwNo ?? 0;
    
    const isLatest = currentDrawNo === maxDrawNo;
    const hasPrevDraw = currentDrawNo !== null && currentDrawNo > 1;
    const hasNextDraw = currentDrawNo !== null && currentDrawNo < maxDrawNo;

    // 이전 회차(더 과거)로 이동 시 번호 1 감소
    const goToPreviousDraw = () => {
        if (hasPrevDraw && currentDrawNo !== null) {
            setCurrentDrawNo(prev => (prev !== null ? prev - 1 : null));
        }
    };

    // 다음 회차(더 최신)로 이동 시 번호 1 증가
    const goToNextDraw = () => {
        if (hasNextDraw && currentDrawNo !== null) {
            setCurrentDrawNo(prev => (prev !== null ? prev + 1 : null));
        }
    };

    return {
        // state
        currentDraw,
        isLatest,
        hasPrevDraw,
        hasNextDraw,
        sets,
        ruleWeights,
        backtestDiagnostics,
        backtestLoading,
        loading,
        algorithm,
        latestDrawNo: maxDrawNo,
        results,
        resultsLoading: resultsLoading || isStale,
        syncLoading,
        syncMessage,
        syncError,
        lastSyncedAt,
        lastSyncedDraw,
        searchInput,
        searchError,
        // actions
        setSearchInput,
        setSearchError,
        setSyncMessage,
        setSyncError,
        syncLatestResults,
        generateNumbers,
        loadBacktestDiagnostics,
        searchDraw,
        goToPreviousDraw,
        goToNextDraw,
    };
}
