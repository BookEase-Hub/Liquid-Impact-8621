import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanResult } from '@/types';
import { calculateEngagementScore } from './EngagementCalculator';
import { predictChurnRisk } from './ChurnPrediction';
import { UserSegment, UserBehaviorMetrics } from '../notifications/SmartNotificationScheduler';

export interface BehaviorEvent {
  userId: string;
  eventType: BehaviorEventType;
  timestamp: Date;
  metadata: Record<string, any>;
  sessionId: string;
}

export type BehaviorEventType =
  | 'app_open'
  | 'app_close'
  | 'scan_completed'
  | 'notification_received'
  | 'notification_clicked'
  | 'notification_dismissed'
  | 'mission_started'
  | 'mission_completed'
  | 'mission_failed'
  | 'settings_changed'
  | 'subscription_upgraded'
  | 'subscription_cancelled'
  | 'feature_used'
  | 'screen_view'
  | 'error_encountered';

export interface UserBehaviorProfile {
  userId: string;
  createdAt: Date;
  lastActive: Date;
  totalSessions: number;
  averageSessionDuration: number; // minutes
  scansPerWeek: number;
  notificationResponseRate: number; // 0-1
  preferredScanTimes: string[]; // ["08:00", "13:00", "18:00"]
  preferredDays: string[]; // ["Monday", "Wednesday", "Friday"]
  featureUsage: Map<string, number>;
  engagementScore: number; // 0-100
  churnRiskScore: number; // 0-1
  behavioralSegment: UserSegment;
  habitStrength: number; // 0-100
  goalProgress: Map<string, number>;
  streakDays: number;
}

export class BehaviorAnalytics {
  private static instance: BehaviorAnalytics;
  private eventBuffer: BehaviorEvent[] = [];
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();

  private constructor() {}

  static getInstance(): BehaviorAnalytics {
    if (!BehaviorAnalytics.instance) {
      BehaviorAnalytics.instance = new BehaviorAnalytics();
    }
    return BehaviorAnalytics.instance;
  }

  /**
   * GAP: No comprehensive event tracking
   * SOLUTION: Track all user interactions
   */
  async trackEvent(event: BehaviorEvent): Promise<void> {
    // GAP: Events not being persisted for analysis
    this.eventBuffer.push(event);

    // Batch send to analytics server every 10 events
    if (this.eventBuffer.length >= 10) {
      await this.flushEvents();
    }

    // Update user profile in real-time
    await this.updateUserProfile(event);
  }

  /**
   * GAP: No real-time behavior pattern detection
   * SOLUTION: Continuous profile updates
   */
  private async updateUserProfile(event: BehaviorEvent): Promise<void> {
    let profile = this.userProfiles.get(event.userId);

    if (!profile) {
      profile = await this.loadOrCreateProfile(event.userId);
    }

    // Update based on event type
    switch (event.eventType) {
      case 'app_open':
        profile.totalSessions += 1;
        profile.lastActive = event.timestamp;
        break;

      case 'scan_completed':
        profile.scansPerWeek = this.calculateScansPerWeek(profile);
        this.updatePreferredTimes(profile, event.timestamp);
        break;

      case 'notification_clicked':
        profile.notificationResponseRate = this.calculateNotificationResponseRate(profile);
        break;

      case 'feature_used':
        const feature = event.metadata.featureName;
        profile.featureUsage.set(feature, (profile.featureUsage.get(feature) || 0) + 1);
        break;
    }

    // Recalculate scores
    profile.engagementScore = calculateEngagementScore(profile);
    profile.churnRiskScore = predictChurnRisk(profile);
    profile.behavioralSegment = this.determineSegment(profile);
    profile.habitStrength = this.calculateHabitStrength(profile);

    // Persist updated profile
    this.userProfiles.set(event.userId, profile);
    await this.persistProfile(profile);
  }

  /**
   * GAP: No prediction of optimal notification times
   * SOLUTION: Analyze historical patterns
   */
  async getUserBehaviorPatterns(userId: string): Promise<UserBehaviorMetrics> {
    const profile = await this.getProfile(userId);

    // GAP: No machine learning for pattern recognition
    const scanTimes = await this.getHistoricalScanTimes(userId, 30); // Last 30 days

    // Calculate most common scan hour
    const hourDistribution = this.calculateHourDistribution(scanTimes);
    const peakHour = this.findPeakHour(hourDistribution);

    // Calculate day distribution
    const dayDistribution = this.calculateDayDistribution(scanTimes);
    const peakDay = this.findPeakDay(dayDistribution);

    return {
      averageScanTime: `${peakHour.toString().padStart(2, '0')}:00`,
      mostActiveDay: peakDay,
      engagementScore: profile.engagementScore,
      preferredNotificationTime: this.calculatePreferredNotificationTime(profile),
      notificationResponseRate: profile.notificationResponseRate,
      churnRiskScore: profile.churnRiskScore,
    };
  }

