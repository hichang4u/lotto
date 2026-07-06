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
        <div className="neo-card px-4 py-5 sm:px-6 sm:py-7 bg-white">
            {/* 세트 헤더 정보 */}
            <div className="text-center">
                <div className="mb-2">
                    <span className="neo-badge neo-badge-yellow">
                        추천 Set {index + 1}
                    </span>
                </div>
                <h3 className="mt-2 text-xl font-black text-black sm:text-[28px]">
                    {set.label}
                </h3>
                
                {/* 하위 가중치 배지 정보 */}
                {(set.meta?.ruleWeight || ruleName) && (
                    <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                        {set.meta?.ruleWeight ? (
                            <span className="neo-badge neo-badge-blue py-1 text-xs">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="neo-badge neo-badge-purple py-1 text-xs">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            {/* 추천 번호 볼 디스플레이 */}
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

            {/* 메타데이터 상세 분석 */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-700 sm:mt-8 sm:text-sm">
                <span className="neo-badge">번호 합계 {sum}</span>
                <span className="neo-badge">홀수 {oddCount}개</span>
                <span className="neo-badge">최대 간격 {spread}</span>
            </div>
        </div>
    );
}
