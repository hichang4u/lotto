// 공용 통계 유틸 — 연금·로또 알고리즘이 공유한다

// mulberry32 — 백테스트 재현성을 위한 시드 기반 RNG
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 베이지안 수축: 이론 확률(prior)을 priorStrength만큼의 가상 관측으로 간주해 소표본 노이즈를 억제
export function shrinkRate(observed: number, totalWeight: number, prior: number, priorStrength: number) {
  return (observed + priorStrength * prior) / (totalWeight + priorStrength)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
