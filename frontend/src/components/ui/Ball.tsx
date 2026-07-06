import { getBallTheme } from '../../utils/format';

export function Ball({ num, size = 'md', delay = 0 }: { num: number; size?: 'sm' | 'md' | 'responsive'; delay?: number }) {
    const t = getBallTheme(num);
    const dimensions = size === 'sm'
        ? { width: 38, height: 38, fontSize: 13, shadow: '3px 3px 0px 0px #000' }
        : size === 'responsive'
            ? { width: 'clamp(38px, 8.4vw, 54px)', height: 'clamp(38px, 8.4vw, 54px)', fontSize: 'clamp(13px, 3.7vw, 17px)', shadow: '4px 4px 0px 0px #000' }
            : { width: 54, height: 54, fontSize: 17, shadow: '4px 4px 0px 0px #000' };

    return (
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
                fontWeight: 900,
                fontSize: dimensions.fontSize,
                color: '#000000',
                flexShrink: 0,
                border: '3px solid #000000',
                background: t.base,
                boxShadow: dimensions.shadow,
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
