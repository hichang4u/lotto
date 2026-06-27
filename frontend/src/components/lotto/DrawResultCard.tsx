import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DrawResult } from '../../types';
import { formatMoneyKRW } from '../../utils/format';
import { Ball, BonusBadge } from '../ui/Ball';

export function DrawResultCard({
    draw,
    chipLabel,
    variant = 'default',
    onPrimaryAction,
    onSecondaryAction,
    primaryActionLabel,
    secondaryActionLabel,
    primaryDisabled = false,
    statusText,
}: {
    draw: DrawResult;
    chipLabel: string;
    variant?: 'default' | 'latest';
    onPrimaryAction?: () => void;
    onSecondaryAction?: () => void;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
    primaryDisabled?: boolean;
    statusText?: string;
}) {
    const numbers = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
    const oddCount = numbers.filter(num => num % 2 === 1).length;
    const sum = numbers.reduce((total, num) => total + num, 0);

    if (variant === 'latest') {
        return (
            <div className="latest-feature-card rounded-[30px] px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
                {statusText && (
                    <div className="latest-feature-status mb-5 rounded-2xl px-4 py-3 text-center sm:mb-7">
                        <p className="text-xs font-medium tracking-[-0.01em] text-slate-600 sm:text-sm">{statusText}</p>
                    </div>
                )}

                <div className="text-center">
                    <img
                        src="/images/img-mainLt645.svg"
                        alt="Lotto 6/45"
                        className="lotto-mark-image mx-auto"
                    />
                </div>

                <div className="latest-feature-heading mt-8 sm:mt-10">
                    <div className="result-arrow-shell result-arrow-left">
                        <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <div className="text-[42px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[56px]">{draw.drwNo}회</div>
                        <div className="mt-1 text-[18px] font-medium text-slate-500 sm:text-[20px]">{draw.drwNoDate}</div>
                    </div>
                    <div className="result-arrow-shell result-arrow-right text-slate-300">
                        <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="result-divider mt-8 sm:mt-10" />

                <div className="mt-9 flex items-center justify-center gap-3 sm:gap-4 lg:gap-5">
                    {numbers.map((num, i) => (
                        <Ball key={i} num={num} size="responsive" delay={i * 20} />
                    ))}
                    <span className="text-4xl font-light text-slate-300 sm:text-5xl">+</span>
                    <div className="relative">
                        <Ball num={draw.bnusNo} size="responsive" />
                        <BonusBadge />
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-[16px] font-medium text-slate-500 sm:text-[18px]">1등 당첨금</p>
                    <p className="mt-3 text-[36px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[54px]">
                        {formatMoneyKRW(draw.firstWinamnt)}
                    </p>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4">
                    <button
                        type="button"
                        onClick={onSecondaryAction}
                        className="latest-feature-secondary inline-flex min-h-14 items-center justify-center rounded-[24px] px-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-800 transition sm:px-5 sm:text-lg"
                    >
                        {secondaryActionLabel ?? '회차 상세 보기'}
                    </button>
                    <button
                        type="button"
                        onClick={onPrimaryAction}
                        disabled={primaryDisabled}
                        className="latest-feature-primary inline-flex min-h-14 items-center justify-center rounded-[24px] px-3 text-[15px] font-semibold tracking-[-0.02em] text-white transition disabled:opacity-60 sm:px-5 sm:text-lg"
                    >
                        {primaryActionLabel ?? '최신 결과 동기화'}
                    </button>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 sm:mt-8 sm:text-base">
                    <span>보너스 {draw.bnusNo}</span>
                    <span className="text-slate-300">/</span>
                    <span>번호 합계 {sum}</span>
                    <span className="text-slate-300">/</span>
                    <span>홀수 {oddCount}개</span>
                </div>
            </div>
        );
    }

    return (
        <div className="latest-draw-card rounded-[24px] px-5 py-6 sm:rounded-[28px] sm:px-8 sm:py-9 lg:px-12 lg:py-10">
            <div className="relative text-center">
                <div className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                        <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 lg:flex">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                        <ChevronRight className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    {chipLabel}
                </div>
                <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[42px]">
                    제 <span className="text-emerald-600">{draw.drwNo}</span>회 추첨 결과
                </h3>
                <p className="mt-3 text-base font-medium text-slate-500 sm:text-[18px]">{draw.drwNoDate} 추첨</p>
                <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    1등 당첨금 {formatMoneyKRW(draw.firstWinamnt)}
                </div>
            </div>

            <div className="result-divider mt-8" />

            <div className="mt-8 flex flex-col items-center gap-5 lg:flex-row lg:items-end lg:justify-center lg:gap-10">
                <div className="result-number-group">
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        {numbers.map((num, i) => (
                            <Ball key={i} num={num} size="md" delay={i * 20} />
                        ))}
                    </div>
                    <div className="result-label-row mt-5">
                        <span className="result-label-line" />
                        <span className="result-label-text">당첨번호</span>
                        <span className="result-label-line" />
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4 lg:gap-8">
                    <span className="text-4xl font-light text-slate-300 sm:text-5xl">+</span>
                    <div className="result-number-group">
                        <div className="flex justify-center">
                            <div className="relative">
                                <Ball num={draw.bnusNo} size="md" />
                                <BonusBadge />
                            </div>
                        </div>
                        <div className="result-label-row mt-5">
                            <span className="result-label-line short" />
                            <span className="result-label-text">보너스번호</span>
                            <span className="result-label-line short" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 grid gap-2 sm:grid-cols-3">
                <div className="latest-draw-stat rounded-2xl px-3 py-3">
                    <div className="text-[11px] font-medium text-slate-500">보너스 번호</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{draw.bnusNo}</div>
                </div>
                <div className="latest-draw-stat rounded-2xl px-3 py-3">
                    <div className="text-[11px] font-medium text-slate-500">번호 합계</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{sum}</div>
                </div>
                <div className="latest-draw-stat rounded-2xl px-3 py-3">
                    <div className="text-[11px] font-medium text-slate-500">홀수 개수</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{oddCount}</div>
                </div>
            </div>
        </div>
    );
}
