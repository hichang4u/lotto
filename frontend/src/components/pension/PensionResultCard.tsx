import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PensionDrawResult } from '../../types';
import { formatDateTime } from '../../utils/format';
import { PensionNumberRow } from './PensionNumberDisplay';

export function PensionResultCard({ draw }: { draw: PensionDrawResult }) {
    return (
        <div className="rounded-[30px] border border-slate-200/60 bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            <div className="latest-feature-heading">
                <div className="result-arrow-shell result-arrow-left">
                    <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                    <h2 className="text-[30px] font-bold text-slate-800 sm:text-[48px] lg:text-[56px]">
                    제 <span className="text-slate-900">{draw.draw_no}</span>회 추첨 결과
                    </h2>
                    <p className="mt-3 text-base font-medium text-slate-500 sm:text-[18px]">{draw.draw_date} 추첨</p>
                </div>
                <div className="result-arrow-shell result-arrow-right text-slate-300">
                    <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </div>
            </div>

            <div className="result-divider mt-8 sm:mt-10" />

            <div className="mt-8">
                <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
            </div>

            <div className="mt-8 text-center text-xs text-slate-500 sm:text-sm">
                최근 동기화 {formatDateTime(new Date(draw.synced_at))}
            </div>
        </div>
    );
}
