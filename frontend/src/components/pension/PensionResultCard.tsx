import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PensionDrawResult } from '../../types';
import { formatDateTime } from '../../utils/format';
import { PensionNumberRow } from './PensionNumberDisplay';

export function PensionResultCard({ draw }: { draw: PensionDrawResult }) {
    return (
        <div className="neo-card neo-card--soft px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            {/* 회차 결과 헤더 및 네비게이션 */}
            <div className="latest-feature-heading">
                <button 
                    className="result-arrow-shell result-arrow-left"
                    title="이전 회차"
                    disabled
                >
                    <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
                </button>
                
                <div className="text-center">
                    <h2 className="text-[30px] font-black tracking-tighter text-black sm:text-[46px] lg:text-[52px]">
                        제 <span className="text-[#8b5cf6]">{draw.draw_no}</span>회 추첨 결과
                    </h2>
                    <p className="mt-2 text-sm font-bold text-slate-700 sm:text-[18px]">{draw.draw_date} 추첨</p>
                </div>

                <button 
                    className="result-arrow-shell result-arrow-right"
                    disabled
                    title="최신 회차입니다"
                >
                    <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
                </button>
            </div>

            <div className="result-divider mt-8 sm:mt-10" />

            {/* 당첨 번호 디스플레이 리스트 */}
            <div className="mt-8">
                <PensionNumberRow label="1등" subtitle="월 700만원 x 20년" band={draw.winning_band} number={draw.winning_number} />
                <PensionNumberRow label="보너스" subtitle="월 100만원 x 10년" number={draw.bonus_number} showBand={false} prefixLabel="각조" />
            </div>

            {/* 최하단 동기화 완료 상태 */}
            <div className="mt-8 text-center text-xs font-bold text-slate-700 sm:text-sm">
                최근 동기화 {formatDateTime(new Date(draw.synced_at))}
            </div>
        </div>
    );
}
