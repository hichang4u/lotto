import { X } from 'lucide-react';
import type { LottoSet } from '../../types';
import { LOTTO_RULE_LABELS } from '../../constants';
import { Ball } from '../ui/Ball';

const GAME_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// 실제 로또 구매용지처럼 A~E 5게임을 한 장으로 보여주는 모달
export function PurchaseTicketModal({
    sets,
    targetDrawNo,
    saving,
    onSave,
    onClose,
}: {
    sets: LottoSet[];
    targetDrawNo: number;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="구매 티켓"
            onClick={onClose}
        >
            <div
                className="neo-card w-full max-w-lg bg-white px-5 py-6 sm:px-7"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b-2 border-black pb-4">
                    <div>
                        <span className="neo-badge neo-badge-yellow">구매 티켓</span>
                        <h3 className="mt-2 text-xl font-black text-black sm:text-2xl">
                            제 {targetDrawNo}회 추첨
                        </h3>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                            아래 5게임이 한 장의 티켓으로 저장됩니다.
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
                            ? (LOTTO_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId)
                            : set.label;
                        return (
                            <div
                                key={index}
                                className="flex items-center gap-2.5 border-2 border-black bg-white rounded-xl px-3 py-2.5 shadow-[2px_2px_0px_0px_#000000]"
                            >
                                <span className="w-6 shrink-0 text-center text-base font-black text-black">
                                    {GAME_LETTERS[index]}
                                </span>
                                <div className="flex flex-1 items-center justify-center gap-1.5">
                                    {set.numbers.map(num => (
                                        <Ball key={num} num={num} size="sm" />
                                    ))}
                                </div>
                                <span className="hidden shrink-0 text-[10px] font-bold text-slate-500 sm:block">
                                    {ruleName}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-black pt-4">
                    <button type="button" onClick={onClose} className="neo-btn inline-flex h-10 px-4 text-sm">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="neo-btn neo-btn-primary inline-flex h-10 px-5 text-sm disabled:opacity-60"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
