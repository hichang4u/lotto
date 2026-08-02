import { useEffect, useState } from 'react';
import { Info, Search, Sparkles, Ticket } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { usePensionPage } from '../../hooks/usePensionPage';
import { usePensionPurchases, summarizePensionTicketResult } from '../../hooks/usePensionPurchases';
import { PENSION_RULE_LABELS } from '../../constants';
import { SectionCard } from '../ui/SectionCard';
import { RuleWeightCard } from '../lotto/RuleCards';
import { PensionResultCard } from './PensionResultCard';
import { PensionPurchaseTicketModal } from './PensionPurchaseTicketModal';
import { PensionPurchaseHistorySection } from './PensionPurchaseHistorySection';
import {
    FeaturedPensionRecommendationCard,
    PensionRecommendationCard,
    PensionRulePerformanceCard,
} from './PensionCards';

// 꼬리 일치 자리수(1~6) → 연금복권 등수 표기 (조 일치는 모델 범위 밖이라 6자리 일치는 2등 상당)
const PENSION_PRIZE_TIER_LABELS: Record<number, string> = {
    1: '7등',
    2: '6등',
    3: '5등',
    4: '4등',
    5: '3등',
    6: '2등',
};

function formatPrizeCounts(counts: Record<number, number>) {
    const parts = [6, 5, 4, 3, 2, 1]
        .filter(tier => (counts[tier] ?? 0) > 0)
        .map(tier => `${PENSION_PRIZE_TIER_LABELS[tier]} ${counts[tier]}회`);
    return parts.length > 0 ? parts.join(' · ') : '당첨 없음';
}

