// Transparent, deterministic technical scoring. This is NOT aesthetic or semantic judgement.
export type Scored = { id: string; score: number };

export function technicalScore(width: number, height: number, brightness: number, contrast: number, edgeStrength: number): number {
  const resolution = Math.min(1, (width * height) / 2_400_000);
  const exposure = Math.max(0, 1 - Math.abs(brightness - 127) / 127);
  const tonalRange = Math.min(1, contrast / 65);
  const detail = Math.min(1, edgeStrength / 36);
  return Math.round(100 * (0.35 * resolution + 0.20 * exposure + 0.25 * tonalRange + 0.20 * detail));
}

export function pickInitialSelection<T extends Scored>(photos: T[], limit = 8): string[] {
  return [...photos].sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit)).map(photo => photo.id);
}
