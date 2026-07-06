import type { LottoRuleWeight, LottoRulePerformance } from '../../types';

export function RuleWeightCard({ item, index }: { item: LottoRuleWeight; index: number }) {
    return (
        /* 외부의 강한 테두리 및 섀도우를 걷어내고 부드러운 플랫 그레이 배경으로 변경하여 시각적 간섭을 해소 */
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] font-black text-slate-500">우선순위 {index + 1}</div>
                    <div className="mt-1.5 text-base font-black text-black">{item.label}</div>
                </div>
                <span className="neo-badge neo-badge-yellow text-xs">
                    가중치 {item.weight.toFixed(3)}
                </span>
            </div>

            {/* 규칙 가중치 프로그레스 바 및 서브 데이터 */}
            <div className="mt-4 space-y-3">
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>규칙 점수</span>
                        <span>{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    {/* 게이지 바 역시 얇고 평면적인 스타일로 통일 */}
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-[#3b82f6]" style={{ width: `${Math.max(item.score * 100, 6)}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 sm:text-sm">
                    {/* 내부 그리드의 블랙 테두리와 섀도우도 걷어내고 흰색의 소프트 보더 카드로 대체 */}
                    <div className="bg-white border border-slate-200/80 rounded-lg px-3 py-2 shadow-sm">
                        <div className="text-[10px] text-slate-500">공통+세트 통과</div>
                        <div className="mt-1 font-black text-black">{(item.passRate * 100).toFixed(1)}%</div>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg px-3 py-2 shadow-sm">
                        <div className="text-[10px] text-slate-500">세트 규칙 일치</div>
                        <div className="mt-1 font-black text-black">{(item.recentMatchRate * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function RulePerformanceCard({ item }: { item: LottoRulePerformance }) {
    return (
        /* 카드 중첩에 의한 테두리 번잡함을 줄이기 위해 외부 검은 외곽선 제거 */
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-black text-black">{item.label}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">생성 {item.generatedCount}회</div>
                </div>
                <span className="neo-badge neo-badge-purple text-xs">
                    평균 일치 {item.averageMatches.toFixed(3)}
                </span>
            </div>

            {/* 규칙 성과 디테일 그리드 (내부 블랙 보더 제거 및 심플 레이아웃화) */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold text-slate-700 sm:text-sm">
                <div className="bg-white border border-slate-200/80 rounded-lg px-2 py-2 shadow-sm">
                    <div className="text-[9px] text-slate-500">공통 규칙</div>
                    <div className="mt-1 font-black text-black">{item.commonRulePassRate.toFixed(1)}%</div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg px-2 py-2 shadow-sm">
                    <div className="text-[9px] text-slate-500">완화 폴백</div>
                    <div className="mt-1 font-black text-black">{item.relaxedFallbackRate.toFixed(1)}%</div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg px-2 py-2 shadow-sm">
                    <div className="text-[9px] text-slate-500">랜덤 폴백</div>
                    <div className="mt-1 font-black text-black">{item.randomFallbackRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
