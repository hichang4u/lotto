import type { DrawResult } from '../../types';
import { formatMoneyKRW } from '../../utils/format';
import { Ball, BonusBadge } from '../ui/Ball';

export function DrawRow({ draw, highlight = false }: { draw: DrawResult; highlight?: boolean }) {
    const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];

    // 하이라이트 여부에 따른 배경색 및 테마 설정
    const rowClass = `border-3 border-black px-4 py-4 rounded-xl shadow-[3px_3px_0px_0px_#000000] transition-colors sm:px-5 ${
        highlight ? 'bg-[#fffdf5]' : 'bg-white'
    }`;

    return (
        <div className={rowClass}>
            {/* 상단 정보 폼 */}
            <div className="mb-3.5 flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-black text-black">제 {draw.drwNo}회</div>
                    <div className="mt-1 text-xs font-bold text-slate-700">추첨일 {draw.drwNoDate}</div>
                </div>
                <span className="neo-badge neo-badge-green text-xs">
                    1등 {formatMoneyKRW(draw.firstWinamnt)}
                </span>
            </div>
            
            {/* 번호 볼 리스트 */}
            <div className="flex flex-wrap items-center gap-2">
                {nums.map((n, i) => (
                    <Ball key={i} num={n} size="sm" delay={i * 20} />
                ))}
                <span className="mx-1 text-sm font-black text-black">+</span>
                <div className="relative">
                    <Ball num={draw.bnusNo} size="sm" />
                    <BonusBadge compact />
                </div>
            </div>
        </div>
    );
}
