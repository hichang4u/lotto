import { getBallTheme } from '../../utils/format';

export function Ball({ num, size = 'md', delay = 0 }: { num: number; size?: 'sm' | 'md' | 'responsive'; delay?: number }) {
    const t = getBallTheme(num);
    const dimensions = size === 'sm'
        ? { width: 38, height: 38, fontSize: 14 }
        : size === 'responsive'
            ? { width: 'clamp(38px, 8.4vw, 54px)', height: 'clamp(38px, 8.4vw, 54px)', fontSize: 'clamp(14px, 3.7vw, 19px)' }
            : { width: 54, height: 54, fontSize: 19 };

    return (
        /* 동행복권 공식 스타일: 단색 채움 + 흰 숫자, 테두리·하드 섀도우 없음 */
        <div
            className="ball-pop"
            style={{
                animationDelay: `${delay}ms`,
                width: dimensions.width,
                height: dimensions.height,
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: dimensions.fontSize,
                color: t.text,
                flexShrink: 0,
                background: t.base,
            }}
        >
            {num}
        </div>
    );
}

export function BonusBadge({ compact = false }: { compact?: boolean }) {
    return (
        <span
            className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-[#ffd400] text-black font-extrabold"
            style={{
                width: compact ? 18 : 20,
                height: compact ? 18 : 20,
                fontSize: compact ? 9 : 10,
                letterSpacing: '-0.02em',
                border: '2px solid #000000',
                boxShadow: '1.5px 1.5px 0px 0px #000000',
            }}
        >
            B
        </span>
    );
}
