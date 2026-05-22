import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {
  getUserBehaviorPatterns,
  getUserTimezone
} from '../analytics/BehaviorAnalytics';
import { NotificationTemplate } from './NotificationTemplates';
import { UserPreference } from '@/types/user';

export interface NotificationContext {
  userId: string;
  currentTime: Date;
  userTimezone: string;
  lastScanDate: Date | null;
  streakDays: number;
  currentGoal: string;
  recentBehavior: UserBehaviorMetrics;
  locationContext?: LocationContext;
  deviceState: DeviceState;
}

export interface UserBehaviorMetrics {
  averageScanTime: string; // "08:30"
  mostActiveDay: string; // "Monday"
  engagementScore: number; // 0-100
  preferredNotificationTime: string;
  notificationResponseRate: number; // 0-1
  churnRiskScore: number; // 0-1
}

export interface DeviceState {
  isCharging: boolean;
  batteryLevel: number;
  connectivity: 'wifi' | 'cellular' | 'offline';
  appInForeground: boolean;
}

export class SmartNotificationScheduler {
  private static instance: SmartNotificationScheduler;
  private notificationQueue: ScheduledNotification[] = [];
  private userPreferences: Map<string, UserPreference> = new Map();

  private constructor() {}

  static getInstance(): SmartNotificationScheduler {
    if (!SmartNotificationScheduler.instance) {
      SmartNotificationScheduler.instance = new SmartNotificationScheduler();
    }
    return SmartNotificationScheduler.instance;
  }

  /**
   * GAPS ADDRESSED:
   * 1. ❌ No dynamic timing based on user behavior
   * 2. ❌ No context-aware notifications
   * 3. ❌ No adaptive frequency control
   */
  async schedulePersonalizedNotification(
    userId: string,
    notificationType: NotificationType,
    context: NotificationContext
  ): Promise<ScheduledNotification> {
    // GAP: Current implementation sends at fixed times
    // SOLUTION: Calculate optimal time based on behavior patterns

    const optimalTime = await this.calculateOptimalSendTime(
      userId,
      notificationType,
      context
    );

    const template = await this.selectPersonalizedTemplate(
      userId,
      notificationType,
      context
    );

    const scheduled: ScheduledNotification = {
      id: this.generateNotificationId(),
      userId,
      type: notificationType,
      scheduledTime: optimalTime,
      template,
      priority: this.calculatePriority(notificationType, context),
      channels: await this.determineChannels(userId, context),
      metadata: {
        streakDays: context.streakDays,
        engagementScore: context.recentBehavior.engagementScore,
        churnRisk: context.recentBehavior.churnRiskScore,
      },
    };

    // GAP: No queue management for notification throttling
    await this.addToQueueWithThrottling(scheduled);

    return scheduled;
  }

  /**
   * GAP: Fixed notification frequency causes fatigue
   * SOLUTION: Adaptive frequency based on engagement
   */
  private async calculateOptimalSendTime(
    userId: string,
    type: NotificationType,
    context: NotificationContext
  ): Promise<Date> {
    const patterns = await getUserBehaviorPatterns(userId);

    // GAP: No consideration of user's current state
    if (context.deviceState.batteryLevel < 20) {
      // Defer non-critical notifications when battery is low
      if (type !== 'urgent') {
        return this.deferNotification(context.currentTime, 2, 'hours');
      }
    }

    // GAP: No timezone-aware scheduling
    const userTimezone = await getUserTimezone(userId);
    const localTime = this.convertToTimezone(context.currentTime, userTimezone);

    // Calculate optimal hour based on historical engagement
    const optimalHour = patterns.preferredNotificationTime
      ? parseInt(patterns.preferredNotificationTime.split(':')[0])
      : 9; // Default to 9 AM

    const optimalDate = new Date(localTime);
    optimalDate.setHours(optimalHour, 0, 0, 0);

    // If calculated optimal time is in the past, move to tomorrow
    if (optimalDate.getTime() < localTime.getTime()) {
      optimalDate.setDate(optimalDate.getDate() + 1);
    }

    // GAP: No avoidance of sleep hours
    if (optimalHour < 7 || optimalHour > 22) {
      optimalDate.setHours(9, 0, 0, 0); // Default to 9 AM
    }

    return optimalDate;
  }

  /**
   * GAP: One-size-fits-all notification content
   * SOLUTION: Dynamic template selection based on user segment
   */
  private async selectPersonalizedTemplate(
    userId: string,
    type: NotificationType,
    context: NotificationContext
  ): Promise<NotificationTemplate> {
    const userSegment = await this.getUserSegment(userId);
    const engagementLevel = context.recentBehavior.engagementScore;

    // GAP: No A/B testing of notification copy
    const templateVariants = NotificationTemplate.getVariants(type, userSegment);

    // Select based on engagement level
    let template: NotificationTemplate;

    if (engagementLevel > 80) {
      // High engagement: Challenge-oriented
      template = templateVariants.find(t => t.tone === 'challenging') || templateVariants[0];
    } else if (engagementLevel > 50) {
      // Medium engagement: Supportive
      template = templateVariants.find(t => t.tone === 'supportive') || templateVariants[0];
    } else {
      // Low engagement: Motivational/Re-engagement
      template = templateVariants.find(t => t.tone === 'motivational') || templateVariants[0];
    }

    // GAP: No personalization with user's actual data
    const personalizedContent = this.interpolateTemplate(template, {
      userName: await this.getUserName(userId),
      streakDays: context.streakDays,
      currentGoal: context.currentGoal,
      lastScanProduct: await this.getLastScanProduct(userId),
    });

    return { ...template, content: personalizedContent };
  }

