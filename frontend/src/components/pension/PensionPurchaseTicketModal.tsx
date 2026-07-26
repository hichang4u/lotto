import { X } from 'lucide-react';
import type { PensionRecommendationSet } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { PENSION_BAND_NUMBERS, PENSION_DIGIT_COLORS, toSixDigits } from '../../utils/pension-bands';
import { PensionDigitBall } from './PensionNumberDisplay';

const PRICE_PER_BAND = 1000;

// 각조 구매 용지처럼 대표 1세트를 1조~5조 5줄로 펼쳐 보여주는 모달
export function PensionPurchaseTicketModal({
    set,
    targetDrawNo,
    saving,
    onSave,
    onClose,
}: {
    set: PensionRecommendationSet;
    targetDrawNo: number;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    const digits = toSixDigits(set.number).split('');
    const ruleName = set.meta?.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : set.label;
    const totalPrice = PENSION_BANDS_PER_TICKET * PRICE_PER_BAND;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="연금복권 구매 티켓"
            onClick={onClose}
        >
            <div
                className="neo-card w-full max-w-lg bg-white px-5 py-6 sm:px-7"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b-2 border-black pb-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="neo-badge neo-badge-yellow">구매 티켓</span>
                            <span className="neo-badge neo-badge-purple">각조 구매</span>
                        </div>
                        <h3 className="mt-2 text-xl font-black text-black sm:text-2xl">
                            제 {targetDrawNo}회 추첨
                        </h3>
                        <p className="mt-1 text-xs font-bold text-slate-600">{ruleName}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="neo-btn inline-flex h-9 w-9 items-center justify-center p-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4 space-y-2.5">
                    {PENSION_BAND_NUMBERS.map(band => (
                        <div
                            key={band}
                            className="flex items-center gap-2 border-2 border-black bg-white rounded-xl px-3 py-2.5 shadow-[2px_2px_0px_0px_#000000] sm:gap-3"
                        >
                            <span className="w-9 shrink-0 text-center text-sm font-black text-black">
                                {band}조
                            </span>
                            <div className="flex flex-1 items-center justify-center gap-1 sm:gap-1.5">
                                {digits.map((digit, digitIndex) => (
                                    <PensionDigitBall
                                        key={`${band}-${digitIndex}`}
                                        value={digit}
                                        color={PENSION_DIGIT_COLORS[digitIndex]}
                                        size="sm"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <p className="mt-3 text-center text-[11px] font-bold text-slate-600">
                    1번호 × 각조 {PENSION_BANDS_PER_TICKET}매 = {totalPrice.toLocaleString('ko-KR')}원
                </p>

                <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-black pt-4">
                    <button type="button" onClick={onClose} className="neo-btn inline-flex h-10 px-4 text-sm">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="neo-btn neo-btn-purple inline-flex h-10 px-5 text-sm disabled:opacity-60"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
