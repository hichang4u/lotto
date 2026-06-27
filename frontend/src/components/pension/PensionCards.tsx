import type { PensionRecommendationSet, PensionRulePerformance } from '../../types';
import { PENSION_RULE_LABELS } from '../../constants';
import { PensionDigitBall } from './PensionNumberDisplay';

const RECOMMENDATION_COLORS = ['#ea580c', '#fb8c00', '#fbbc04', '#2d9cdb', '#a06cd5', '#b0b7c3'];

export function PensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="recommend-card rounded-[28px] px-4 py-5 sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    {set.label}
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">
                    연금복권 추천번호
                </h3>
                {(set.meta.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 sm:text-sm">
                        {set.meta.ruleWeight ? (
                            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-semibold text-slate-700">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                <div className="px-1 text-base font-medium text-slate-500 sm:text-lg">각조</div>
                {set.number.split('').map((digit, index) => (
                    <PensionDigitBall key={`${set.label}-${index}`} value={digit} color={RECOMMENDATION_COLORS[index]} />
                ))}
            </div>

            <div className="result-label-row mt-5">
                <span className="result-label-line" />
                <span className="result-label-text">추천번호</span>
                <span className="result-label-line" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 sm:text-base">
                <span>합계 {set.meta.sum}</span>
                <span className="text-slate-300">/</span>
                <span>홀수 {set.meta.oddCount}개</span>
                <span className="text-slate-300">/</span>
                <span>고유숫자 {set.meta.uniqueDigitCount}개</span>
                <span className="text-slate-300">/</span>
                <span>최대 중복 {set.meta.maxDuplicateCount}개</span>
            </div>
        </div>
    );
}

export function FeaturedPensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="rounded-[30px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.92))] px-5 py-6 shadow-[0_20px_60px_rgba(16,185,129,0.10)] sm:px-7 sm:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                        대표 추천 1세트
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[32px]">
                        {set.label}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 sm:text-base">
                        현재 추천 성향 우선순위에서 가장 먼저 선택된 대표 조합입니다.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:text-sm">
                        {set.meta.ruleWeight ? (
                            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 font-semibold text-slate-700">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-[24px] border border-white/70 bg-white/75 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                        <div className="px-1 text-base font-medium text-slate-500 sm:text-lg">각조</div>
                        {set.number.split('').map((digit, index) => (
                            <PensionDigitBall key={`featured-${set.label}-${index}`} value={digit} color={RECOMMENDATION_COLORS[index]} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs text-slate-500">합계</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{set.meta.sum}</div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs text-slate-500">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{set.meta.oddCount}개</div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs text-slate-500">고유 숫자</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{set.meta.uniqueDigitCount}개</div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs text-slate-500">최대 중복</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{set.meta.maxDuplicateCount}개</div>
                </div>
            </div>
        </div>
    );
}

export function PensionRulePerformanceCard({ item }: { item: PensionRulePerformance }) {
    return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-slate-950">{PENSION_RULE_LABELS[item.ruleId] ?? item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">생성 {item.generatedCount}회</div>
                </div>
                <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    평균 정확 일치 {item.averageExactMatches.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>3자리 이상 일치</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.exactMatch3PlusRate.toFixed(1)}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>4자리 이상 일치</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.exactMatch4PlusRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
