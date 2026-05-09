import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

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

export const userProfilesTable = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  subscriptionCycle: text("subscription_cycle"),
  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastScanDate: text("last_scan_date"),
  totalScans: integer("total_scans").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
export type UserProfile = typeof userProfilesTable.$inferSelect;
