import { ChevronRight, Info, Search, Sparkles } from 'lucide-react';
import { usePensionPage } from '../../hooks/usePensionPage';
import { PENSION_RULE_LABELS } from '../../constants';
import { SectionCard } from '../ui/SectionCard';
import { RuleWeightCard } from '../lotto/RuleCards';
import { PensionResultCard } from './PensionResultCard';
import {
    FeaturedPensionRecommendationCard,
    PensionRecommendationCard,
    PensionRulePerformanceCard,
} from './PensionCards';

export function PensionPage({
    onSyncMessage,
    onSyncError,
}: {
    onSyncMessage: (msg: string) => void;
    onSyncError: (err: string) => void;
}) {
    const {
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
        setPensionSearchInput,
        setPensionSearchResult,
        setPensionSearchError,
        syncLatestPensionResults,
        generatePensionNumbers,
        loadPensionBacktestDiagnostics,
        searchPensionDraw,
    } = usePensionPage();

    const featuredRecommendation = pensionRecommendations[0] ?? null;

    const handleSync = () => syncLatestPensionResults(onSyncMessage, onSyncError);

    return (
        /* 전역 여백 확보를 위한 space-y-10 sm:space-y-12 설정 */
        <div className="space-y-10 sm:space-y-12">
            {/* 회차별 당첨번호 섹션 */}
            <section>
                {/* 상단 헤딩 영역 및 회차 표시 */}
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-700">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tighter text-black sm:text-3xl">회차별 당첨번호</h2>
                    </div>
                    <span className="neo-badge neo-badge-purple py-2 px-4 text-xs sm:text-sm font-black">
                        <span>{latestPensionDraw ? `${latestPensionDraw.draw_no}회` : '회차 선택'}</span>
                        <ChevronRight className="ml-1.5 h-4 w-4 inline-block rotate-90 text-black" />
                    </span>
                </div>

                <div className="mb-3 flex justify-end">
                    <button
                        onClick={handleSync}
                        disabled={pensionSyncLoading}
                        className="neo-btn neo-btn-purple inline-flex h-10 px-4 text-sm disabled:opacity-60"
                    >
                        {pensionSyncLoading ? '동기화 중...' : '최신 결과 동기화'}
                    </button>
                </div>

                {pensionLoading ? (
                    <div className="neo-card p-8 text-center text-sm font-bold text-slate-700 bg-white">연금복권 데이터를 불러오는 중입니다...</div>
                ) : pensionError ? (
                    <div className="neo-card p-8 text-center text-sm font-black text-rose-700 bg-red-50 border-rose-600">{pensionError}</div>
                ) : latestPensionDraw ? (
                    <PensionResultCard draw={latestPensionDraw} />
                ) : (
                    <div className="neo-card p-8 text-center text-sm font-bold text-slate-700 bg-white">연금복권 데이터가 아직 없습니다. 먼저 `/api/pension/sync`를 실행해 주세요.</div>
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
                                    <h3 className="mt-1 text-lg font-black text-black">최근 24회 기준 추천 성향 우선순위</h3>
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
                            <FeaturedPensionRecommendationCard set={featuredRecommendation} />
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

            {/* 회차 검색 영역 */}
            {/* 지난 회차 검색 섹션 */}
            <section>
                <SectionCard title="지난 회차 검색" eyebrow="연금복권 조회" icon={<Search className="h-5 w-5" />}>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="number"
                            min={1}
                            value={pensionSearchInput}
                            onChange={e => {
                                setPensionSearchInput(e.target.value);
                                setPensionSearchResult(null);
                                setPensionSearchError('');
                            }}
                            onKeyDown={e => e.key === 'Enter' && searchPensionDraw()}
                            placeholder="예: 306"
                            className="neo-input h-12 flex-1 px-4 text-sm text-black"
                        />
                        <button
                            onClick={searchPensionDraw}
                            className="neo-btn neo-btn-purple inline-flex h-12 px-5 text-sm sm:min-w-[120px]"
                        >
                            회차 조회
                        </button>
                    </div>

                    <div className="mt-4 rounded-xl border-2 border-black bg-white/50 p-4 shadow-[2px_2px_0px_0px_#000]">
                        {pensionSearchError ? (
                            <p className="text-sm font-black text-rose-600">{pensionSearchError}</p>
                        ) : pensionSearchResult ? (
                            <PensionResultCard draw={pensionSearchResult} />
                        ) : (
                            <p className="text-sm font-bold text-slate-700">조회할 연금복권 회차를 입력하면 지난 회차 추첨 결과를 확인할 수 있습니다.</p>
                        )}
                    </div>
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
                                    <div className="text-xs font-bold text-slate-700">세트 평균 정확 일치</div>
                                    <div className="mt-1 text-xl font-black text-black">{pensionBacktestDiagnostics.averageExactMatchPerSet.toFixed(3)}</div>
                                </div>
                                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                    <div className="text-xs font-bold text-slate-700">회차 최고 평균 정확 일치</div>
                                    <div className="mt-1 text-xl font-black text-black">{pensionBacktestDiagnostics.averageBestExactMatchPerDraw.toFixed(3)}</div>
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
                                    <p className="text-xs font-bold text-slate-700 sm:text-sm">추천 성향별 정확 일치 성과를 비교합니다.</p>
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
        </div>
    );
}
