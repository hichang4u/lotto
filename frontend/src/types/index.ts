export type DrawResult = {
    drwNo: number;
    drwNoDate: string;
    drwtNo1: number; drwtNo2: number; drwtNo3: number;
    drwtNo4: number; drwtNo5: number; drwtNo6: number;
    bnusNo: number;
    firstWinamnt: number;
};

export type PensionDrawResult = {
    draw_no: number;
    draw_date: string;
    winning_band: string;
    winning_number: string;
    bonus_number: string;
    synced_at: string;
    prize_counts?: {
        rank_no: number;
        internet_count: number;
        store_count: number;
        total_count: number;
        win_amount: number | null;
        total_amount: number | null;
    }[];
};

export type PensionRecommendationSet = {
    label: string;
    number: string;
    meta: {
        ruleId?: string;
        ruleWeight?: number;
        patternScore: number | null;
        sum: number;
        oddCount: number;
        uniqueDigitCount: number;
        maxDuplicateCount: number;
        hasThreeConsecutive: boolean;
    };
};

export type PensionRuleWeight = {
    ruleId: string;
    label: string;
    weight: number;
    score: number;
    passRate: number;
    recentMatchRate: number;
};

export type PensionRulePerformance = {
    ruleId: string;
    label: string;
    generatedCount: number;
    averageSuffixMatches: number;
    suffix1PlusRate: number;
    suffix2PlusRate: number;
};

export type PensionBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    setsPerDraw: number;
    totalGeneratedSets: number;
    averageSuffixMatchPerSet: number;
    averageBestSuffixMatchPerDraw: number;
    atLeastOnePrizeRate: number;
    prizeCounts: Record<number, number>;
    featured: {
        totalSets: number;
        averageSuffixMatchPerSet: number;
        atLeastOnePrizeRate: number;
        prizeCounts: Record<number, number>;
    };
    featuredBaseline: {
        totalSets: number;
        averageSuffixMatchPerSet: number;
        atLeastOnePrizeRate: number;
        prizeCounts: Record<number, number>;
    };
    baseline: {
        totalSets: number;
        averageSuffixMatchPerSet: number;
        atLeastOnePrizeRate: number;
        prizeCounts: Record<number, number>;
    };
    ruleDiagnostics: {
        currentWeights: PensionRuleWeight[];
        performance: PensionRulePerformance[];
    };
};

export type LottoSet = {
    numbers: number[];
    label: string;
    meta?: {
        ruleId?: string;
        ruleWeight?: number;
    };
};

export type PurchaseGameResult = {
    gameIndex: number;
    numbers: number[];
    ruleId: string | null;
    label: string | null;
    ruleWeight: number | null;
    matches: number | null;
    hasBonus: boolean | null;
    rank: number | null;
};

export type PurchaseTicket = {
    ticketId: string;
    drawNo: number;
    algorithm: string | null;
    createdAt: string;
    status: 'pending' | 'judged';
    draw: {
        drwNo: number;
        numbers: number[];
        bnusNo: number;
        drwNoDate: string;
    } | null;
    games: PurchaseGameResult[];
};

export type LottoRuleWeight = {
    ruleId: string;
    label: string;
    weight: number;
    score: number;
    passRate: number;
    recentMatchRate: number;
};

export type LottoRulePerformance = {
    ruleId: string;
    label: string;
    generatedCount: number;
    averageMatches: number;
    commonRulePassRate: number;
    relaxedFallbackRate: number;
    randomFallbackRate: number;
    actualRate: number;
};

export type LottoBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    averageMatchPerSet: number;
    averageBestMatchPerDraw: number;
    atLeastOnePrizeRate: number;
    prizeCounts: Record<number, number>;
    baseline: {
        totalSets: number;
        averageMatchPerSet: number;
        atLeastOnePrizeRate: number;
        prizeCounts: Record<number, number>;
    };
    generationQuality: {
        commonRulePassRate: number;
        relaxedFallbackRate: number;
        randomFallbackRate: number;
    };
    ruleDiagnostics: {
        currentWeights: LottoRuleWeight[];
        performance: LottoRulePerformance[];
    };
};

export type BallTheme = { base: string; mid: string; dark: string; text: string };

export type SyncResponse = {
    success: boolean;
    syncedCount: number;
    nextDrwNo: number;
    latestDraw: number;
};

export type PensionPurchaseGameResult = {
    gameIndex: number;
    number: string;
    ruleId: string | null;
    label: string | null;
    ruleWeight: number | null;
    suffixMatches: number | null;
    prizeCounts: Record<number, number> | null;
    bonusMatched: boolean | null;
    topRank: number | null;
};

export type PensionPurchaseTicket = {
    ticketId: string;
    drawNo: number;
    algorithm: string | null;
    createdAt: string;
    status: 'pending' | 'judged';
    draw: {
        drawNo: number;
        winningBand: string;
        winningNumber: string;
        bonusNumber: string;
        drawDate: string;
    } | null;
    games: PensionPurchaseGameResult[];
};

export type PageKey = 'lotto' | 'pension';
