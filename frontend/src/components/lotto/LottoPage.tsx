import { Info, Search, Sparkles, Waves, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLottoPage } from '../../hooks/useLottoPage';
import { formatDateTime } from '../../utils/format';
import { SectionCard } from '../ui/SectionCard';
import { Ball, BonusBadge } from '../ui/Ball';
import { DrawResultCard } from './DrawResultCard';
import { RecommendationCard } from './RecommendationCard';
import { RuleWeightCard, RulePerformanceCard } from './RuleCards';

export function LottoPage({
    onSyncMessage,
    onSyncError,
}: {
    onSyncMessage: (msg: string) => void;
    onSyncError: (err: string) => void;
}) {
    const {
        latestDraw,
        sets,
        ruleWeights,
        backtestDiagnostics,
        backtestLoading,
        loading,
        results,
        resultsLoading,
        syncLoading,
        lastSyncedAt,
        lastSyncedDraw,
        searchInput,
        searchResult,
        searchError,
        page,
        totalPages,
        pagedResults,
        setSearchInput,
        setSearchResult,
        setSearchError,
        setPage,
        syncLatestResults,
        generateNumbers,
        loadBacktestDiagnostics,
        searchDraw,
        scrollToLookupSection,
    } = useLottoPage();

    const handleSync = () => syncLatestResults(onSyncMessage, onSyncError);

    return (
        <>
            <section>
                {resultsLoading ? (
                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">데이터를 불러오는 중입니다...</div>
                ) : latestDraw ? (
                    <DrawResultCard
                        draw={latestDraw}
                        chipLabel={`최신 ${latestDraw.drwNo}회`}
                        variant="latest"
                        onPrimaryAction={handleSync}
                        onSecondaryAction={scrollToLookupSection}
                        primaryActionLabel={syncLoading ? '동기화 중...' : '최신 결과 동기화'}
                        secondaryActionLabel="회차 상세 보기"
                        primaryDisabled={syncLoading}
                        statusText={`마지막 동기화 ${lastSyncedAt ? formatDateTime(lastSyncedAt) : '아직 실행 전'} · 최신 반영 ${lastSyncedDraw ? `${lastSyncedDraw}회` : '정보 없음'}`}
                    />
                ) : (
                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">데이터가 없습니다. 먼저 `/api/sync`를 실행해 주세요.</div>
                )}
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard
                    title="추천 번호 세트"
                    eyebrow="추천 번호"
                    icon={<Sparkles className="h-5 w-5" />}
                    action={
                        <button
                            onClick={generateNumbers}
                            disabled={loading}
                            className="btn-primary inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition disabled:opacity-60"
                        >
                            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Sparkles className="h-4 w-4" />}
                            {loading ? '번호 생성 중...' : '추천 번호 생성'}
                        </button>
                    }
                    accent="soft"
                >
                    <div className="mb-3 flex items-center justify-end">
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">5개 조합</div>
                    </div>

                    <p className="mb-3 text-sm text-slate-500">
                        전체 이력과 최근 출현 흐름을 함께 반영하고, 최근 당첨 패턴에 맞는 규칙을 더 먼저 시도합니다.
                    </p>

                    {ruleWeights.length > 0 && (
                        <div className="mb-4 rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:p-5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">규칙 가중치 분석</p>
                                    <h3 className="mt-1 text-lg font-bold text-slate-800">최근 24회 기준 추천 규칙 우선순위</h3>
                                </div>
                                <p className="text-xs text-slate-500 sm:text-sm">점수가 높은 규칙을 먼저 적용해 추천 세트를 만듭니다.</p>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {ruleWeights.map((item, index) => (
                                    <RuleWeightCard key={item.ruleId} item={item} index={index} />
                                ))}
                            </div>
                        </div>
                    )}

                    {sets.length > 0 ? (
                        <div className="space-y-3">
                            {sets.map((set, si) => (
                                <RecommendationCard key={si} set={set} index={si} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
                            <p className="text-sm font-medium text-slate-500">
                                {loading ? '추천 로직을 실행하고 있습니다.' : '상단 버튼을 눌러 새로운 추천 번호를 받아보세요.'}
                            </p>
                        </div>
                    )}
                </SectionCard>
            </section>

            <section className="mt-5 lg:mt-6">
                <SectionCard
                    title="백테스트 규칙 진단"
                    eyebrow="알고리즘 진단"
                    icon={<Info className="h-5 w-5" />}
                    action={
                        <button
                            onClick={loadBacktestDiagnostics}
                            disabled={backtestLoading}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition disabled:opacity-60"
                        >
                            {backtestLoading ? '분석 중...' : '진단 새로고침'}
                        </button>
                    }
                >
                    {backtestDiagnostics ? (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">평가 회차</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.evaluatedDraws}</div>
                                </div>
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">세트 평균 일치</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.averageMatchPerSet.toFixed(3)}</div>
                                </div>
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">회차 최고 평균</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.averageBestMatchPerDraw.toFixed(3)}</div>
                                </div>
                                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                                    <div className="text-xs text-slate-500">공통 규칙 통과율</div>
                                    <div className="mt-1 text-xl font-semibold text-slate-950">{backtestDiagnostics.generationQuality.commonRulePassRate.toFixed(1)}%</div>
                                </div>
                            </div>

                            <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:p-5">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">백테스트 가중치</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-800">현재 규칙 가중치</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 sm:text-sm">최근 데이터로 계산한 현재 우선순위입니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {backtestDiagnostics.ruleDiagnostics.currentWeights.map((item, index) => (
                                        <RuleWeightCard key={`backtest-${item.ruleId}`} item={item} index={index} />
                                    ))}
                                </div>
                            </div>

                            <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-white/70 p-4 sm:p-5">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">규칙 성과 분석</p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-800">규칙별 백테스트 성과</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 sm:text-sm">규칙별 생성 결과와 폴백 비율입니다.</p>
                                </div>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {backtestDiagnostics.ruleDiagnostics.performance.map((item) => (
                                        <RulePerformanceCard key={item.ruleId} item={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
                            {backtestLoading ? '백테스트 진단을 계산하고 있습니다.' : '백테스트 진단 데이터를 불러오지 못했습니다.'}
                        </div>
                    )}
                </SectionCard>
            </section>

            <section id="lookup-section" className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-[0.85fr_1.15fr]">
                <SectionCard title="회차 탐색" eyebrow="회차 조회" icon={<Search className="h-5 w-5" />}>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="number"
                            min={1}
                            value={searchInput}
                            onChange={e => {
                                setSearchInput(e.target.value);
                                setSearchResult(null);
                                setSearchError('');
                            }}
                            onKeyDown={e => e.key === 'Enter' && searchDraw()}
                            placeholder="예: 1158"
                            className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                        />
                        <button
                            onClick={searchDraw}
                            className="btn-primary inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition sm:min-w-[120px]"
                        >
                            회차 조회
                        </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                        {searchError ? (
                            <p className="text-sm font-medium text-rose-600">{searchError}</p>
                        ) : searchResult ? (
                            <DrawResultCard draw={searchResult} chipLabel="조회 결과" />
                        ) : (
                            <p className="text-sm text-slate-500">회차 번호를 입력하면 당첨 번호와 1등 당첨금을 바로 확인할 수 있습니다.</p>
                        )}
                    </div>
                </SectionCard>

                <SectionCard title="최근 회차 히스토리" eyebrow="최근 회차" icon={<ChevronRight className="h-5 w-5" />}>
                    {results.length > 1 ? (
                        <>
                            <div className="history-table rounded-[24px] p-3 sm:p-4">
                                <div className="space-y-2">
                                    {pagedResults.map(draw => (
                                        <div key={draw.drwNo} className="history-row rounded-[22px] px-4 py-4">
                                            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[88px_1fr_96px] lg:items-center">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-950">{draw.drwNo}회</div>
                                                    <div className="mt-1 text-xs text-slate-500">{draw.drwNoDate}</div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {[draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6].map((num, i) => (
                                                        <Ball key={i} num={num} size="sm" delay={i * 15} />
                                                    ))}
                                                    <span className="mx-1 text-sm font-semibold text-slate-300">+</span>
                                                    <div className="relative">
                                                        <Ball num={draw.bnusNo} size="sm" />
                                                        <BonusBadge compact />
                                                    </div>
                                                </div>
                                                <div className="text-left lg:text-right">
                                                    <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 lg:inline-flex">
                                                        {draw.firstWinamnt ? `${(draw.firstWinamnt / 100000000).toFixed(1).replace(/\.0$/, '')}억 원` : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="text-sm font-medium text-slate-500">{page + 1} / {totalPages}</span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">표시할 과거 회차가 아직 없습니다.</p>
                    )}
                </SectionCard>
            </section>

            <section className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1.2fr_0.8fr]">
                <SectionCard title="번호 색상 안내" eyebrow="번호 안내" icon={<Waves className="h-5 w-5" />} bodyClassName="py-4 sm:py-4">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {[1, 11, 21, 31, 41].map((n, i) => {
                            const label = ['1-10', '11-20', '21-30', '31-40', '41-45'][i];
                            return (
                                <div key={label} className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-3 text-center sm:px-3 sm:py-3.5">
                                    <div className="flex justify-center">
                                        <Ball num={n} size="sm" />
                                    </div>
                                    <div className="mt-2 text-[11px] font-medium text-slate-500 sm:text-xs">{label}</div>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            </section>

            <section className="mt-4 lg:mt-5">
                <div className="flex flex-col gap-2 rounded-[24px] border border-slate-200/60 bg-white px-4 py-4 text-[13px] text-slate-600 shadow-sm sm:flex-row sm:items-start sm:px-5 sm:text-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 sm:h-5 sm:w-5" />
                    <p className="leading-5 sm:leading-6">
                        본 서비스는 과거 당첨 데이터를 바탕으로 정보를 정리하고 추천 번호를 제공하는 참고용 도구입니다. 당첨을 보장하지 않으며,
                        건전한 이용을 위해 과도한 몰입은 피하시기 바랍니다. 생성형 알고리즘 사용 사실을 함께 안내합니다.
                    </p>
                </div>
            </section>
        </>
    );
}
