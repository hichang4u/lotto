import { X } from 'lucide-react';
import type { PensionRecommendationSet } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { PensionDigitBall } from './PensionNumberDisplay';

const GAME_LETTERS = ['A', 'B', 'C', 'D'];
// 추천 카드와 동일한 자리별 링 색상 (1~6자리)
const DIGIT_COLORS = ['#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];
const PRICE_PER_BAND = 1000;

// 연금복권 구매용지처럼 A~D 4세트를 한 장으로 보여주는 모달
export function PensionPurchaseTicketModal({
    sets,
    targetDrawNo,
    saving,
    onSave,
    onClose,
}: {
    sets: PensionRecommendationSet[];
    targetDrawNo: number;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    const totalPrice = sets.length * PENSION_BANDS_PER_TICKET * PRICE_PER_BAND;

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
                        <p className="mt-1 text-xs font-bold text-slate-600">
                            아래 {sets.length}세트가 한 장의 티켓으로 저장됩니다.
                        </p>
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
                    {sets.map((set, index) => {
                        const ruleName = set.meta?.ruleId
                            ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId)
                            : set.label;
                        return (
                            <div
                                key={`${set.label}-${set.number}`}
                                className="flex items-center gap-1.5 border-2 border-black bg-white rounded-xl px-3 py-2.5 shadow-[2px_2px_0px_0px_#000000] sm:gap-2.5"
                            >
                                <span className="w-5 shrink-0 text-center text-base font-black text-black">
                                    {GAME_LETTERS[index] ?? index + 1}
                                </span>
                                <span className="shrink-0 text-[10px] font-black text-slate-500 sm:text-xs">각조</span>
                                <div className="flex flex-1 items-center justify-center gap-1 sm:gap-1.5">
                                    {set.number.padStart(6, '0').slice(-6).split('').map((digit, digitIndex) => (
                                        <PensionDigitBall
                                            key={`${set.label}-${digitIndex}`}
                                            value={digit}
                                            color={DIGIT_COLORS[digitIndex]}
                                            size="sm"
                                        />
                                    ))}
                                </div>
                                <span className="hidden shrink-0 text-[10px] font-bold text-slate-500 sm:block">
                                    {ruleName}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <p className="mt-3 text-center text-[11px] font-bold text-slate-600">
                    {sets.length}번호 × 각조 {PENSION_BANDS_PER_TICKET}매 = {totalPrice.toLocaleString('ko-KR')}원
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
