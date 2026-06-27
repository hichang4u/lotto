import { useState, useEffect } from 'react';
import type {
    PensionDrawResult,
    PensionRecommendationSet,
    PensionRuleWeight,
    PensionBacktestDiagnostics,
} from '../types';
import { API_URL } from '../constants';

export function usePensionPage() {
    const [latestPensionDraw, setLatestPensionDraw] = useState<PensionDrawResult | null>(null);
    const [pensionLoading, setPensionLoading] = useState(false);
    const [pensionError, setPensionError] = useState('');
    const [pensionSyncLoading, setPensionSyncLoading] = useState(false);
    const [pensionGenerateLoading, setPensionGenerateLoading] = useState(false);
    const [pensionRecommendations, setPensionRecommendations] = useState<PensionRecommendationSet[]>([]);
    const [pensionRuleWeights, setPensionRuleWeights] = useState<PensionRuleWeight[]>([]);
    const [pensionBacktestDiagnostics, setPensionBacktestDiagnostics] = useState<PensionBacktestDiagnostics | null>(null);
    const [pensionBacktestLoading, setPensionBacktestLoading] = useState(false);
    const [pensionSearchInput, setPensionSearchInput] = useState('');
    const [pensionSearchResult, setPensionSearchResult] = useState<PensionDrawResult | null>(null);
    const [pensionSearchError, setPensionSearchError] = useState('');

    const loadLatestPensionResult = async () => {
        setPensionLoading(true);
        setPensionError('');
        try {
            const res = await fetch(`${API_URL}/api/pension/results?limit=12`);
            if (!res.ok) {
                setPensionError('연금복권 결과를 불러오지 못했습니다.');
                setLatestPensionDraw(null);
                return;
            }
            const data = await res.json();
            const list = Array.isArray(data) ? data : data ? [data] : [];
            const latest = list[0] ?? null;
            if (latest?.draw_no) {
                const detailRes = await fetch(`${API_URL}/api/pension/results?drawNo=${latest.draw_no}`);
                setLatestPensionDraw(detailRes.ok ? await detailRes.json() : latest);
            } else {
                setLatestPensionDraw(latest);
            }
        } catch {
            setPensionError('연금복권 결과 조회 중 오류가 발생했습니다.');
            setLatestPensionDraw(null);
        } finally {
            setPensionLoading(false);
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

            await loadLatestPensionResult();
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
        setPensionRuleWeights([]);
        try {
            const res = await fetch(`${API_URL}/api/pension/generate`, { method: 'POST' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPensionRecommendations(Array.isArray(data.sets) ? data.sets : []);
            setPensionRuleWeights(Array.isArray(data.ruleWeights) ? data.ruleWeights : []);
        } catch {
            setPensionRecommendations([]);
            setPensionRuleWeights([]);
        } finally {
            setPensionGenerateLoading(false);
        }
    };

    const searchPensionDraw = async () => {
        const no = Number(pensionSearchInput);
        if (!no || no < 1) return;
        setPensionSearchError('');
        setPensionSearchResult(null);
        try {
            const res = await fetch(`${API_URL}/api/pension/results?drawNo=${no}`);
            if (!res.ok) { setPensionSearchError(`${no}회차 데이터가 없습니다.`); return; }
            setPensionSearchResult(await res.json());
        } catch {
            setPensionSearchError('조회 중 오류가 발생했습니다.');
        }
    };

    const clearPensionSearch = () => {
        setPensionSearchInput('');
        setPensionSearchResult(null);
        setPensionSearchError('');
    };

    useEffect(() => {
        loadLatestPensionResult();
        loadPensionBacktestDiagnostics();
    }, []);

    return {
        // state
        latestPensionDraw,
        pensionLoading,
        pensionError,
        pensionSyncLoading,
        pensionGenerateLoading,
        pensionRecommendations,
        pensionRuleWeights,
        pensionBacktestDiagnostics,
        pensionBacktestLoading,
        pensionSearchInput,
        pensionSearchResult,
        pensionSearchError,
        // actions
        setPensionSearchInput,
        setPensionSearchResult,
        setPensionSearchError,
        clearPensionSearch,
        syncLatestPensionResults,
        generatePensionNumbers,
        loadPensionBacktestDiagnostics,
        searchPensionDraw,
    };
}
