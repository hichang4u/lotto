import { Trash2 } from 'lucide-react';
import type { PurchaseGameResult, PurchaseTicket } from '../../types';
import { LOTTO_RULE_LABELS } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { Ball, BonusBadge } from '../ui/Ball';

const GAME_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// 게임별 판정 배지: 추첨 전 / N등 / 낙첨
function GameRankBadge({ game }: { game: PurchaseGameResult }) {
    if (game.rank === null) {
        return <span className="neo-badge py-0.5 text-[10px]">추첨 전</span>;
    }
    if (game.rank >= 1) {
        return <span className="neo-badge neo-badge-yellow py-0.5 text-[10px]">{game.rank}등</span>;
    }
    return <span className="neo-badge py-0.5 text-[10px] text-slate-500">낙첨</span>;
}

function PurchaseGameRow({ game, draw }: { game: PurchaseGameResult; draw: PurchaseTicket['draw'] }) {
    const judged = game.rank !== null && draw !== null;
    const ruleName = game.ruleId ? (LOTTO_RULE_LABELS[game.ruleId] ?? game.ruleId) : game.label;

    return (
        <div className="flex items-center gap-2.5 border-b border-slate-200 py-2 last:border-b-0">
            <span className="w-5 shrink-0 text-center text-sm font-black text-black">
                {GAME_LETTERS[game.gameIndex] ?? game.gameIndex + 1}
            </span>
            <div className="flex flex-1 items-center gap-1.5">
                {game.numbers.map(num => {
                    // 판정 완료 시: 일치 볼만 원래 색, 불일치 볼은 회색조 + 반투명
                    const matched = judged && draw.numbers.includes(num);
                    const bonusMatched = judged && !matched && draw.bnusNo === num;
                    return (
                        <span
                            key={num}
                            className="relative inline-flex"
                            style={judged && !matched && !bonusMatched ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}
                        >
                            <Ball num={num} size="sm" />
                            {bonusMatched && <BonusBadge compact />}
                        </span>
                    );
                })}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <GameRankBadge game={game} />
                {ruleName && <span className="hidden text-[10px] font-bold text-slate-500 sm:block">{ruleName}</span>}
            </div>
        </div>
    );
}

export function PurchaseTicketCard({
    ticket,
    onDelete,
}: {
    ticket: PurchaseTicket;
    onDelete: (ticketId: string) => void;
}) {
    return (
        <div className="neo-card bg-white px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-black">제 {ticket.drawNo}회</span>
                    {ticket.status === 'pending' ? (
                        <span className="neo-badge neo-badge-blue py-0.5 text-[10px]">추첨 전</span>
                    ) : (
                        <span className="neo-badge neo-badge-purple py-0.5 text-[10px]">판정 완료</span>
                    )}
                    {ticket.algorithm && (
                        <span className="neo-badge py-0.5 text-[10px]">{ticket.algorithm}</span>
                    )}
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
                {ticket.games.map(game => (
                    <PurchaseGameRow key={game.gameIndex} game={game} draw={ticket.draw} />
                ))}
            </div>

            {ticket.status === 'judged' && ticket.draw && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-600">
                    <span>당첨번호</span>
                    <span className="font-black text-black">{ticket.draw.numbers.join(', ')}</span>
                    <span>+ 보너스 {ticket.draw.bnusNo}</span>
                </div>
            )}
        </div>
    );
}

export function PurchaseHistorySection({
    tickets,
    loading,
    onDelete,
}: {
    tickets: PurchaseTicket[];
    loading: boolean;
    onDelete: (ticketId: string) => void;
}) {
    if (tickets.length === 0) {
        return (
            <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                {loading ? '구매 기록을 불러오는 중입니다.' : '저장된 구매번호가 없습니다. 추천 번호를 생성한 뒤 "이 번호로 구매"를 눌러보세요.'}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {tickets.map(ticket => (
                <PurchaseTicketCard key={ticket.ticketId} ticket={ticket} onDelete={onDelete} />
            ))}
        </div>
    );
}