  /**
   * GAP: No intelligent channel selection
   * SOLUTION: Multi-channel strategy based on user preference & context
   */
  private async determineChannels(
    userId: string,
    context: NotificationContext
  ): Promise<NotificationChannel[]> {
    const preferences = await this.getUserPreferences(userId);
    const channels: NotificationChannel[] = [];

    // GAP: No consideration of notification importance
    if (context.deviceState.appInForeground) {
      // User is active: Use in-app notification
      channels.push('in-app');
    }

    // GAP: No respect for Do Not Disturb hours
    const currentHour = new Date().getHours();
    if (currentHour >= 8 && currentHour <= 21) {
      if (preferences.pushEnabled) {
        channels.push('push');
      }
    }

    // GAP: No email fallback for important notifications
    if (preferences.emailEnabled && this.isHighPriority(context)) {
      channels.push('email');
    }

    return channels;
  }

  /**
   * GAP: No notification throttling causes spam
   * SOLUTION: Smart queue with rate limiting
   */
  private async addToQueueWithThrottling(notification: ScheduledNotification) {
    const userNotifications = this.notificationQueue.filter(
      n => n.userId === notification.userId &&
           this.isWithinTimeWindow(n.scheduledTime, notification.scheduledTime, 1, 'hours')
    );

    // GAP: No maximum notifications per hour/day
    const MAX_PER_HOUR = 3;
    const MAX_PER_DAY = 10;

    if (userNotifications.length >= MAX_PER_HOUR) {
      // Defer notification
      notification.scheduledTime = this.deferNotification(
        notification.scheduledTime,
        1,
        'hours'
      );
      console.log(`Throttling notification for user ${notification.userId}`);
    }

    this.notificationQueue.push(notification);
    await this.persistQueue();
  }

  // Helper methods
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private deferNotification(baseTime: Date, amount: number, unit: 'hours' | 'days'): Date {
    const deferred = new Date(baseTime);
    if (unit === 'hours') {
      deferred.setHours(deferred.getHours() + amount);
    } else {
      deferred.setDate(deferred.getDate() + amount);
    }
    return deferred;
  }

  private isWithinTimeWindow(time1: Date, time2: Date, amount: number, unit: 'hours' | 'days'): boolean {
    const diffMs = Math.abs(time1.getTime() - time2.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    return unit === 'hours' ? diffHours <= amount : diffDays <= amount;
  }

  private calculatePriority(type: NotificationType, context: NotificationContext): number {
    // Priority scale: 1 (low) to 5 (critical)
    const priorities: Record<string, number> = {
      'mission-reminder': 3,
      'streak-celebration': 4,
      're-engagement': 2,
      'health-tip': 2,
      'urgent': 5,
      'weekly-summary': 2,
    };
    const basePriority = priorities[type] || 3;

    // Adjust based on user engagement
    if (context.recentBehavior.churnRiskScore > 0.7) {
      return Math.min(5, basePriority + 1); // Boost priority for at-risk users
    }

    return basePriority;
  }

  private isHighPriority(context: NotificationContext): boolean {
    return context.recentBehavior.churnRiskScore > 0.6 ||
           context.streakDays >= 7; // Celebrate milestones
  }

  private async getUserSegment(userId: string): Promise<UserSegment> {
    // Implementation for user segmentation
    return 'regular'; // Placeholder
  }

  private interpolateTemplate(template: NotificationTemplate, data: any): string {
    return template.content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
  }

  private async persistQueue(): Promise<void> {
    // Persist to AsyncStorage or database
  }

  private async getUserPreferences(userId: string): Promise<UserPreference> {
    return this.userPreferences.get(userId) || { pushEnabled: true, emailEnabled: false, smsEnabled: false } as UserPreference;
  }

  private async getUserName(userId: string): Promise<string> {
    return 'User'; // Placeholder
  }

  private async getLastScanProduct(userId: string): Promise<string> {
    return 'water'; // Placeholder
  }

  private convertToTimezone(date: Date, timezone: string): Date {
    // Simplified timezone conversion for stub
    return new Date(date);
  }
}

export type NotificationType =
  | 'mission-reminder'
  | 'streak-celebration'
  | 're-engagement'
  | 'health-tip'
  | 'urgent'
  | 'weekly-summary';

export type NotificationChannel = 'push' | 'in-app' | 'email' | 'sms';

export type UserSegment =
  | 'new'
  | 'regular'
  | 'power-user'
  | 'at-risk'
  | 'churned';

export interface ScheduledNotification {
  id: string;
  userId: string;
  type: NotificationType;
  scheduledTime: Date;
  template: NotificationTemplate;
  priority: number;
  channels: NotificationChannel[];
  metadata: {
    streakDays: number;
    engagementScore: number;
    churnRisk: number;
  };
}

export interface LocationContext {
  latitude: number;
  longitude: number;
  venue?: string;
  isHome: boolean;
  isWork: boolean;
}
