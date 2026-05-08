import { MALE_PARAMS, FEMALE_PARAMS, LMS } from '../constants/fentonData';
import { Gender } from '../types';
import { calculateZScore, zScoreToPercentile } from './utils';

/**
 * Linear interpolation between two points
 */
function interpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
}

/**
 * Gets LMS parameters for a specific week and gender with interpolation
 */
export function getLMS(gender: Gender, type: 'weight' | 'length' | 'hc', gestationalAge: number): LMS {
  const params = gender === Gender.MALE ? MALE_PARAMS : FEMALE_PARAMS;
  const dataset = params[type];
  const weeks = Object.keys(dataset).map(Number).sort((a, b) => a - b);
  
  // Clamp to range
  const minWeek = weeks[0];
  const maxWeek = weeks[weeks.length - 1];
  const targetWeek = Math.max(minWeek, Math.min(maxWeek, gestationalAge));
  
  // Find surrounding weeks
  let lower = minWeek;
  let upper = maxWeek;
  
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i] <= targetWeek) lower = weeks[i];
    if (weeks[i] >= targetWeek) {
      upper = weeks[i];
      break;
    }
  }
  
  if (lower === upper) return dataset[lower];
  
  const l1 = dataset[lower];
  const l2 = dataset[upper];
  
  return {
    L: interpolate(targetWeek, lower, l1.L, upper, l2.L),
    M: interpolate(targetWeek, lower, l1.M, upper, l2.M),
    S: interpolate(targetWeek, lower, l1.S, upper, l2.S),
  };
}

/**
 * Calculates all growth metrics for a given measurement
 */
export function calculateGrowthMetrics(
  gender: Gender,
  targetGAInWeeks: number, // e.g. 32.4
  weightGrams?: number,
  lengthCm?: number,
  hcCm?: number
) {
  const metrics: any = {};
  
  if (weightGrams) {
    const lms = getLMS(gender, 'weight', targetGAInWeeks);
    const z = calculateZScore(weightGrams / 1000, lms.L, lms.M, lms.S);
    metrics.weightZScore = z;
    metrics.weightPercentile = zScoreToPercentile(z);
  }
  
  if (lengthCm) {
    const lms = getLMS(gender, 'length', targetGAInWeeks);
    const z = calculateZScore(lengthCm, lms.L, lms.M, lms.S);
    metrics.lengthZScore = z;
    metrics.lengthPercentile = zScoreToPercentile(z);
  }
  
  if (hcCm) {
    const lms = getLMS(gender, 'hc', targetGAInWeeks);
    const z = calculateZScore(hcCm, lms.L, lms.M, lms.S);
    metrics.hcZScore = z;
    metrics.hcPercentile = zScoreToPercentile(z);
  }
  
  return metrics;
}

/**
 * Generates percentile lines for chart plotting
 */
export function generatePercentileLines(gender: Gender, type: 'weight' | 'length' | 'hc', range: [number, number] = [22, 50]) {
  const result: any[] = [];
  const [min, max] = range;
  
  // Inverse LMS formula to get value for a given Z
  // Value = M * (1 + L * S * Z)^(1/L)
  const zScores: Record<string, number> = {
    p3: -1.8808,
    p10: -1.2816,
    p50: 0,
    p90: 1.2816,
    p97: 1.8808
  };
  
  // Higher resolution for smoother curves: steps of 0.5 weeks
  for (let ga = min; ga <= max; ga += 0.5) {
    const lms = getLMS(gender, type, ga);
    const datum: any = { gestationalAge: ga };
    
    Object.entries(zScores).forEach(([p, z]) => {
      let val;
      if (Math.abs(lms.L) < 0.01) { // L approx 0
        val = lms.M * Math.exp(z * lms.S);
      } else {
        const inner = 1 + lms.L * lms.S * z;
        if (inner > 0) {
          val = lms.M * Math.pow(inner, 1 / lms.L);
        } else {
          val = null;
        }
      }
      datum[p] = val;
    });
    result.push(datum);
  }
  
  return result;
}