  /**
   * GAP: No adaptive goal adjustment
   * SOLUTION: Adjust goals based on user capability
   */
  async suggestAdaptiveGoals(userId: string): Promise<AdaptiveGoal[]> {
    const profile = await this.getProfile(userId);
    const goals: AdaptiveGoal[] = [];

    // Current scan frequency
    const currentScansPerWeek = profile.scansPerWeek;

    // GAP: Goals not personalized to user's actual behavior
    if (currentScansPerWeek < 3) {
      goals.push({
        type: 'frequency',
        current: currentScansPerWeek,
        suggested: 3,
        rationale: 'Build a consistent habit with 3 scans per week',
        difficulty: 'easy',
      });
    } else if (currentScansPerWeek < 7) {
      goals.push({
        type: 'frequency',
        current: currentScansPerWeek,
        suggested: 7,
        rationale: 'Daily scanning for optimal health awareness',
        difficulty: 'medium',
      });
    }

    // Analyze feature usage
    const topFeatures = Array.from(profile.featureUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Suggest underutilized features
    const allFeatures = ['missions', 'weekly-summary', 'alternatives', 'nutrition-details'];
    const unusedFeatures = allFeatures.filter(f => !profile.featureUsage.has(f));

    if (unusedFeatures.length > 0) {
      goals.push({
        type: 'feature-adoption',
        feature: unusedFeatures[0],
        rationale: `Try ${unusedFeatures[0]} to enhance your experience`,
        difficulty: 'easy',
      });
    }

    return goals;
  }

  /**
   * GAP: No detection of behavior changes
   * SOLUTION: Monitor for significant deviations
   */
  async detectBehaviorChange(userId: string): Promise<BehaviorChange | null> {
    const profile = await this.getProfile(userId);
    const lastWeekScans = await this.getScansInPeriod(userId, 7, 'days');
    const previousWeekScans = await this.getScansInPeriod(userId, 14, 'days');

    const change: BehaviorChange = {
      userId,
      detectedAt: new Date(),
      type: null,
      severity: 'low',
      metrics: {},
    };

    // Detect engagement drop
    if (lastWeekScans.length < previousWeekScans.length * 0.5) {
      change.type = 'engagement_drop';
      change.severity = 'high';
      change.metrics = {
        previousCount: previousWeekScans.length,
        currentCount: lastWeekScans.length,
        dropPercentage: previousWeekScans.length > 0 ? ((previousWeekScans.length - lastWeekScans.length) / previousWeekScans.length) * 100 : 0,
      };
      return change;
    }

    // Detect time pattern change
    const recentTimes = lastWeekScans.map(s => new Date(s.scannedAt).getHours());
    const avgRecentTime = recentTimes.length > 0 ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length : 0;

    const historicalAvgTime = this.calculateAverageScanHour(profile);
    const timeShift = Math.abs(avgRecentTime - historicalAvgTime);

    if (timeShift > 3 && recentTimes.length > 0) { // More than 3 hours shift
      change.type = 'schedule_change';
      change.severity = 'medium';
      change.metrics = {
        previousAvgHour: historicalAvgTime,
        currentAvgHour: avgRecentTime,
        shiftHours: timeShift,
      };
      return change;
    }

    return null;
  }

  // Helper methods
  private async loadOrCreateProfile(userId: string): Promise<UserBehaviorProfile> {
    const stored = await AsyncStorage.getItem(`behavior_profile_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Map is not natively supported in JSON.parse/stringify
      parsed.featureUsage = new Map(Object.entries(parsed.featureUsage || {}));
      parsed.goalProgress = new Map(Object.entries(parsed.goalProgress || {}));
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.lastActive = new Date(parsed.lastActive);
      return parsed;
    }

    const newProfile: UserBehaviorProfile = {
      userId,
      createdAt: new Date(),
      lastActive: new Date(),
      totalSessions: 0,
      averageSessionDuration: 0,
      scansPerWeek: 0,
      notificationResponseRate: 0,
      preferredScanTimes: [],
      preferredDays: [],
      featureUsage: new Map(),
      engagementScore: 0,
      churnRiskScore: 0,
      behavioralSegment: 'new',
      habitStrength: 0,
      goalProgress: new Map(),
      streakDays: 0
    };

    return newProfile;
  }

  private async persistProfile(profile: UserBehaviorProfile): Promise<void> {
    const toStore = {
      ...profile,
      featureUsage: Object.fromEntries(profile.featureUsage),
      goalProgress: Object.fromEntries(profile.goalProgress),
    };
    await AsyncStorage.setItem(
      `behavior_profile_${profile.userId}`,
      JSON.stringify(toStore)
    );
  }

  async getProfile(userId: string): Promise<UserBehaviorProfile> {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = await this.loadOrCreateProfile(userId);
      this.userProfiles.set(userId, profile);
    }
    return profile;
  }

  private calculateHourDistribution(scanTimes: Date[]): Map<number, number> {
    const distribution = new Map<number, number>();
    scanTimes.forEach(time => {
      const hour = time.getHours();
      distribution.set(hour, (distribution.get(hour) || 0) + 1);
    });
    return distribution;
  }

  private findPeakHour(distribution: Map<number, number>): number {
    let peakHour = 9; // Default
    let maxCount = 0;

    distribution.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    });

    return peakHour;
  }

  private calculateDayDistribution(scanTimes: Date[]): Map<string, number> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const distribution = new Map<string, number>();

    scanTimes.forEach(time => {
      const day = days[time.getDay()];
      distribution.set(day, (distribution.get(day) || 0) + 1);
    });

    return distribution;
  }

  private findPeakDay(distribution: Map<string, number>): string {
    let peakDay = 'Monday';
    let maxCount = 0;

    distribution.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count;
        peakDay = day;
      }
    });

    return peakDay;
  }

  private calculatePreferredNotificationTime(profile: UserBehaviorProfile): string {
    // Find the hour with highest engagement
    const peakHour = profile.preferredScanTimes.length > 0
      ? parseInt(profile.preferredScanTimes[0].split(':')[0])
      : 9;

    // Suggest notification 30 minutes before typical scan time
    const notificationHour = peakHour > 0 ? peakHour - 1 : 9;
    return `${notificationHour.toString().padStart(2, '0')}:30`;
  }

  private determineSegment(profile: UserBehaviorProfile): UserSegment {
    if (profile.totalSessions === 0) return 'new';
    if (profile.churnRiskScore > 0.7) return 'churned';
    if (profile.churnRiskScore > 0.4) return 'at-risk';
    if (profile.scansPerWeek >= 7 && profile.engagementScore > 80) return 'power-user';
    return 'regular';
  }

  private calculateHabitStrength(profile: UserBehaviorProfile): number {
    // Based on consistency over time
    const daysSinceFirstScan = Math.floor(
      (new Date().getTime() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceFirstScan === 0) return 0;

    const consistencyScore = (profile.scansPerWeek / 7) * 100;
    const longevityScore = Math.min(daysSinceFirstScan / 30, 1) * 100; // Max at 30 days

    return (consistencyScore * 0.6 + longevityScore * 0.4);
  }

  private updatePreferredTimes(profile: UserBehaviorProfile, timestamp: Date): void {
    const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

    if (!profile.preferredScanTimes.includes(timeStr)) {
      profile.preferredScanTimes.push(timeStr);
      // Keep only top 3 most common times
      if (profile.preferredScanTimes.length > 3) {
        profile.preferredScanTimes = profile.preferredScanTimes.slice(0, 3);
      }
    }
  }

  private calculateNotificationResponseRate(profile: UserBehaviorProfile): number {
    // Implementation based on notification click tracking
    return profile.notificationResponseRate;
  }

  private calculateScansPerWeek(profile: UserBehaviorProfile): number {
    // Implementation based on scan history
    return profile.scansPerWeek;
  }

  private async flushEvents(): Promise<void> {
    // Send to analytics server
    this.eventBuffer = [];
  }

  private async getHistoricalScanTimes(userId: string, days: number): Promise<Date[]> {
    // Fetch from database
    return [];
  }

  private calculateAverageScanHour(profile: UserBehaviorProfile): number {
    if (profile.preferredScanTimes.length === 0) return 9;
    const hours = profile.preferredScanTimes.map(t => parseInt(t.split(':')[0]));
    return hours.reduce((a, b) => a + b, 0) / hours.length;
  }

  private async getScansInPeriod(userId: string, amount: number, unit: 'days' | 'weeks'): Promise<ScanResult[]> {
    // Fetch from database
    return [];
  }
}

// Added exports to satisfy SmartNotificationScheduler
export const getUserBehaviorPatterns = async (userId: string): Promise<UserBehaviorMetrics> => {
  return BehaviorAnalytics.getInstance().getUserBehaviorPatterns(userId);
};

export const calculateOptimalSendTime = async (userId: string, type: string, context: any): Promise<Date> => {
  // Stub for external use if needed
  return new Date();
};

export const getUserTimezone = async (userId: string): Promise<string> => {
  return 'UTC';
};

export interface AdaptiveGoal {
  type: 'frequency' | 'feature-adoption' | 'streak' | 'diversity';
  current?: number;
  suggested?: number;
  feature?: string;
  rationale: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface BehaviorChange {
  userId: string;
  detectedAt: Date;
  type: 'engagement_drop' | 'schedule_change' | 'feature_adoption' | null;
  severity: 'low' | 'medium' | 'high';
  metrics: Record<string, any>;
}
