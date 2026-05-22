import { ScanResult } from '@/types';
import { UserBehaviorProfile } from '../analytics/BehaviorAnalytics';

export interface PersonalizedRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  actionUrl?: string;
  priority: number; // 1-10
  expiresAt?: Date;
  metadata: {
    reason: string;
    confidence: number; // 0-1
    userSegment: string;
  };
}

export type RecommendationType =
  | 'product-alternative'
  | 'health-tip'
  | 'mission-suggestion'
  | 'goal-adjustment'
  | 'feature-discovery'
  | 're-engagement'
  | 'educational-content';

export class RecommendationEngine {
  private static instance: RecommendationEngine;
  private recommendationCache: Map<string, PersonalizedRecommendation[]> = new Map();

  private constructor() {}

  static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  /**
   * GAP: Generic recommendations for all users
   * SOLUTION: Context-aware, personalized recommendations
   */
  async generateRecommendations(
    userId: string,
    profile: UserBehaviorProfile,
    context: RecommendationContext
  ): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];

    // GAP: No consideration of recent behavior
    const recentScans = await this.getRecentScans(userId, 7);

    // 1. Product Alternatives (if high sugar drinks detected)
    const highSugarDrinks = recentScans.filter(s => s.composition.sugarGrams > 15);
    if (highSugarDrinks.length > 0) {
      recommendations.push(...this.generateAlternativeRecommendations(highSugarDrinks));
    }

    // 2. Health Tips (based on scan patterns)
    if (profile.scansPerWeek < 3) {
      recommendations.push(this.generateFrequencyTip(profile));
    }

    // 3. Mission Suggestions (based on goals)
    recommendations.push(...this.generateMissionRecommendations(profile));

    // 4. Feature Discovery (for underutilized features)
    recommendations.push(...this.generateFeatureDiscoveryRecommendations(profile));

    // 5. Re-engagement (for at-risk users)
    if (profile.churnRiskScore > 0.5) {
      recommendations.push(this.generateReEngagementRecommendation(profile));
    }

    // Sort by priority and return top 5
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  /**
   * GAP: No collaborative filtering
   * SOLUTION: "Users like you also..." recommendations
   */
  async getCollaborativeRecommendations(userId: string): Promise<PersonalizedRecommendation[]> {
    // Find similar users based on behavior
    const similarUsers = await this.findSimilarUsers(userId);

    // Get popular items among similar users
    const popularItems = await this.getPopularItemsAmongUsers(similarUsers);

    // Filter out items user has already tried
    const userHistory = await this.getUserHistory(userId);
    const newItems = popularItems.filter(item => !userHistory.includes(item));

    return newItems.slice(0, 3).map(item => ({
      id: `collab_${item.id}`,
      type: 'product-alternative',
      title: `Popular among users like you`,
      description: item.description,
      priority: 6,
      metadata: {
        reason: 'Collaborative filtering',
        confidence: 0.7,
        userSegment: 'similar-users',
      },
    }));
  }

  /**
   * GAP: No content-based filtering
   * SOLUTION: Recommend based on product attributes
   */
  async getContentBasedRecommendations(lastScan: ScanResult): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];

    // Find products with similar attributes but better health score
    const similarProducts = await this.findSimilarProducts(lastScan);

    const betterAlternatives = similarProducts.filter(p =>
      p.impactScore > lastScan.impactScore
    );

    if (betterAlternatives.length > 0) {
      recommendations.push({
        id: `content_${betterAlternatives[0].id}`,
        type: 'product-alternative',
        title: `Try this instead of ${lastScan.detectedProduct}`,
        description: `Similar taste, ${betterAlternatives[0].impactScore - lastScan.impactScore} points healthier`,
        priority: 8,
        metadata: {
          reason: 'Content-based filtering',
          confidence: 0.85,
          userSegment: 'health-conscious',
        },
      });
    }

    return recommendations;
  }

  /**
   * GAP: No temporal personalization
   * SOLUTION: Time-aware recommendations
   */
  async getTemporalRecommendations(userId: string, currentTime: Date): Promise<PersonalizedRecommendation[]> {
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    const recommendations: PersonalizedRecommendation[] = [];

    // Morning recommendations (6-10 AM)
    if (hour >= 6 && hour <= 10) {
      recommendations.push({
        id: `temp_morning_${Date.now()}`,
        type: 'health-tip',
        title: 'Start your day hydrated',
        description: 'Drink water before your morning coffee for better energy',
        priority: 5,
        metadata: {
          reason: 'Morning routine optimization',
          confidence: 0.75,
          userSegment: 'morning-person',
        },
      });
    }

    // Afternoon slump (2-4 PM)
    if (hour >= 14 && hour <= 16) {
      recommendations.push({
        id: `temp_afternoon_${Date.now()}`,
        type: 'health-tip',
        title: 'Beat the afternoon slump',
        description: 'Try green tea instead of energy drinks for sustained energy',
        priority: 6,
        metadata: {
          reason: 'Afternoon energy management',
          confidence: 0.8,
          userSegment: 'office-worker',
        },
      });
    }

    // Weekend recommendations
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      recommendations.push({
        id: `temp_weekend_${Date.now()}`,
        type: 'mission-suggestion',
        title: 'Weekend hydration challenge',
        description: 'Track 5 drinks today and earn bonus XP',
        priority: 7,
        metadata: {
          reason: 'Weekend engagement',
          confidence: 0.7,
          userSegment: 'weekend-warrior',
        },
      });
    }

    return recommendations;
  }

  // Helper methods
  private generateAlternativeRecommendations(drinks: ScanResult[]): PersonalizedRecommendation[] {
    return drinks.map(drink => ({
      id: `alt_${drink.id}`,
      type: 'product-alternative',
      title: `Healthier alternative to ${drink.detectedProduct}`,
      description: `Try water or unsweetened tea instead (${drink.composition.sugarGrams}g sugar saved)`,
      priority: 9,
      metadata: {
        reason: 'High sugar content detected',
        confidence: 0.9,
        userSegment: 'health-improver',
      },
    }));
  }

  private generateFrequencyTip(profile: UserBehaviorProfile): PersonalizedRecommendation {
    return {
      id: `freq_tip_${Date.now()}`,
      type: 'health-tip',
      title: 'Build a healthier habit',
      description: `You're scanning ${profile.scansPerWeek.toFixed(1)} times/week. Try scanning daily for better insights!`,
      priority: 6,
      metadata: {
        reason: 'Low scan frequency',
        confidence: 0.85,
        userSegment: 'casual-user',
      },
    };
  }

  private generateMissionRecommendations(profile: UserBehaviorProfile): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    if (profile.streakDays < 7) {
      recommendations.push({
        id: `mission_streak_${Date.now()}`,
        type: 'mission-suggestion',
        title: '7-Day Streak Challenge',
        description: 'Scan a drink every day for a week',
        priority: 7,
        metadata: {
          reason: 'Habit formation',
          confidence: 0.8,
          userSegment: 'habit-builder',
        },
      });
    }

    return recommendations;
  }

  private generateFeatureDiscoveryRecommendations(profile: UserBehaviorProfile): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    const unusedFeatures = ['weekly-summary', 'alternatives', 'nutrition-details'].filter(
      feature => (profile.featureUsage.get(feature) || 0) === 0
    );

    if (unusedFeatures.length > 0) {
      recommendations.push({
        id: `feature_${unusedFeatures[0]}`,
        type: 'feature-discovery',
        title: `Discover ${unusedFeatures[0].replace('-', ' ')}`,
        description: 'Tap here to learn about this feature',
        priority: 4,
        metadata: {
          reason: 'Feature underutilization',
          confidence: 0.7,
          userSegment: 'explorer',
        },
      });
    }

    return recommendations;
  }

  private generateReEngagementRecommendation(profile: UserBehaviorProfile): PersonalizedRecommendation {
    return {
      id: `reengage_${Date.now()}`,
      type: 're-engagement',
      title: 'We miss you!',
      description: 'Come back and scan your first drink this week',
      priority: 10,
      metadata: {
        reason: 'High churn risk',
        confidence: 0.9,
        userSegment: 'at-risk',
      },
    };
  }

  private async findSimilarUsers(userId: string): Promise<string[]> {
    // Implementation: Find users with similar behavior patterns
    return [];
  }

  private async getPopularItemsAmongUsers(userIds: string[]): Promise<any[]> {
    // Implementation: Get popular items among similar users
    return [];
  }

  private async getUserHistory(userId: string): Promise<string[]> {
    // Implementation: Get user's scan history
    return [];
  }

  private async findSimilarProducts(scan: ScanResult): Promise<any[]> {
    // Implementation: Find products with similar attributes
    return [];
  }

  private async getRecentScans(userId: string, days: number): Promise<ScanResult[]> {
    // Implementation: Fetch recent scans
    return [];
  }
}

export interface RecommendationContext {
  currentScreen: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  userMood?: 'energetic' | 'tired' | 'stressed' | 'relaxed';
  location?: 'home' | 'work' | 'gym' | 'restaurant';
}
