import type { Job } from "../types";

export type ConsumptionResult = {
  distance: number;
  rangeUsed: number;
  difference: number;
  efficiency: number;
  rangeIncreased: boolean;
};

export const calculateConsumption = (job: Job): ConsumptionResult | null => {
  const distance = job.actualMiles ?? (job.odometerStart !== null && job.odometerEnd !== null ? job.odometerEnd - job.odometerStart : null);
  if (distance === null || distance < 0 || job.rangeStart == null || job.rangeEnd == null) return null;
  const rangeUsed = job.rangeStart - job.rangeEnd;
  if (rangeUsed <= 0) return { distance, rangeUsed, difference: rangeUsed - distance, efficiency: 0, rangeIncreased: true };
  return { distance, rangeUsed, difference: rangeUsed - distance, efficiency: distance / rangeUsed * 100, rangeIncreased: false };
};
