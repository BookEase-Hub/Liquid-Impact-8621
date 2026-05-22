
// Manual Mocks
const mockReactNative = {
  Platform: { OS: 'ios' },
};

const mockExpoNotifications = {
  scheduleNotificationAsync: async () => {},
};

const mockExpoDevice = {
  isDevice: true,
};

const mockAsyncStorage = {
  getItem: async () => null,
  setItem: async () => {},
};

// Override require to use mocks
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path: string) {
  if (path === 'react-native') return mockReactNative;
  if (path === 'expo-notifications') return mockExpoNotifications;
  if (path === 'expo-device') return mockExpoDevice;
  if (path === '@react-native-async-storage/async-storage') return mockAsyncStorage;
  return originalRequire.apply(this, arguments);
};

import { BehaviorAnalytics } from '../services/analytics/BehaviorAnalytics';
import { SmartNotificationScheduler } from '../services/notifications/SmartNotificationScheduler';
import { RecommendationEngine } from '../services/personalization/RecommendationEngine';

async function runTests() {
  console.log('Starting verification tests...');

  const userId = 'test-user-123';

  // 1. Test BehaviorAnalytics
  console.log('Testing BehaviorAnalytics...');
  const analytics = BehaviorAnalytics.getInstance();
  await analytics.trackEvent({
    userId,
    eventType: 'app_open',
    timestamp: new Date(),
    metadata: {},
    sessionId: 'session-1'
  });
  const patterns = await analytics.getUserBehaviorPatterns(userId);
  console.log('Behavior patterns:', patterns);

  // 2. Test SmartNotificationScheduler
  console.log('Testing SmartNotificationScheduler...');
  const scheduler = SmartNotificationScheduler.getInstance();
  const context = {
    userId,
    currentTime: new Date(),
    userTimezone: 'UTC',
    lastScanDate: null,
    streakDays: 5,
    currentGoal: 'hydration',
    recentBehavior: patterns,
    deviceState: {
      isCharging: true,
      batteryLevel: 0.8,
      connectivity: 'wifi' as const,
      appInForeground: true,
    }
  };
  const scheduled = await scheduler.schedulePersonalizedNotification(userId, 'mission-reminder', context);
  console.log('Scheduled notification:', scheduled.id, scheduled.type, scheduled.scheduledTime);

  // 3. Test RecommendationEngine
  console.log('Testing RecommendationEngine...');
  const recEngine = RecommendationEngine.getInstance();
  const profile = await analytics.getProfile(userId);
  const recommendations = await recEngine.generateRecommendations(userId, profile, {
    currentScreen: 'Home',
    timeOfDay: 'morning'
  });
  console.log('Recommendations count:', recommendations.length);

  console.log('Verification tests completed successfully!');
}

runTests().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
