import { NotificationType, UserSegment } from './SmartNotificationScheduler';

export class NotificationTemplate {
  id: string;
  type: NotificationType;
  tone: 'challenging' | 'supportive' | 'motivational';
  content: string;

  constructor(id: string, type: NotificationType, tone: 'challenging' | 'supportive' | 'motivational', content: string) {
    this.id = id;
    this.type = type;
    this.tone = tone;
    this.content = content;
  }

  static getVariants(type: NotificationType, segment: UserSegment): NotificationTemplate[] {
    // Mock data for variants
    return [
      new NotificationTemplate(`${type}-1`, type, 'challenging', "Ready for a challenge, {{userName}}? Your {{streakDays}} day streak is at stake!"),
      new NotificationTemplate(`${type}-2`, type, 'supportive', "You're doing great, {{userName}}! Keep up the good work on your {{currentGoal}}."),
      new NotificationTemplate(`${type}-3`, type, 'motivational', "Time to scan! {{userName}}, staying hydrated helps with {{currentGoal}}."),
    ];
  }
}
