import { UserBehaviorProfile } from './BehaviorAnalytics';

export const calculateEngagementScore = (profile: UserBehaviorProfile): number => {
  // Simple heuristic for engagement
  const scanFrequencyWeight = 0.5;
  const sessionWeight = 0.3;
  const responseRateWeight = 0.2;

  const frequencyScore = Math.min(profile.scansPerWeek / 7, 1) * 100;
  const sessionScore = Math.min(profile.totalSessions / 10, 1) * 100;
  const responseScore = profile.notificationResponseRate * 100;

  return frequencyScore * scanFrequencyWeight + sessionScore * sessionWeight + responseScore * responseRateWeight;
};
