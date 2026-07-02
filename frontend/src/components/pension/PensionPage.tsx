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
        <div className="space-y-6 lg:space-y-8">
            <section>
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">연금복권720+</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">회차별 당첨번호</h2>
                    </div>
                    <div className="inline-flex min-w-[120px] items-center justify-between gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.03)] sm:min-w-[180px] sm:px-5">
                        <span>{latestPensionDraw ? `${latestPensionDraw.draw_no}회` : '회차 선택'}</span>
                        <ChevronRight className="h-4 w-4 rotate-90 text-slate-400" />
                    </div>
                </div>

                <div className="mb-3 flex justify-end">
                    <button
                        onClick={handleSync}
                        disabled={pensionSyncLoading}
                        className="btn-primary inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                        {pensionSyncLoading ? '동기화 중...' : '최신 결과 동기화'}
                    </button>
                </div>

                {pensionLoading ? (
                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">연금복권 데이터를 불러오는 중입니다...</div>
                ) : pensionError ? (
                    <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-4 py-8 text-sm text-rose-700">{pensionError}</div>
                ) : latestPensionDraw ? (
                    <PensionResultCard draw={latestPensionDraw} />
                ) : (
                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">연금복권 데이터가 아직 없습니다. 먼저 `/api/pension/sync`를 실행해 주세요.</div>
                )}
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard
                    title="추천번호 생성"
                    eyebrow="연금복권 추천"
                    icon={<Sparkles className="h-5 w-5" />}
                    action={
                        <button
                            onClick={generatePensionNumbers}
                            disabled={pensionGenerateLoading}
                            className="btn-primary inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white transition disabled:opacity-60"
                        >
                            {pensionGenerateLoading ? '생성 중...' : '추천번호 생성'}
                        </button>
                    }
                >
                    <p className="mb-4 text-sm text-slate-500">
                        숫자 6개를 독립 추출한 뒤 공통 규칙을 통과시키고, 추천 성향별 규칙 세트로 여러 조합을 나눠 제안합니다.
                    </p>

                    {pensionRuleWeights.length > 0 && (
                        <div className="mb-4 rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:p-5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">추천 성향 분석</p>
                                    <h3 className="mt-1 text-lg font-bold text-slate-800">최근 24회 기준 추천 성향 우선순위</h3>
                                </div>
                                <p className="text-xs text-slate-500 sm:text-sm">점수가 높은 추천 성향을 먼저 적용합니다.</p>
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

                    {featuredRecommendation && (
                        <div className="mb-4">
                            <FeaturedPensionRecommendationCard set={featuredRecommendation} />
                        </div>
                    )}

                    {pensionRecommendations.length > 0 ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                            {pensionRecommendations.map((set) => (
                                <PensionRecommendationCard key={`${set.label}-${set.number}`} set={set} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                            버튼을 눌러 연금복권 추천번호 세트를 생성해 보세요.
                        </div>
                    )}
                </SectionCard>
            </section>

            <section className="mt-5 lg:mt-6">
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
                            className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                        />
                        <button
                            onClick={searchPensionDraw}
                            className="btn-primary inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition sm:min-w-[120px]"
                        >
                            회차 조회
                        </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                        {pensionSearchError ? (
                            <p className="text-sm font-medium text-rose-600">{pensionSearchError}</p>
                        ) : pensionSearchResult ? (
                            <PensionResultCard draw={pensionSearchResult} />
                        ) : (
                            <p className="text-sm text-slate-500">조회할 연금복권 회차를 입력하면 지난 회차 추첨 결과를 확인할 수 있습니다.</p>
                        )}
                    </div>
                </SectionCard>
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard
                    title="백테스트 성향 진단"
                    eyebrow="알고리즘 진단"
                    icon={<Info className="h-5 w-5" />}
                    action={
                        <button
                            onClick={loadPensionBacktestDiagnostics}
                            disabled={pensionBacktestLoading}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition disabled:opacity-60"
                        >
                            {pensionBacktestLoading ? '분석 중...' : '진단 새로고침'}
                        </button>
                    }
                >
                    {pensionBacktestDiagnostics ? (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">평가 회차</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{pensionBacktestDiagnostics.evaluatedDraws}</div>
                                </div>
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">세트 수</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{pensionBacktestDiagnostics.totalGeneratedSets}</div>
                                </div>
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">세트 평균 정확 일치</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{pensionBacktestDiagnostics.averageExactMatchPerSet.toFixed(3)}</div>
                                </div>
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">회차 최고 평균 정확 일치</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{pensionBacktestDiagnostics.averageBestExactMatchPerDraw.toFixed(3)}</div>
                                </div>
                            </div>

                            <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:p-5">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">백테스트 성향 가중치</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-800">현재 추천 성향 우선순위</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
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

                            <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:p-5">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">성향 성과 분석</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-800">추천 성향별 백테스트 성과</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 sm:text-sm">추천 성향별 정확 일치 성과를 비교합니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {pensionBacktestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                        <PensionRulePerformanceCard key={`pension-perf-${item.ruleId}`} item={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
                            {pensionBacktestLoading ? '연금복권 백테스트 진단을 계산하고 있습니다.' : '연금복권 백테스트 진단 데이터를 불러오지 못했습니다.'}
                        </div>
                    )}
                </SectionCard>
            </section>
        </div>
    );
}
