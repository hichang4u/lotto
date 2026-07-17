import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PensionDrawResult } from '../../types';
import { PensionNumberRow } from './PensionNumberDisplay';

export function PensionResultCard({
    draw,
    chipLabel,
    variant = 'default',
    onPrimaryAction,
    primaryActionLabel,
    primaryDisabled = false,
    statusText,
    onPrevDraw,
    onNextDraw,
    hasPrevDraw = false,
    hasNextDraw = false,
    isLoading = false,
}: {
    draw: PensionDrawResult;
    chipLabel?: string;
    variant?: 'default' | 'latest';
    onPrimaryAction?: () => void;
    primaryActionLabel?: string;
    primaryDisabled?: boolean;
    statusText?: string;
    onPrevDraw?: () => void;
    onNextDraw?: () => void;
    hasPrevDraw?: boolean;
    hasNextDraw?: boolean;
    isLoading?: boolean;
}) {
    const numbers = draw.winning_number.split('').map(Number).filter(num => !Number.isNaN(num));
    const oddCount = numbers.filter(num => num % 2 === 1).length;
    const sum = numbers.reduce((total, num) => total + num, 0);

    // 최신 회차 결과 (메인 히어로 카드) 레이아웃
    if (variant === 'latest') {
        return (
            <div className="neo-card neo-card--soft relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
                {/* 상단 마지막 동기화 일자 상태 노티 바 */}
                {statusText && (
                    <div className="mb-5 border-2 border-black bg-white rounded-xl px-4 py-2.5 text-center shadow-[3px_3px_0px_0px_#000] sm:mb-7">
                        <p className="text-xs font-bold text-slate-700 sm:text-sm">{statusText}</p>
                    </div>
                )}

                <div className="text-center">
                    <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8b5cf6] sm:text-sm">PENSION 720+</div>
                    <h3 className="mt-1 text-xl font-black text-black sm:text-2xl">연금복권720+</h3>
                </div>

                {/* 중앙 회차 헤딩 및 좌우 화살표 */}
                <div className="latest-feature-heading mt-8 sm:mt-10">
                    <button 
                        className="result-arrow-shell result-arrow-left"
                        onClick={onPrevDraw}
                        disabled={!hasPrevDraw}
                        title="이전 회차"
                        aria-label="이전 회차"
                    >
                        <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
                    </button>
                    <div className="text-center">
                        <div className="text-[46px] font-black tracking-tighter text-black sm:text-[60px]">{draw.draw_no}회</div>
                        <div className="mt-1 text-sm font-bold text-slate-700 sm:text-base">{draw.draw_date} 추첨</div>
                    </div>
                    <button 
                        className="result-arrow-shell result-arrow-right"
                        onClick={onNextDraw}
                        disabled={!hasNextDraw}
                        title={hasNextDraw ? '다음 회차' : '최신 회차입니다'}
                        aria-label="다음 회차"
                    >
                        <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
                    </button>
                </div>

                <div className="result-divider mt-8 sm:mt-10" />

                {/* 당첨 번호 디스플레이 리스트 */}
                <div className="mt-9">
                    <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                    <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
                </div>

                {/* 하단 제어 버튼 그룹 */}
                <div className="mt-10 sm:mt-12">
                    <button
                        type="button"
                        onClick={onPrimaryAction}
                        disabled={primaryDisabled}
                        className="neo-btn neo-btn-purple w-full min-h-[52px] text-sm sm:text-base"
                    >
                        {primaryActionLabel ?? '최신 결과 동기화'}
                    </button>
                </div>

                {/* 하단 요약 배지/메타 정보 */}
                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-700 sm:mt-8 sm:text-sm">
                    <span className="neo-badge neo-badge-purple">조 {draw.winning_band}</span>
                    <span className="neo-badge neo-badge-blue">번호 합계 {sum}</span>
                    <span className="neo-badge neo-badge-yellow">홀수 {oddCount}개</span>
                </div>

                {/* 로딩 오버레이 */}
                {isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1.5px] transition-all duration-200">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-purple-600" />
                            <span className="text-xs font-black text-black">불러오는 중...</span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 일반 회차 조회 결과 레이아웃
    return (
        <div className="neo-card relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="relative text-center">
                <div className="mb-3">
                    <span className="neo-badge neo-badge-purple">
                        {chipLabel ?? '조회 결과'}
                    </span>
                </div>
                <h3 className="mt-2 text-[26px] font-black tracking-tighter text-black sm:text-[36px]">
                    제 <span className="text-[#8b5cf6]">{draw.draw_no}</span>회 추첨 결과
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-700 sm:text-base">{draw.draw_date} 추첨</p>
            </div>

            <div className="result-divider mt-7" />

            <div className="mt-8">
                <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
            </div>

            {/* 개별 분석 상세 박스 목록 */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000]">
                    <div className="text-[11px] font-black text-slate-700">당첨 조</div>
                    <div className="mt-1 text-lg font-black text-black">{draw.winning_band}</div>
                </div>
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000]">
                    <div className="text-[11px] font-black text-slate-700">번호 합계</div>
                    <div className="mt-1 text-lg font-black text-black">{sum}</div>
                </div>
                <div className="border-2 border-black bg-white rounded-xl px-4 py-3 text-center sm:text-left shadow-[2px_2px_0px_0px_#000]">
                    <div className="text-[11px] font-black text-slate-700">홀수 개수</div>
                    <div className="mt-1 text-lg font-black text-black">{oddCount}</div>
                </div>
            </div>

            {/* 로딩 오버레이 */}
            {isLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1.5px] transition-all duration-200">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-purple-600" />
                        <span className="text-xs font-black text-black">불러오는 중...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
