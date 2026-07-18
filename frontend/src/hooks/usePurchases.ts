import { useState } from 'react';
import type { LottoSet, PurchaseTicket } from '../types';
import { API_URL } from '../constants';
import { getDeviceId } from '../utils/device';

// 판정 완료 티켓의 결과 요약 문구 (동기화 알림·기록 표시에 사용)
export function summarizeTicketResult(ticket: PurchaseTicket): string {
    const judged = ticket.games.filter(game => game.rank !== null);
    const rankCounts = new Map<number, number>();
    let lossCount = 0;
    for (const game of judged) {
        if (game.rank && game.rank >= 1) {
            rankCounts.set(game.rank, (rankCounts.get(game.rank) ?? 0) + 1);
        } else {
            lossCount += 1;
        }
    }

    if (rankCounts.size === 0) {
        return `제 ${ticket.drawNo}회 구매번호: 아쉽지만 모두 낙첨입니다.`;
    }

    const parts = [1, 2, 3, 4, 5]
        .filter(rank => (rankCounts.get(rank) ?? 0) > 0)
        .map(rank => `${rank}등 ${rankCounts.get(rank)}게임`);
    if (lossCount > 0) parts.push(`낙첨 ${lossCount}게임`);
    return `제 ${ticket.drawNo}회 구매번호 결과: ${parts.join(', ')}`;
}

export function usePurchases() {
    const [tickets, setTickets] = useState<PurchaseTicket[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadPurchases = async (): Promise<PurchaseTicket[]> => {
        setPurchasesLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/purchases?deviceId=${encodeURIComponent(getDeviceId())}`);
            if (!res.ok) return tickets;
            const data = (await res.json()) as { tickets?: PurchaseTicket[] };
            const next = Array.isArray(data.tickets) ? data.tickets : [];
            setTickets(next);
            return next;
        } catch {
            return tickets;
        } finally {
            setPurchasesLoading(false);
        }
    };

    const savePurchase = async (algorithm: string | null, sets: LottoSet[]) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/purchases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: getDeviceId(),
                    algorithm,
                    games: sets.map(set => ({
                        numbers: set.numbers,
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
            const res = await fetch(
                `${API_URL}/api/purchases/${ticketId}?deviceId=${encodeURIComponent(getDeviceId())}`,
                { method: 'DELETE' },
            );
            if (!res.ok) return false;
            await loadPurchases();
            return true;
        } catch {
            return false;
        }
    };

    // 동기화 직후 호출: 이번 재조회로 pending → judged 로 바뀐 티켓들을 돌려준다
    const refreshAfterSync = async (): Promise<PurchaseTicket[]> => {
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
