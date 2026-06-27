import type { DrawResult } from '../../types';
import { formatMoneyKRW } from '../../utils/format';
import { Ball, BonusBadge } from '../ui/Ball';

export function DrawRow({ draw, highlight = false }: { draw: DrawResult; highlight?: boolean }) {
    const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];

    return (
        <div className={`rounded-3xl border px-4 py-4 transition-colors sm:px-5 ${highlight ? 'border-sky-200 bg-sky-50/80' : 'border-slate-200/80 bg-white/70'}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-900">제 {draw.drwNo}회</div>
                    <div className="mt-1 text-xs text-slate-500">추첨일 {draw.drwNoDate}</div>
                </div>
                <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                    1등 {formatMoneyKRW(draw.firstWinamnt)}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {nums.map((n, i) => <Ball key={i} num={n} size="sm" delay={i * 20} />)}
                <span className="mx-1 text-sm font-semibold text-slate-300">+</span>
                <div className="relative">
                    <Ball num={draw.bnusNo} size="sm" />
                    <BonusBadge compact />
                </div>
            </div>
        </div>
    );
}