export function PensionPage({
    onSyncMessage,
    onSyncError,
}: {
    onSyncMessage: (msg: string) => void;
    onSyncError: (err: string) => void;
}) {
    const {
        currentPensionDraw,
        resultsLoading,
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
        setPensionSearchInput,
        setPensionSearchError,
        syncLatestPensionResults,
        generatePensionNumbers,
        loadPensionBacktestDiagnostics,
        searchPensionDraw,
        goToPreviousDraw,
        goToNextDraw,
    } = usePensionPage();

    const featuredRecommendation = pensionFeaturedRecommendation;

    const {
        tickets,
        purchasesLoading,
        saving,
        loadPurchases,
        savePurchase,
        deleteTicket,
        refreshAfterSync,
    } = usePensionPurchases();
    const [showTicketModal, setShowTicketModal] = useState(false);
    const targetDrawNo = maxDrawNo + 1;

    useEffect(() => {
        loadPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSavePurchase = async () => {
        if (!featuredRecommendation) return;
        if (!window.confirm(`제 ${targetDrawNo}회 추첨 대상으로 이 번호를 각조 구매로 저장할까요?`)) return;
        const result = await savePurchase(pensionAlgorithm, [featuredRecommendation]);
        if (result) {
            onSyncMessage(`구매번호 저장 완료 (제 ${result.drawNo}회)`);
            setShowTicketModal(false);
        } else {
            onSyncError('구매번호 저장에 실패했습니다.');
        }
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!window.confirm('이 구매 기록을 삭제할까요?')) return;
        const ok = await deleteTicket(ticketId);
        if (!ok) onSyncError('구매 기록 삭제에 실패했습니다.');
    };

    const handleSync = () => syncLatestPensionResults(
        async (msg) => {
            onSyncMessage(msg);
            // 동기화로 새 회차가 들어왔다면 pending 티켓이 판정됐는지 확인해 알림
            const newlyJudged = await refreshAfterSync();
            if (newlyJudged.length > 0) {
                onSyncMessage(newlyJudged.map(summarizePensionTicketResult).join(' / '));
            }
        },
        onSyncError,
    );

    return (
        /* 전역 여백 확보를 위한 space-y-10 sm:space-y-12 설정 */
        <div className="space-y-10 sm:space-y-12">
            {showTicketModal && featuredRecommendation && (
                <PensionPurchaseTicketModal
                    set={featuredRecommendation}
                    targetDrawNo={targetDrawNo}
                    saving={saving}
                    onSave={handleSavePurchase}
                    onClose={() => setShowTicketModal(false)}
                />
            )}
            {/* 회차별 당첨번호 섹션 */}
            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-700">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tighter text-black sm:text-3xl">회차별 당첨결과</h2>
                    </div>
                    {/* 미니 검색 폼 */}
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={1}
                            value={pensionSearchInput}
                            onChange={e => {
                                setPensionSearchInput(e.target.value);
                                setPensionSearchError('');
                            }}
                            onKeyDown={e => e.key === 'Enter' && searchPensionDraw()}
                            placeholder="회차 검색 (예: 306)"
                            className="neo-input h-10 w-44 px-3 text-xs text-black"
                        />
                        <button
                            onClick={searchPensionDraw}
                            className="neo-btn neo-btn-purple inline-flex h-10 px-3 text-xs"
                        >
                            <Search className="h-3.5 w-3.5 mr-1 text-black" />
                            조회
                        </button>
                    </div>
                </div>

                {pensionSearchError && (
                    <div className="border-2 border-black bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2 rounded-xl shadow-[2px_2px_0px_0px_#000]">
                        {pensionSearchError}
                    </div>
                )}

                {currentPensionDraw ? (
                    <PensionResultCard
                        draw={currentPensionDraw}
                        // 최신 회차 여부에 따라 최신/지난 배지 레이블 지정
                        chipLabel={isLatest ? `최신 ${currentPensionDraw.draw_no}회` : `지난 ${currentPensionDraw.draw_no}회`}
                        variant="latest"
                        onPrimaryAction={handleSync}
                        primaryActionLabel={pensionSyncLoading ? '동기화 중...' : '최신 결과 동기화'}
                        primaryDisabled={pensionSyncLoading}
                        statusText={`마지막 동기화 ${lastSyncedAt ? formatDateTime(lastSyncedAt) : '아직 실행 전'} · 최신 반영 ${lastSyncedDraw ? `${lastSyncedDraw}회` : '정보 없음'}`}
                        onPrevDraw={goToPreviousDraw}
                        onNextDraw={goToNextDraw}
                        hasPrevDraw={hasPrevDraw}
                        hasNextDraw={hasNextDraw}
                        isLoading={resultsLoading}
                    />
                ) : resultsLoading ? (
                    <div className="neo-card p-8 text-center text-sm font-bold text-slate-700 bg-white">데이터를 불러오는 중입니다...</div>
                ) : pensionError ? (
                    <div className="neo-card p-8 text-center text-sm font-black text-rose-700 bg-red-50 border-rose-600">{pensionError}</div>
                ) : (
                    <div className="neo-card p-8 text-center text-sm font-bold text-slate-700 bg-white">데이터가 없습니다. 먼저 로컬 서버 동기화를 수행해 주세요.</div>
                )}
            </section>

            {/* 추천번호 생성 카드 영역 */}
            {/* 추천번호 생성 섹션 */}
            <section>
                <SectionCard
                    title="추천번호 생성"
                    eyebrow="연금복권 추천"
                    icon={<Sparkles className="h-5 w-5" />}
                    action={
                        <button
                            onClick={generatePensionNumbers}
                            disabled={pensionGenerateLoading}
                            className="neo-btn neo-btn-purple inline-flex h-10 px-4 text-sm disabled:opacity-60"
                        >
                            {pensionGenerateLoading ? '생성 중...' : '추천번호 생성'}
                        </button>
                    }
                >
                    <p className="mb-4 text-sm font-bold text-slate-700">
                        숫자 6개를 독립 추출한 뒤 공통 규칙을 통과시키고, 추천 성향별 규칙 세트로 여러 조합을 나눠 제안합니다.
                    </p>

                    {/* 추천 성향 분석 목록 */}
                    {pensionRuleWeights.length > 0 && (
                        <div className="mb-5 border-3 border-black bg-white rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000]">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b-2 border-black pb-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">추천 성향 분석</p>
                                    <h3 className="mt-1 text-lg font-black text-black">전체 이력 감쇠 가중 기준 추천 성향 우선순위</h3>
                                </div>
                                <p className="text-xs font-bold text-slate-700 sm:text-sm">점수가 높은 추천 성향을 먼저 적용합니다.</p>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {pensionRuleWeights.map((item, index) => (
                                    <RuleWeightCard
                                        key={`pension-${item.ruleId}`}
                                        item={{ ...item, label: PENSION_RULE_LABELS[item.ruleId] ?? item.label }}
                                        index={index}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 대표 1세트 추천 레이아웃 */}
                    {featuredRecommendation && (
                        <div className="mb-4">
                            <FeaturedPensionRecommendationCard
                                set={featuredRecommendation}
                                action={
                                    <button
                                        type="button"
                                        onClick={() => setShowTicketModal(true)}
                                        disabled={maxDrawNo === 0}
                                        className="neo-btn neo-btn-purple inline-flex h-11 w-full items-center justify-center px-6 text-sm font-black disabled:opacity-60"
                                    >
                                        이 번호로 구매
                                    </button>
                                }
                            />
                        </div>
                    )}

                    {/* 추천 세트 목록 그리드 */}
                    {pensionRecommendations.length > 0 ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                            {pensionRecommendations.map((set) => (
                                <PensionRecommendationCard key={`${set.label}-${set.number}`} set={set} />
                            ))}
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-8 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                            버튼을 눌러 연금복권 추천번호 세트를 생성해 보세요.
                        </div>
                    )}
                </SectionCard>
            </section>



            {/* 백테스트 알고리즘 성향 진단 영역 */}
            {/* 백테스트 성향 진단 섹션 */}
            <section>
                <SectionCard
                    title="백테스트 성향 진단"
                    eyebrow="알고리즘 진단"
                    icon={<Info className="h-5 w-5" />}
                    action={
                        <button
                            onClick={loadPensionBacktestDiagnostics}
                            disabled={pensionBacktestLoading}
                            className="neo-btn neo-btn-secondary inline-flex h-10 px-4 text-sm font-bold disabled:opacity-60"
                        >
                            {pensionBacktestLoading ? '분석 중...' : '진단 새로고침'}
                        </button>
                    }
                >
                    {pensionBacktestDiagnostics ? (
                        <>
                            {/* 지표 그리드 배치 */}
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">평가 회차</div>
                                    <div className="mt-1 text-xl font-black text-black">{pensionBacktestDiagnostics.evaluatedDraws}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">세트 수</div>
                                    <div className="mt-1 text-xl font-black text-black">{pensionBacktestDiagnostics.totalGeneratedSets}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">세트 평균 꼬리 일치</div>
                                    <div className="mt-1 text-xl font-black text-black">{pensionBacktestDiagnostics.averageSuffixMatchPerSet.toFixed(3)}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">랜덤 대비 (꼬리 일치)</div>
                                    <div className="mt-1 text-xl font-black text-black">
                                        {(pensionBacktestDiagnostics.averageSuffixMatchPerSet - pensionBacktestDiagnostics.baseline.averageSuffixMatchPerSet) >= 0 ? '+' : ''}
                                        {(pensionBacktestDiagnostics.averageSuffixMatchPerSet - pensionBacktestDiagnostics.baseline.averageSuffixMatchPerSet).toFixed(3)}
                                    </div>
                                </div>
                            </div>

                            {/* 상금 구조(꼬리 일치) 기준 시뮬레이션 당첨 집계 */}
                            <div className="mt-4 border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                <div className="text-xs font-bold text-slate-700">시뮬레이션 당첨 (평가 구간 누적)</div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-black text-black">
                                    <span className="text-xs font-bold text-slate-500">추천 세트</span>
                                    <span>{formatPrizeCounts(pensionBacktestDiagnostics.prizeCounts)}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-600">
                                    <span className="text-xs font-bold text-slate-500">랜덤 대조군</span>
                                    <span>{formatPrizeCounts(pensionBacktestDiagnostics.baseline.prizeCounts)}</span>
                                </div>
                                {/* 끝자리 다양화 효과가 드러나는 회차 단위 지표 */}
                                <div className="mt-2 border-t border-slate-200 pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-700">
                                    <span className="text-xs font-bold text-slate-500">회차당 최소 1개 당첨률</span>
                                    <span className="font-black text-black">추천 {pensionBacktestDiagnostics.atLeastOnePrizeRate.toFixed(1)}%</span>
                                    <span>· 랜덤 {pensionBacktestDiagnostics.baseline.atLeastOnePrizeRate.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* 대표 1세트 선발 성과 — 4세트 전체 지표와 분리 */}
                            <div className="mt-4 border-2 border-black bg-[#fffdf5] rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                <div className="text-xs font-bold text-slate-700">통계 점수 대표 1세트 성과</div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-black text-black">
                                    <span>평균 꼬리 일치 {pensionBacktestDiagnostics.featured.averageSuffixMatchPerSet.toFixed(3)}</span>
                                    <span>· 7등 이상 {pensionBacktestDiagnostics.featured.atLeastOnePrizeRate.toFixed(1)}%</span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-600">
                                    <span className="text-xs font-bold text-slate-500">랜덤 1세트</span>
                                    <span>평균 {pensionBacktestDiagnostics.featuredBaseline.averageSuffixMatchPerSet.toFixed(3)}</span>
                                    <span>· 7등 이상 {pensionBacktestDiagnostics.featuredBaseline.atLeastOnePrizeRate.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* 백테스트 가중치 상세 */}
                            <div className="mt-5 border-3 border-black bg-white rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000]">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b-2 border-black pb-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">백테스트 성향 가중치</p>
                                        <h3 className="mt-1 text-lg font-black text-black">현재 추천 성향 우선순위</h3>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {pensionBacktestDiagnostics.ruleDiagnostics.currentWeights.map((item, index) => (
                                        <RuleWeightCard
                                            key={`pension-backtest-${item.ruleId}`}
                                            item={{ ...item, label: PENSION_RULE_LABELS[item.ruleId] ?? item.label }}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* 백테스트 성과 요약 */}
                            <div className="mt-5 border-3 border-black bg-white rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000]">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b-2 border-black pb-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">성향 성과 분석</p>
                                        <h3 className="mt-1 text-lg font-black text-black">추천 성향별 백테스트 성과</h3>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 sm:text-sm">추천 성향별 꼬리 일치 성과를 비교합니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {pensionBacktestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                        <PensionRulePerformanceCard key={`pension-perf-${item.ruleId}`} item={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                            {pensionBacktestLoading ? '연금복권 백테스트 진단을 계산하고 있습니다.' : '연금복권 백테스트 진단 데이터를 불러오지 못했습니다.'}
                        </div>
                    )}
                </SectionCard>
            </section>

            {/* 내 구매 기록 섹션 */}
            <section>
                <SectionCard
                    title="내 구매 기록"
                    eyebrow="구매번호 관리"
                    icon={<Ticket className="h-5 w-5" />}
                >
                    <p className="mb-4 text-sm font-bold text-slate-700">
                        저장한 번호는 1~5조 전부(각조 5매) 구매로 판정되며, 당첨번호 동기화 시 자동으로 확인됩니다.
                    </p>
                    <PensionPurchaseHistorySection
                        tickets={tickets}
                        loading={purchasesLoading}
                        onDelete={handleDeleteTicket}
                    />
                </SectionCard>
            </section>
        </div>
    );
}
