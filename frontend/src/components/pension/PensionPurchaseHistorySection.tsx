import { Trash2 } from 'lucide-react';
import type { PensionPurchaseGameResult, PensionPurchaseTicket } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { PensionDigitBall } from './PensionNumberDisplay';

const GAME_LETTERS = ['A', 'B', 'C', 'D'];
const DIGIT_COLORS = ['#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];
const PENSION_RANKS = [1, 2, 3, 4, 5, 6, 7];

// 각조 구매이므로 등수별 매수로 표기: "1등 1매 · 2등 4매", "5등 5매"
function formatPensionPrize(prizeCounts: Record<number, number>) {
    return PENSION_RANKS
        .filter(rank => (prizeCounts[rank] ?? 0) > 0)
        .map(rank => `${rank}등 ${prizeCounts[rank]}매`)
        .join(' · ');
}

function PensionGameRankBadge({ game }: { game: PensionPurchaseGameResult }) {
    if (game.prizeCounts === null) {
        return <span className="neo-badge neo-badge-compact py-0.5 text-[10px]">추첨 전</span>;
    }

    const prizeText = formatPensionPrize(game.prizeCounts);
    const isLoss = prizeText === '' && !game.bonusMatched;

    return (
        <div className="flex flex-wrap items-center justify-end gap-1">
            {prizeText !== '' && (
                <span className="neo-badge neo-badge-compact neo-badge-yellow py-0.5 text-[10px]">{prizeText}</span>
            )}
            {game.bonusMatched && (
                <span className="neo-badge neo-badge-compact neo-badge-purple py-0.5 text-[10px]">
                    보너스 {PENSION_BANDS_PER_TICKET}매
                </span>
            )}
            {isLoss && (
                <span className="neo-badge neo-badge-compact py-0.5 text-[10px] text-slate-500">낙첨</span>
            )}
        </div>
    );
}

function PensionPurchaseGameRow({ game }: { game: PensionPurchaseGameResult }) {
    const judged = game.suffixMatches !== null;
    const ruleName = game.ruleId ? (PENSION_RULE_LABELS[game.ruleId] ?? game.ruleId) : game.label;
    const digits = game.number.padStart(6, '0').slice(-6).split('');
    // 뒤에서부터 연속 일치한 자리만 원래 색. 보너스 전장 일치면 6자리 모두 일치로 본다.
    const matchedFrom = game.bonusMatched ? 0 : 6 - (game.suffixMatches ?? 0);

    return (
        <div className="flex items-center gap-1.5 border-b border-slate-200 py-2 last:border-b-0 sm:gap-2.5">
            <span className="w-4 shrink-0 text-center text-xs font-black text-black sm:w-5 sm:text-sm">
                {GAME_LETTERS[game.gameIndex] ?? game.gameIndex + 1}
            </span>
            <span className="hidden shrink-0 text-[10px] font-black text-slate-500 sm:block">각조</span>
            <div className="flex flex-1 items-center gap-1 sm:gap-1.5">
                {digits.map((digit, index) => {
                    const matched = judged && index >= matchedFrom;
                    return (
                        <span
                            key={index}
                            className="inline-flex"
                            style={judged && !matched ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}
                        >
                            <PensionDigitBall value={digit} color={DIGIT_COLORS[index]} size="sm" />
                        </span>
                    );
                })}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <PensionGameRankBadge game={game} />
                {ruleName && <span className="hidden text-[10px] font-bold text-slate-500 sm:block">{ruleName}</span>}
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
                    <PensionPurchaseGameRow key={game.gameIndex} game={game} />
                ))}
            </div>

            {ticket.status === 'judged' && ticket.draw && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-600">
                    <span>당첨</span>
                    <span className="font-black text-black">
                        {ticket.draw.winningBand}조 {ticket.draw.winningNumber}
                    </span>
                    <span>· 보너스 {ticket.draw.bonusNumber}</span>
                </div>
            )}
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
                {loading ? '구매 기록을 불러오는 중입니다.' : '저장된 구매번호가 없습니다. 추천번호를 생성한 뒤 "이 번호로 구매"를 눌러보세요.'}
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
