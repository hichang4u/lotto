import type { LottoRuleWeight, LottoRulePerformance } from '../../types';

export function RuleWeightCard({ item, index }: { item: LottoRuleWeight; index: number }) {
    return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">우선순위 {index + 1}</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{item.label}</div>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    가중치 {item.weight.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                        <span>규칙 점수</span>
                        <span>{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(item.score * 100, 6)}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:text-sm">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div>공통+세트 통과</div>
                        <div className="mt-1 font-semibold text-slate-900">{(item.passRate * 100).toFixed(1)}%</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div>세트 규칙 일치</div>
                        <div className="mt-1 font-semibold text-slate-900">{(item.recentMatchRate * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function RulePerformanceCard({ item }: { item: LottoRulePerformance }) {
    return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-slate-950">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">생성 {item.generatedCount}회</div>
                </div>
                <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    평균 일치 {item.averageMatches.toFixed(3)}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500 sm:text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>공통 규칙</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.commonRulePassRate.toFixed(1)}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>완화 폴백</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.relaxedFallbackRate.toFixed(1)}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div>랜덤 폴백</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.randomFallbackRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
