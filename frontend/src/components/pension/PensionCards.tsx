import type { PensionRecommendationSet, PensionRulePerformance } from '../../types';
import { PENSION_RULE_LABELS } from '../../constants';
import { PensionDigitBall } from './PensionNumberDisplay';

const RECOMMENDATION_COLORS = ['#ea580c', '#fb8c00', '#fbbc04', '#2d9cdb', '#a06cd5', '#b0b7c3'];

export function PensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="neo-card px-4 py-5 sm:px-6 sm:py-7 bg-white">
            <div className="text-center">
                <div className="mb-2">
                    <span className="neo-badge neo-badge-purple">
                        {set.label}
                    </span>
                </div>
                <h3 className="mt-2 text-xl font-black text-black sm:text-[28px]">
                    연금복권 추천번호
                </h3>
                
                {/* 하위 규칙 및 가중치 정보 표시 */}
                {(set.meta.ruleWeight || ruleName) && (
                    <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                        {set.meta.ruleWeight ? (
                            <span className="neo-badge neo-badge-blue py-1 text-xs">
                                가중치 {set.meta.ruleWeight.toFixed(3)}
                            </span>
                        ) : null}
                        {ruleName ? (
                            <span className="neo-badge neo-badge-yellow py-1 text-xs">
                                {ruleName}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="result-divider mt-7" />

            {/* 추천 숫자 목록 — 한 줄(nowrap) 유지 */}
            <div className="mt-7 flex items-center justify-center gap-1.5 sm:gap-2.5">
                <div className="shrink-0 px-1 text-sm font-black text-black sm:text-base">각조</div>
                {set.number.split('').map((digit, index) => (
                    <PensionDigitBall key={`${set.label}-${index}`} value={digit} color={RECOMMENDATION_COLORS[index]} size="sm" />
                ))}
            </div>

            <div className="result-label-row mt-5">
                <span className="result-label-line" />
                <span className="result-label-text">추천번호</span>
                <span className="result-label-line" />
            </div>

            {/* 개별 메타 속성 분석 */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-slate-700 sm:text-sm">
                <span className="neo-badge">합계 {set.meta.sum}</span>
                <span className="neo-badge">홀수 {set.meta.oddCount}개</span>
                <span className="neo-badge">고유숫자 {set.meta.uniqueDigitCount}개</span>
                <span className="neo-badge">최대 중복 {set.meta.maxDuplicateCount}개</span>
            </div>
        </div>
    );
}

export function FeaturedPensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
    const ruleName = set.meta.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : null;

    return (
        <div className="neo-card px-5 py-6 sm:px-7 sm:py-7 bg-[#fffdf5]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b-2 border-black pb-4">
                <div>
                    <div className="mb-2">
                        <span className="neo-badge neo-badge-yellow">
                            대표 추천 1세트
                        </span>
                    </div>
                    <h3 className="mt-2 text-2xl font-black text-black sm:text-[32px] tracking-tighter">
                        {set.label}
                    </h3>
                    <p className="mt-2 text-sm font-bold text-slate-700">
                        현재 추천 성향 우선순위에서 가장 먼저 선택된 대표 조합입니다.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {set.meta.ruleWeight ? (
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
                </div>

                {/* 내측 숫자 볼 영역 — 한 줄(nowrap) 유지 */}
                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[2px_2px_0px_0px_#000000]">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
                        <div className="shrink-0 px-1 text-sm font-black text-black sm:text-base">각조</div>
                        {set.number.split('').map((digit, index) => (
                            <PensionDigitBall key={`featured-${set.label}-${index}`} value={digit} color={RECOMMENDATION_COLORS[index]} size="sm" />
                        ))}
                    </div>
                </div>
            </div>

            {/* 하단 개별 통계 세부 분석 */}
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000000]">
                    <div className="text-xs font-bold text-slate-700">합계</div>
                    <div className="mt-1 text-lg font-black text-black">{set.meta.sum}</div>
                </div>
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000000]">
                    <div className="text-xs font-bold text-slate-700">홀수 개수</div>
                    <div className="mt-1 text-lg font-black text-black">{set.meta.oddCount}개</div>
                </div>
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000000]">
                    <div className="text-xs font-bold text-slate-700">고유 숫자</div>
                    <div className="mt-1 text-lg font-black text-black">{set.meta.uniqueDigitCount}개</div>
                </div>
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000000]">
                    <div className="text-xs font-bold text-slate-700">최대 중복</div>
                    <div className="mt-1 text-lg font-black text-black">{set.meta.maxDuplicateCount}개</div>
                </div>
            </div>
        </div>
    );
}

export function PensionRulePerformanceCard({ item }: { item: PensionRulePerformance }) {
    return (
        /* 카드 중첩에 의한 테두리 번잡함을 줄이기 위해 외부 검은 외곽선 제거 및 회색 백그라운드 처리 */
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                    <div className="text-base font-black text-black">{PENSION_RULE_LABELS[item.ruleId] ?? item.label}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">생성 {item.generatedCount}회</div>
                </div>
                <span className="neo-badge neo-badge-purple text-xs">
                    평균 정확 일치 {item.averageExactMatches.toFixed(3)}
                </span>
            </div>

            {/* 규칙별 세부 일치 지표 (내부 블랙 보더 제거 및 심플 레이아웃화) */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-slate-700 sm:text-sm">
                <div className="bg-white border border-slate-200/80 rounded-lg px-3 py-2 shadow-sm">
                    <div className="text-[10px] text-slate-500">3자리 이상 일치</div>
                    <div className="mt-1 font-black text-black">{item.exactMatch3PlusRate.toFixed(1)}%</div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg px-3 py-2 shadow-sm">
                    <div className="text-[10px] text-slate-500">4자리 이상 일치</div>
                    <div className="mt-1 font-black text-black">{item.exactMatch4PlusRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
