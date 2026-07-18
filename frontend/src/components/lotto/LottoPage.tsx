import { Info, Search, Sparkles } from 'lucide-react';
import { useLottoPage } from '../../hooks/useLottoPage';
import { formatDateTime } from '../../utils/format';
import { SectionCard } from '../ui/SectionCard';
import { Ball } from '../ui/Ball';
import { DrawResultCard } from './DrawResultCard';
import { RecommendationCard } from './RecommendationCard';
import { RuleWeightCard, RulePerformanceCard } from './RuleCards';

// 등수(1~5) → 시뮬레이션 당첨 표기. 높은 등수부터 표시
function formatLottoPrizeCounts(counts: Record<number, number>) {
    const parts = [1, 2, 3, 4, 5]
        .filter(tier => (counts[tier] ?? 0) > 0)
        .map(tier => `${tier}등 ${counts[tier]}회`);
    return parts.length > 0 ? parts.join(' · ') : '당첨 없음';
}

export function LottoPage({
    onSyncMessage,
    onSyncError,
}: {
    onSyncMessage: (msg: string) => void;
    onSyncError: (err: string) => void;
}) {
    const {
        currentDraw,
        isLatest,
        hasPrevDraw,
        hasNextDraw,
        sets,
        ruleWeights,
        backtestDiagnostics,
        backtestLoading,
        loading,
        resultsLoading,
        syncLoading,
        lastSyncedAt,
        lastSyncedDraw,
        searchInput,
        searchError,
        setSearchInput,
        setSearchError,
        syncLatestResults,
        generateNumbers,
        loadBacktestDiagnostics,
        searchDraw,
        goToPreviousDraw,
        goToNextDraw,
    } = useLottoPage();

    const handleSync = () => syncLatestResults(onSyncMessage, onSyncError);

    return (
        /* space-y-10 sm:space-y-12를 통해 전체 섹션 간의 여백을 넉넉하게 확보 */
        <div className="space-y-10 sm:space-y-12">
            {/* 최신 결과 카드 섹션 */}
            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-700">로또 6/45</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tighter text-black sm:text-3xl">회차별 당첨결과</h2>
                    </div>
                    {/* 미니 검색 폼 */}
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={1}
                            value={searchInput}
                            onChange={e => {
                                setSearchInput(e.target.value);
                                setSearchError('');
                            }}
                            onKeyDown={e => e.key === 'Enter' && searchDraw()}
                            placeholder="회차 검색 (예: 1158)"
                            className="neo-input h-10 w-44 px-3 text-xs text-black"
                        />
                        <button
                            onClick={searchDraw}
                            className="neo-btn neo-btn-primary inline-flex h-10 px-3 text-xs"
                        >
                            <Search className="h-3.5 w-3.5 mr-1" />
                            조회
                        </button>
                    </div>
                </div>

                {searchError && (
                    <div className="border-2 border-black bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2 rounded-xl shadow-[2px_2px_0px_0px_#000]">
                        {searchError}
                    </div>
                )}

                {currentDraw ? (
                    <DrawResultCard
                        draw={currentDraw}
                        // 최신 회차 여부에 따라 최신/지난 배지 레이블 지정
                        chipLabel={isLatest ? `최신 ${currentDraw.drwNo}회` : `지난 ${currentDraw.drwNo}회`}
                        variant="latest"
                        onPrimaryAction={handleSync}
                        primaryActionLabel={syncLoading ? '동기화 중...' : '최신 결과 동기화'}
                        primaryDisabled={syncLoading}
                        statusText={`마지막 동기화 ${lastSyncedAt ? formatDateTime(lastSyncedAt) : '아직 실행 전'} · 최신 반영 ${lastSyncedDraw ? `${lastSyncedDraw}회` : '정보 없음'}`}
                        onPrevDraw={goToPreviousDraw}
                        onNextDraw={goToNextDraw}
                        hasPrevDraw={hasPrevDraw}
                        hasNextDraw={hasNextDraw}
                        isLoading={resultsLoading}
                    />
                ) : resultsLoading ? (
                    <div className="neo-card p-8 text-center text-sm font-bold text-slate-700 bg-white">데이터를 불러오는 중입니다...</div>
                ) : (
                    <div className="neo-card p-8 text-center text-sm font-bold text-slate-700 bg-white">데이터가 없습니다. 먼저 로컬 서버 동기화를 수행해 주세요.</div>
                )}
            </section>

            {/* 추천 번호 세트 생성 섹션 */}
            <section>
                <SectionCard
                    title="추천 번호 세트"
                    eyebrow="추천 번호"
                    icon={<Sparkles className="h-5 w-5" />}
                    action={
                        <button
                            onClick={generateNumbers}
                            disabled={loading}
                            className="neo-btn neo-btn-primary inline-flex h-10 px-4 text-sm disabled:opacity-60"
                        >
                            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Sparkles className="h-4 w-4" />}
                            {loading ? '번호 생성 중...' : '추천 번호 생성'}
                        </button>
                    }
                    accent="soft"
                >
                    <div className="mb-3.5 flex items-center justify-end">
                        <span className="neo-badge neo-badge-yellow">5개 조합</span>
                    </div>

                    <p className="mb-4 text-sm font-bold text-slate-700">
                        전체 이력과 최근 출현 흐름을 함께 반영하고, 최근 당첨 패턴에 맞는 규칙을 더 먼저 시도합니다.
                    </p>

                    {/* 추천 가중치 요약 패널 */}
                    {ruleWeights.length > 0 && (
                        <div className="mb-4 border-3 border-black bg-white rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000]">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b-2 border-black pb-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">규칙 가중치 분석</p>
                                    <h3 className="mt-1 text-lg font-black text-black">전체 이력 감쇠 가중 기준 추천 규칙 우선순위</h3>
                                </div>
                                <p className="text-xs font-bold text-slate-700 sm:text-sm">점수가 높은 규칙을 먼저 적용해 추천 세트를 만듭니다.</p>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {ruleWeights.map((item, index) => (
                                    <RuleWeightCard key={item.ruleId} item={item} index={index} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 생성 번호 세트 목록 */}
                    {sets.length > 0 ? (
                        <div className="space-y-4">
                            {sets.map((set, si) => (
                                <RecommendationCard key={si} set={set} index={si} />
                            ))}
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center shadow-[2px_2px_0px_0px_#000]">
                            <p className="text-sm font-bold text-slate-700">
                                {loading ? '추천 로직을 실행하고 있습니다.' : '상단 버튼을 눌러 새로운 추천 번호를 받아보세요.'}
                            </p>
                        </div>
                    )}
                </SectionCard>
            </section>

            {/* 백테스트 진단 섹션 */}
            <section>
                <SectionCard
                    title="백테스트 규칙 진단"
                    eyebrow="알고리즘 진단"
                    icon={<Info className="h-5 w-5" />}
                    action={
                        <button
                            onClick={loadBacktestDiagnostics}
                            disabled={backtestLoading}
                            className="neo-btn neo-btn-secondary inline-flex h-10 px-4 text-sm font-bold disabled:opacity-60"
                        >
                            {backtestLoading ? '분석 중...' : '진단 새로고침'}
                        </button>
                    }
                >
                    {backtestDiagnostics ? (
                        <>
                            {/* 지표 그리드 */}
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">평가 회차</div>
                                    <div className="mt-1 text-xl font-black text-black">{backtestDiagnostics.evaluatedDraws}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">세트 평균 일치</div>
                                    <div className="mt-1 text-xl font-black text-black">{backtestDiagnostics.averageMatchPerSet.toFixed(3)}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">회차 최고 평균</div>
                                    <div className="mt-1 text-xl font-black text-black">{backtestDiagnostics.averageBestMatchPerDraw.toFixed(3)}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">공통 규칙 통과율</div>
                                    <div className="mt-1 text-xl font-black text-black">{backtestDiagnostics.generationQuality.commonRulePassRate.toFixed(1)}%</div>
                                </div>
                            </div>

                            {/* 상금 구조 기준 시뮬레이션 당첨 집계 (연금 페이지와 동일 형식) */}
                            <div className="mt-4 border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                <div className="text-xs font-bold text-slate-700">시뮬레이션 당첨 (평가 구간 누적)</div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-black text-black">
                                    <span className="text-xs font-bold text-slate-500">추천 세트</span>
                                    <span>{formatLottoPrizeCounts(backtestDiagnostics.prizeCounts)}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-600">
                                    <span className="text-xs font-bold text-slate-500">랜덤 대조군</span>
                                    <span>{formatLottoPrizeCounts(backtestDiagnostics.baseline.prizeCounts)}</span>
                                </div>
                                {/* 비중첩 다양화 효과가 드러나는 회차 단위 지표 */}
                                <div className="mt-2 border-t border-slate-200 pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-700">
                                    <span className="text-xs font-bold text-slate-500">회차당 최소 1개 당첨률 (3개 이상 일치)</span>
                                    <span className="font-black text-black">추천 {backtestDiagnostics.atLeastOnePrizeRate.toFixed(1)}%</span>
                                    <span>· 랜덤 {backtestDiagnostics.baseline.atLeastOnePrizeRate.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* 가중치 상세 목록 */}
                            <div className="mt-5 border-3 border-black bg-white rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000]">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b-2 border-black pb-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">백테스트 가중치</p>
                                        <h3 className="mt-1 text-lg font-black text-black">현재 규칙 가중치</h3>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {backtestDiagnostics.ruleDiagnostics.currentWeights.map((item, index) => (
                                        <RuleWeightCard key={`backtest-${item.ruleId}`} item={item} index={index} />
                                    ))}
                                </div>
                            </div>

                            {/* 규칙별 상세 성과 */}
                            <div className="mt-5 border-3 border-black bg-white rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000]">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b-2 border-black pb-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">규칙 성과 분석</p>
                                        <h3 className="mt-1 text-lg font-black text-black">규칙별 백테스트 성과</h3>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 sm:text-sm">규칙별 생성 결과와 폴백 비율입니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {backtestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                        <RulePerformanceCard key={item.ruleId} item={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                            {backtestLoading ? '백테스트 진단을 계산하고 있습니다.' : '백테스트 진단 데이터를 불러오지 못했습니다.'}
                        </div>
                    )}
                </SectionCard>
            </section>



            {/* 하단 번호대 색상 안내 및 서비스 유의사항 (풋터 스타일 경량화) */}
            <footer className="border-t-3 border-black pt-8 space-y-6">
                <div>
                    <h3 className="text-sm font-black text-black mb-3.5">번호대별 색상 안내</h3>
                    <div className="flex flex-wrap gap-2.5">
                        {[1, 11, 21, 31, 41].map((n, i) => {
                            const label = ['1-10', '11-20', '21-30', '31-40', '41-45'][i];
                            return (
                                <div key={label} className="flex items-center gap-2.5 border-2 border-black bg-white rounded-lg px-3 py-1.5 shadow-[1.5px_1.5px_0px_0px_#000000]">
                                    <Ball num={n} size="sm" />
                                    <span className="text-xs font-black text-black">{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs font-bold text-slate-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p className="leading-5">
                        본 서비스는 과거 당첨 데이터를 바탕으로 정보를 정리하고 추천 번호를 제공하는 참고용 도구입니다. 당첨을 보장하지 않으며,
                        건전한 이용을 위해 과도한 몰입은 피하시기 바랍니다. 생성형 알고리즘 사용 사실을 함께 안내합니다.
                    </p>
                </div>
            </footer>
        </div>
    );
}
