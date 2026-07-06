export function PensionDigitBall({ value, color }: { value: string; color: string }) {
    return (
        <div
            className="flex h-[clamp(50px,8.6vw,76px)] w-[clamp(50px,8.6vw,76px)] items-center justify-center rounded-full text-[clamp(24px,4vw,38px)] font-black"
            style={{
                border: '3px solid #000000',
                background: '#ffffff',
                color: '#000000',
                boxShadow: '4px 4px 0px 0px #000000',
                // 안쪽으로 자릿수 구분을 위한 네오 아웃라인 포인트 처리
                outline: `4px solid ${color}`,
                outlineOffset: '-4px',
            }}
        >
            {value}
        </div>
    );
}

const DIGIT_COLORS = ['#cbd5e1', '#f97316', '#f59e0b', '#eab308', '#3b82f6', '#8b5cf6', '#94a3b8'];

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
        <div className="grid gap-5 border-t-3 border-black py-6 lg:grid-cols-[1.05fr_1.55fr] lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
                <div className="text-[24px] font-black tracking-tighter text-black sm:text-[32px] lg:text-[36px]">
                    {label} <span className="mx-1.5 text-black">|</span> <span className="text-slate-700">{subtitle}</span>
                </div>
            </div>

            {/* 조 및 숫자 볼 영역 */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                {showBand && band ? (
                    <div className="text-center">
                        <PensionDigitBall value={band} color={DIGIT_COLORS[0]} />
                        <div className="mt-2 text-sm font-black text-black">조</div>
                    </div>
                ) : prefixLabel ? (
                    <div className="px-1 text-base font-black text-black sm:text-lg">{prefixLabel}</div>
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
