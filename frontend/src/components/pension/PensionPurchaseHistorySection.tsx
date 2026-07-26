import { Trash2 } from 'lucide-react';
import type { PensionPurchaseTicket } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { buildPensionBandRows, PENSION_DIGIT_COLORS, type PensionBandRow } from '../../utils/pension-bands';
import { PensionDigitBall } from './PensionNumberDisplay';

const PENSION_RANKS = [1, 2, 3, 4, 5, 6, 7];

// 티켓 하단 합계. API가 준 prizeCounts를 그대로 쓴다 (조별 파생과 별개).
function formatPensionPrize(prizeCounts: Record<number, number>) {
    return PENSION_RANKS
        .filter(rank => (prizeCounts[rank] ?? 0) > 0)
        .map(rank => `${rank}등 ${prizeCounts[rank]}매`)
        .join(' · ');
}

function PensionBandRankBadge({ row }: { row: PensionBandRow }) {
    if (!row.judged) {
        return <span className="neo-badge neo-badge-compact py-0.5 text-[10px]">추첨 전</span>;
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-1">
            {row.rank !== null && (
                <span className="neo-badge neo-badge-compact neo-badge-yellow py-0.5 text-[10px]">
                    {row.rank}등
                </span>
            )}
            {row.bonus && (
                <span className="neo-badge neo-badge-compact neo-badge-purple py-0.5 text-[10px]">보너스</span>
            )}
            {row.rank === null && !row.bonus && (
                <span className="neo-badge neo-badge-compact py-0.5 text-[10px] text-slate-500">낙첨</span>
            )}
        </div>
    );
}

function PensionBandRowView({ row }: { row: PensionBandRow }) {
    return (
        <div className="flex items-center gap-2 border-b border-slate-200 py-2 last:border-b-0 sm:gap-3">
            <span className="w-8 shrink-0 text-center text-xs font-black text-black sm:w-9 sm:text-sm">
                {row.band}조
            </span>
            <div className="flex flex-1 items-center gap-1 sm:gap-1.5">
                {row.digits.map((digit, index) => {
                    const matched = row.judged && index >= row.matchedFrom;
                    return (
                        <span
                            key={index}
                            className="inline-flex"
                            style={row.judged && !matched ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}
                        >
                            <PensionDigitBall value={digit} color={PENSION_DIGIT_COLORS[index]} size="sm" />
                        </span>
                    );
                })}
            </div>
            <div className="flex shrink-0 items-center justify-end">
                <PensionBandRankBadge row={row} />
            </div>
        </div>
    );
}

export function PensionPurchaseTicketCard({
    ticket,
    onDelete,
}: {
    ticket: PensionPurchaseTicket;
    onDelete: (ticketId: string) => void;
}) {
    const game = ticket.games[0];
    if (!game) return null;

    const rows = buildPensionBandRows(game, ticket.draw?.winningBand ?? null);
    const ruleName = game.ruleId ? (PENSION_RULE_LABELS[game.ruleId] ?? game.ruleId) : game.label;
    const prizeText = game.prizeCounts ? formatPensionPrize(game.prizeCounts) : '';

    return (
        <div className="neo-card bg-white px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-black">제 {ticket.drawNo}회</span>
                    <span className="neo-badge neo-badge-purple py-0.5 text-[10px]">각조 구매</span>
                    {ticket.status === 'pending' ? (
                        <span className="neo-badge neo-badge-blue py-0.5 text-[10px]">추첨 전</span>
                    ) : (
                        <span className="neo-badge py-0.5 text-[10px]">판정 완료</span>
                    )}
                    {ruleName && <span className="neo-badge py-0.5 text-[10px]">{ruleName}</span>}
                </div>
                <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-slate-500">
                        {formatDateTime(new Date(ticket.createdAt))}
                    </span>
                    <button
                        type="button"
                        aria-label="티켓 삭제"
                        onClick={() => onDelete(ticket.ticketId)}
                        className="neo-btn inline-flex h-8 w-8 items-center justify-center p-0"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="mt-2">
                {rows.map(row => (
                    <PensionBandRowView key={row.band} row={row} />
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-600">
                {ticket.status === 'judged' && ticket.draw ? (
                    <>
                        <span>당첨</span>
                        <span className="font-black text-black">
                            {ticket.draw.winningBand}조 {ticket.draw.winningNumber}
                        </span>
                        <span>· 보너스 {ticket.draw.bonusNumber}</span>
                        <span className="font-black text-black">
                            · {prizeText !== '' ? prizeText : '낙첨'}
                            {game.bonusMatched ? ` · 보너스 ${PENSION_BANDS_PER_TICKET}매` : ''}
                        </span>
                    </>
                ) : (
                    <span>추첨 후 자동으로 판정됩니다.</span>
                )}
            </div>
        </div>
    );
}

export function PensionPurchaseHistorySection({
    tickets,
    loading,
    onDelete,
}: {
    tickets: PensionPurchaseTicket[];
    loading: boolean;
    onDelete: (ticketId: string) => void;
}) {
    if (tickets.length === 0) {
        return (
            <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                {loading ? '구매 기록을 불러오는 중입니다.' : '저장된 구매번호가 없습니다. 대표 추천 카드에서 "이 번호로 구매"를 눌러보세요.'}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {tickets.map(ticket => (
                <PensionPurchaseTicketCard key={ticket.ticketId} ticket={ticket} onDelete={onDelete} />
            ))}
        </div>
    );
}
