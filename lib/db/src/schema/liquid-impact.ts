import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").notNull().default(false),
    googleId: text("google_id"),
    appleId: text("apple_id"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    refreshTokenHash: text("refresh_token_hash"),
    passwordResetTokenHash: text("password_reset_token_hash"),
    passwordResetExpiresAt: timestamp("password_reset_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;

export const scansTable = pgTable("scans", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  detectedProduct: text("detected_product").notNull(),
  brand: text("brand"),
  category: text("category").notNull(),
  liquidType: text("liquid_type").notNull().default("beverage"),
  confidenceScore: real("confidence_score").notNull().default(0.85),
  impactScore: integer("impact_score").notNull(),
  hydrationLevel: integer("hydration_level").notNull(),
  glycemicImpact: text("glycemic_impact").notNull(),
  status: text("status").notNull(),
  dehydrationRisk: boolean("dehydration_risk").notNull().default(false),
  aiInsight: text("ai_insight").notNull(),
  viralStatement: text("viral_statement"),
  alternatives: jsonb("alternatives").$type<string[]>().default([]),
  shortTermImpact: jsonb("short_term_impact").notNull(),
  mediumTermImpact: jsonb("medium_term_impact").notNull(),
  longTermImpact: jsonb("long_term_impact").notNull(),
  composition: jsonb("composition").notNull(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScanSchema = createInsertSchema(scansTable).omit({
  createdAt: true,
});

export type InsertScan = typeof scansTable.$inferInsert;
export type Scan = typeof scansTable.$inferSelect;

export const userProfilesTable = pgTable(
  "user_profiles",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    subscriptionTier: text("subscription_tier").notNull().default("free"),
    subscriptionStatus: text("subscription_status").notNull().default("active"),
    subscriptionCycle: text("subscription_cycle"),
    subscriptionExpiresAt: timestamp("subscription_expires_at"),
    streak: integer("streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastScanDate: text("last_scan_date"),
    totalScans: integer("total_scans").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    check("subscription_tier_check", sql`${t.subscriptionTier} in ('free','starter','pro','elite','family')`),
    check("subscription_status_check", sql`${t.subscriptionStatus} in ('active','expired','grace_period','billing_retry','canceled')`),
  ],
);

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
export type UserProfile = typeof userProfilesTable.$inferSelect;
