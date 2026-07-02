import type { LottoSet } from '../../types';
import { LOTTO_RULE_LABELS } from '../../constants';
import { Ball } from '../ui/Ball';

export function RecommendationCard({
    set,
    index,
}: {
    set: LottoSet;
    index: number;
}) {
    const sum = set.numbers.reduce((total, num) => total + num, 0);
    const oddCount = set.numbers.filter(num => num % 2 === 1).length;
    const spread = Math.max(...set.numbers) - Math.min(...set.numbers);
    const ruleName = set.meta?.ruleId ? (LOTTO_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="rounded-[28px] border border-slate-200/60 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-7">
            <div className="text-center">
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    추천 Set {index + 1}
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-800 sm:text-[28px]">
                    {set.label}
                </h3>
                {(set.meta?.ruleWeight || ruleName) && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 sm:text-sm">
                        {set.meta?.ruleWeight ? (
                            <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                                weight {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 font-medium text-slate-600">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-7">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                    {set.numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={index * 70 + i * 30} />
                    ))}
                </div>
                <div className="result-label-row mt-5">
                    <span className="result-label-line" />
                    <span className="result-label-text">추천번호</span>
                    <span className="result-label-line" />
                </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 sm:mt-8 sm:text-base">
                <span>번호 합계 {sum}</span>
                <span className="text-slate-300">/</span>
                <span>홀수 {oddCount}개</span>
                <span className="text-slate-300">/</span>
                <span>최대 간격 {spread}</span>
            </div>
        </div>
    );
}
