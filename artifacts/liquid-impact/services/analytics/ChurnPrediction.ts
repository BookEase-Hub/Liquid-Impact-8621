import { UserBehaviorProfile } from './BehaviorAnalytics';

export const predictChurnRisk = (profile: UserBehaviorProfile): number => {
  // Simple heuristic for churn risk
  if (profile.totalSessions === 0) return 0.5;

  const daysSinceLastActive = (new Date().getTime() - new Date(profile.lastActive).getTime()) / (1000 * 60 * 60 * 24);
  const recencyRisk = Math.min(daysSinceLastActive / 14, 1);
  const engagementRisk = (100 - profile.engagementScore) / 100;

  return recencyRisk * 0.7 + engagementRisk * 0.3;
};
