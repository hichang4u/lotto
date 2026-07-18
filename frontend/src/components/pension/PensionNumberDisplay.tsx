export function PensionDigitBall({ value, color, size = 'md' }: { value: string; color: string; size?: 'md' | 'sm' }) {
    // 2열 그리드 안의 추천 카드처럼 좁은 컨텍스트에서는 sm 사이즈로 한 줄 유지
    const sizeClass = size === 'sm'
        ? 'h-[clamp(28px,6.4vw,44px)] w-[clamp(28px,6.4vw,44px)] text-[clamp(13px,3vw,20px)]'
        : 'h-[clamp(30px,7.6vw,60px)] w-[clamp(30px,7.6vw,60px)] text-[clamp(14px,3.4vw,28px)]';

    return (
        /* 동행복권 공식 스타일: 흰 바탕 + 자리별 색상 링 + 진네이비 숫자 */
        <div
            className={`font-display flex shrink-0 items-center justify-center rounded-full font-black ${sizeClass}`}
            style={{
                border: `${size === 'sm' ? 3 : 4}px solid ${color}`,
                background: '#ffffff',
                color: '#1e293b',
            }}
        >
            {value}
        </div>
    );
}

// 공식 메인 카드의 자리별 링 색상 (조, 1~6자리 순)
const DIGIT_COLORS = ['#c6cdd6', '#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];

export function PensionNumberRow({
    label,
    subtitle,
    number,
    band,
    showBand = true,
    prefixLabel,
}: {
    label: string;
    subtitle: string;
    number: string;
    band?: string;
    showBand?: boolean;
    prefixLabel?: string;
}) {
    const digits = number.padStart(6, '0').slice(-6).split('');

    return (
        /* 경계 구분선을 굵은 블랙 실선으로 처리 */
        <div className="border-t-3 border-black py-6">
            <div className="text-center">
                <div className="text-lg font-black tracking-tighter text-black sm:text-2xl">
                    {label} <span className="mx-1.5 text-black">|</span> <span className="text-slate-700">{subtitle}</span>
                </div>
            </div>

            {/* 조 및 숫자 볼 영역 — 로또 볼처럼 한 줄(nowrap) 유지 */}
            <div className="mt-4 flex items-center justify-center gap-1.5 sm:gap-3">
                {showBand && band ? (
                    <div className="shrink-0 text-center">
                        <PensionDigitBall value={band} color={DIGIT_COLORS[0]} />
                        <div className="mt-1 text-xs font-black text-black sm:text-sm">조</div>
                    </div>
                ) : prefixLabel ? (
                    <div className="shrink-0 px-1 text-sm font-black text-black sm:text-lg">{prefixLabel}</div>
                ) : null}
                {digits.map((digit, index) => (
                    <PensionDigitBall
                        key={`${label}-${index}`}
                        value={digit}
                        color={DIGIT_COLORS[Math.min(index + (showBand ? 1 : 0), DIGIT_COLORS.length - 1)]}
                    />
                ))}
            </div>
        </div>
    );
}
