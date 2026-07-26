import { useState } from 'react';
import type { PensionPurchaseTicket, PensionRecommendationSet } from '../types';
import { API_URL, PENSION_BANDS_PER_TICKET } from '../constants';
import { getDeviceId } from '../utils/device';

const PENSION_RANKS = [1, 2, 3, 4, 5, 6, 7];

// 판정 완료 티켓의 결과 요약 문구 (동기화 알림에 사용). 각조 구매이므로 매수 단위로 집계한다.
export function summarizePensionTicketResult(ticket: PensionPurchaseTicket): string {
    const rankCounts = new Map<number, number>();
    let bonusCount = 0;
    let lossCount = 0;

    for (const game of ticket.games) {
        if (game.prizeCounts === null) continue;
        const ranks = Object.keys(game.prizeCounts).map(Number);
        for (const rank of ranks) {
            rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + game.prizeCounts[rank]);
        }
        if (game.bonusMatched) bonusCount += PENSION_BANDS_PER_TICKET;
        if (ranks.length === 0 && !game.bonusMatched) lossCount += 1;
    }

    const parts = PENSION_RANKS
        .filter(rank => (rankCounts.get(rank) ?? 0) > 0)
        .map(rank => `${rank}등 ${rankCounts.get(rank)}매`);
    if (bonusCount > 0) parts.push(`보너스 ${bonusCount}매`);

    if (parts.length === 0) {
        return `제 ${ticket.drawNo}회 구매번호: 아쉽지만 모두 낙첨입니다.`;
    }
    if (lossCount > 0) parts.push(`낙첨 ${lossCount}게임`);
    return `제 ${ticket.drawNo}회 구매번호 결과: ${parts.join(', ')}`;
}

export function usePensionPurchases() {
    const [tickets, setTickets] = useState<PensionPurchaseTicket[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadPurchases = async (): Promise<PensionPurchaseTicket[]> => {
        setPurchasesLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/purchases`);
            if (!res.ok) return tickets;
            const data = (await res.json()) as { tickets?: PensionPurchaseTicket[] };
            const next = Array.isArray(data.tickets) ? data.tickets : [];
            setTickets(next);
            return next;
        } catch {
            return tickets;
        } finally {
            setPurchasesLoading(false);
        }
    };

    const savePurchase = async (algorithm: string | null, sets: PensionRecommendationSet[]) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/purchases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: getDeviceId(),
                    algorithm,
                    games: sets.map(set => ({
                        number: set.number,
                        ruleId: set.meta?.ruleId ?? null,
                        label: set.label,
                        ruleWeight: set.meta?.ruleWeight ?? null,
                    })),
                }),
            });
            if (!res.ok) return null;
            const data = (await res.json()) as { ticketId: string; drawNo: number };
            await loadPurchases();
            return data;
        } catch {
            return null;
        } finally {
            setSaving(false);
        }
    };

    const deleteTicket = async (ticketId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/pension/purchases/${ticketId}`, { method: 'DELETE' });
            if (!res.ok) return false;
            await loadPurchases();
            return true;
        } catch {
            return false;
        }
    };

    // 동기화 직후 호출: 이번 재조회로 pending → judged 로 바뀐 티켓들을 돌려준다
    const refreshAfterSync = async (): Promise<PensionPurchaseTicket[]> => {
        const prevPending = new Set(
            tickets.filter(ticket => ticket.status === 'pending').map(ticket => ticket.ticketId),
        );
        const next = await loadPurchases();
        return next.filter(ticket => prevPending.has(ticket.ticketId) && ticket.status === 'judged');
    };

    return {
        tickets,
        purchasesLoading,
        saving,
        loadPurchases,
        savePurchase,
        deleteTicket,
        refreshAfterSync,
    };
}
