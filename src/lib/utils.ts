import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates current gestational age based on birth GA and current date vs DOB
 * @param birthWeeks weeks at birth
 * @param birthDays days at birth
 * @param dob date of birth
 * @param measurementDate date of measurement
 */
export function calculateCurrentGA(
  birthWeeks: number,
  birthDays: number,
  dob: string,
  measurementDate: string
): { weeks: number; days: number } {
  const birthDate = parseISO(dob);
  const measDate = parseISO(measurementDate);
  const daysSinceBirth = differenceInDays(measDate, birthDate);
  
  const totalBirthDays = birthWeeks * 7 + birthDays;
  const currentTotalDays = totalBirthDays + daysSinceBirth;
  
  return {
    weeks: Math.floor(currentTotalDays / 7),
    days: currentTotalDays % 7
  };
}

/**
 * Calculates growth velocity in g/kg/day using the exponential model
 * preferred in modern NICU practice.
 * 1000 * ln(W2/W1) / days
 */
export function calculateGrowthVelocity(
  weight1: number, // grams
  weight2: number, // grams
  days: number
): number | null {
  if (days <= 0 || weight1 <= 0 || weight2 <= 0) return null;
  return (1000 * Math.log(weight2 / weight1)) / days;
}

/**
 * LMS Centile Formula
 * Z = ((Value/M)^L - 1) / (L * S)
 */
export function calculateZScore(value: number, L: number, M: number, S: number): number {
  if (L === 0) {
    return Math.log(value / M) / S;
  }
  return (Math.pow(value / M, L) - 1) / (L * S);
}

/**
 * Converts Z-score to Percentile
 */
export function zScoreToPercentile(z: number): number {
  if (z < -3.5) return 0;
  if (z > 3.5) return 100;
  
  // High precision approximation of Error Function
  const t = 1 / (1 + 0.2315419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return (z > 0 ? 1 - p : p) * 100;
}
