export enum Gender {
  MALE = 'male',
  FEMALE = 'female'
}

export interface Neonate {
  id: string;
  name: string;
  gender: Gender;
  dob: string; // ISO date
  birthGestationalWeeks: number;
  birthGestationalDays: number;
  mrn?: string;
  createdAt: number;
  ownerId: string;
}

export interface Measurement {
  id: string;
  neonateId: string;
  date: string; // ISO date
  weight: number; // in grams
  length: number; // in cm
  headCircumference: number; // in cm
  gestationalAgeWeeks: number; // calculated at measurement time
  gestationalAgeDays: number;
  growthVelocity?: number; // g/kg/day (calculated)
  weightZScore?: number;
  weightPercentile?: number;
  lengthZScore?: number;
  lengthPercentile?: number;
  hcZScore?: number;
  hcPercentile?: number;
  createdAt: number;
}
