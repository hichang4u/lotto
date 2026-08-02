import { useState, useEffect, useRef } from 'react';
import type {
    PensionDrawResult,
    PensionRecommendationSet,
    PensionRuleWeight,
    PensionBacktestDiagnostics,
} from '../types';
import {
    API_URL,
    PENSION_LAST_SYNC_STORAGE_KEY,
    PENSION_LAST_SYNC_DRAW_STORAGE_KEY,
} from '../constants';

export function usePensionPage() {
    const [results, setResults] = useState<PensionDrawResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [pensionError, setPensionError] = useState('');
    const [pensionSyncLoading, setPensionSyncLoading] = useState(false);
    const [pensionGenerateLoading, setPensionGenerateLoading] = useState(false);
    const [pensionRecommendations, setPensionRecommendations] = useState<PensionRecommendationSet[]>([]);
    const [pensionFeaturedRecommendation, setPensionFeaturedRecommendation] = useState<PensionRecommendationSet | null>(null);
    const [pensionRuleWeights, setPensionRuleWeights] = useState<PensionRuleWeight[]>([]);
    const [pensionBacktestDiagnostics, setPensionBacktestDiagnostics] = useState<PensionBacktestDiagnostics | null>(null);
    const [pensionBacktestLoading, setPensionBacktestLoading] = useState(false);
    const [pensionAlgorithm, setPensionAlgorithm] = useState<string | null>(null);
    const [pensionSearchInput, setPensionSearchInput] = useState('');
    const [pensionSearchError, setPensionSearchError] = useState('');
    
    // 현재 선택하여 조회 중인 회차 번호 상태
    const [currentDrawNo, setCurrentDrawNo] = useState<number | null>(null);

    // 검색이나 온디맨드 내비게이션으로 로드된 단일 연금복권 회차 결과 임시 저장소
    const [searchedDraw, setSearchedDraw] = useState<PensionDrawResult | null>(null);

    // 마지막으로 화면에 표시한 회차 (온디맨드 로딩 중에도 카드를 유지하기 위함)
    const lastShownDrawRef = useRef<PensionDrawResult | null>(null);

    const [lastSyncedDraw, setLastSyncedDraw] = useState<number | null>(() => {
        const saved = localStorage.getItem(PENSION_LAST_SYNC_DRAW_STORAGE_KEY);
        if (!saved) return null;
        const parsed = Number(saved);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    });
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
        const saved = localStorage.getItem(PENSION_LAST_SYNC_STORAGE_KEY);
        if (!saved) return null;
        const parsed = new Date(saved);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    });

    const loadPensionResults = async () => {
        setResultsLoading(true);
        setPensionError('');
        try {
            const res = await fetch(`${API_URL}/api/pension/results?limit=50`);
            if (!res.ok) {
                setPensionError('연금복권 결과를 불러오지 못했습니다.');
                setResults([]);
                return;
            }
            const data = await res.json();
            const list = Array.isArray(data) ? data : data ? [data] : [];

            setResults(list);
            // 현재 보고 있는 회차가 미설정 상태라면 목록의 가장 최신 회차로 지정
            if (list.length > 0 && currentDrawNo === null) {
                setCurrentDrawNo(list[0].draw_no);
            }
        } catch {
            setPensionError('연금복권 결과 조회 중 오류가 발생했습니다.');
            setResults([]);
        } finally {
            setResultsLoading(false);
        }
    };

    const loadPensionBacktestDiagnostics = async () => {
        setPensionBacktestLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/generate/backtest?draws=120`);
            if (!res.ok) throw new Error();
            setPensionBacktestDiagnostics(await res.json());
        } catch {
            setPensionBacktestDiagnostics(null);
        } finally {
            setPensionBacktestLoading(false);
        }
    };

    const syncLatestPensionResults = async (
        onMessage: (msg: string) => void,
        onError: (err: string) => void,
    ) => {
        setPensionSyncLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/sync`, { method: 'POST' });
            const data = await res.json() as { success?: boolean; syncedCount?: number; latestDraw?: number; error?: string };
            if (!res.ok || !data.success) throw new Error(data.error || '연금복권 동기화에 실패했습니다.');

            await loadPensionResults();
            // 동기화 성공 시 새로 받아온 최신 회차 번호로 상태 변경
            if (data.latestDraw) {
                setCurrentDrawNo(data.latestDraw);
            }
            const now = new Date();
            setLastSyncedAt(now);
            setLastSyncedDraw(data.latestDraw ?? null);
            localStorage.setItem(PENSION_LAST_SYNC_STORAGE_KEY, now.toISOString());
            if (data.latestDraw) localStorage.setItem(PENSION_LAST_SYNC_DRAW_STORAGE_KEY, String(data.latestDraw));

            onMessage(
                data.syncedCount && data.syncedCount > 0
                    ? `${data.syncedCount}개 연금복권 회차를 새로 가져왔습니다. 최신 ${data.latestDraw}회까지 반영됐어요.`
                    : `연금복권은 이미 최신 상태입니다. 현재 ${data.latestDraw}회까지 반영되어 있어요.`,
            );
        } catch (error) {
            onError(error instanceof Error ? error.message : '연금복권 동기화 중 오류가 발생했습니다.');
        } finally {
            setPensionSyncLoading(false);
        }
    };

    const generatePensionNumbers = async () => {
        setPensionGenerateLoading(true);
        setPensionRecommendations([]);
        setPensionFeaturedRecommendation(null);
        setPensionRuleWeights([]);
        setPensionAlgorithm(null);
        try {
            const res = await fetch(`${API_URL}/api/pension/generate`, { method: 'POST' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPensionRecommendations(Array.isArray(data.sets) ? data.sets : []);
            setPensionFeaturedRecommendation(data.featuredSet && typeof data.featuredSet === 'object' ? data.featuredSet : null);
            setPensionRuleWeights(Array.isArray(data.ruleWeights) ? data.ruleWeights : []);
            setPensionAlgorithm(typeof data.algorithm === 'string' ? data.algorithm : null);
        } catch {
            setPensionRecommendations([]);
            setPensionFeaturedRecommendation(null);
            setPensionRuleWeights([]);
            setPensionAlgorithm(null);
        } finally {
            setPensionGenerateLoading(false);
        }
    };

    const searchPensionDraw = async () => {
        const no = Number(pensionSearchInput);
        if (!no || no < 1) return;
        setPensionSearchError('');

        // 이미 로드된 목록이나 캐싱된 검색 결과에 있다면 바로 번호 상태만 업데이트
        const found = results.find(r => r.draw_no === no);
        if (found) {
            setCurrentDrawNo(no);
            return;
        }
        if (searchedDraw && searchedDraw.draw_no === no) {
            setCurrentDrawNo(no);
            return;
        }

        setResultsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/results?drawNo=${no}`);
            if (!res.ok) { setPensionSearchError(`${no}회차 데이터가 없습니다.`); return; }
            const drawData = await res.json();
            setSearchedDraw(drawData);
            setCurrentDrawNo(no);
        } catch {
            setPensionSearchError('조회 중 오류가 발생했습니다.');
        } finally {
            setResultsLoading(false);
        }
    };

    const clearPensionSearch = () => {
        setPensionSearchInput('');
        setPensionSearchError('');
    };

    useEffect(() => {
        loadPensionResults();
        loadPensionBacktestDiagnostics();
    }, []);

    // 회차 번호가 바뀌었을 때, results 목록이나 캐시에 데이터가 없으면 온디맨드로 조회해옴
    useEffect(() => {
        if (!currentDrawNo) return;

        const foundInResults = results.find(r => r.draw_no === currentDrawNo);
        if (foundInResults) return;

        if (searchedDraw && searchedDraw.draw_no === currentDrawNo) return;

        const fetchSingleDraw = async () => {
            setResultsLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/pension/results?drawNo=${currentDrawNo}`);
                if (res.ok) {
                    const drawData = await res.json();
                    setSearchedDraw(drawData);
                } else {
                    // 없는 회차면 무한 로딩에 빠지지 않도록 직전 표시 회차로 복귀
                    setCurrentDrawNo(lastShownDrawRef.current?.draw_no ?? null);
                    setPensionSearchError(`${currentDrawNo}회차 데이터가 없습니다.`);
                }
            } catch {
                // 조회 실패 시에도 직전 표시 회차로 복귀
                setCurrentDrawNo(lastShownDrawRef.current?.draw_no ?? null);
                setPensionSearchError('회차 조회 중 오류가 발생했습니다.');
            } finally {
                setResultsLoading(false);
            }
        };

        fetchSingleDraw();
    }, [currentDrawNo, results, searchedDraw]);

    // 파생 상태
    const resolvedDraw = results.find(r => r.draw_no === currentDrawNo) ||
        (searchedDraw?.draw_no === currentDrawNo ? searchedDraw : null);

    if (resolvedDraw) {
        lastShownDrawRef.current = resolvedDraw;
    }

    const currentPensionDraw = resolvedDraw ?? lastShownDrawRef.current;
    const isStale = !resolvedDraw && currentPensionDraw !== null;
    
    // 전체 목록의 최신 회차 번호
    const maxDrawNo = results[0]?.draw_no ?? 0;
    
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
        currentPensionDraw,
        resultsLoading: resultsLoading || isStale,
        pensionError,
        pensionSyncLoading,
        pensionGenerateLoading,
        pensionRecommendations,
        pensionFeaturedRecommendation,
        pensionRuleWeights,
        pensionBacktestDiagnostics,
        pensionBacktestLoading,
        pensionAlgorithm,
        maxDrawNo,
        pensionSearchInput,
        pensionSearchError,
        isLatest,
        hasPrevDraw,
        hasNextDraw,
        lastSyncedAt,
        lastSyncedDraw,
        results,
        // actions
        setPensionSearchInput,
        setPensionSearchError,
        clearPensionSearch,
        syncLatestPensionResults,
        generatePensionNumbers,
        loadPensionBacktestDiagnostics,
        searchPensionDraw,
        goToPreviousDraw,
        goToNextDraw,
    };
}
