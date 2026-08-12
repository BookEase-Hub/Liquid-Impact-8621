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
  index,
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
  consumableType: text("consumable_type"),
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

  // Food-specific columns (all nullable for backward compat)
  satietyScore: integer("satiety_score"),
  digestiveLoad: text("digestive_load"),
  nutrientDensity: integer("nutrient_density"),
  fiberEstimate: text("fiber_estimate"),
  proteinQuality: text("protein_quality"),
  mealTimingFit: jsonb("meal_timing_fit"),
  bloodSugarTrajectory: text("blood_sugar_trajectory"),
  componentBreakdown: jsonb("component_breakdown"),
  allergenFlags: jsonb("allergen_flags"),
  processingLevel: text("processing_level"),
  mealType: text("meal_type"),

  // Scan-local provenance (paths/metadata only; image bytes stay in device/App Storage)
  imageUri: text("image_uri"),
  originalImageUri: text("original_image_uri"),
  compressedImageUri: text("compressed_image_uri"),
  thumbnailUri: text("thumbnail_uri"),
  imageHash: text("image_hash"),
  uncertaintyNotes: jsonb("uncertainty_notes").$type<string[]>(),
  nutritionEstimateUnavailable: boolean("nutrition_estimate_unavailable"),

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
    totalFoodScans: integer("total_food_scans").notNull().default(0),
    totalDrinkScans: integer("total_drink_scans").notNull().default(0),
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

// ── Product Intelligence Database ─────────────────────────────────────────────
export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    brand: text("brand"),
    barcode: text("barcode"),
    nameFingerprint: text("name_fingerprint").notNull(),
    imageHash: text("image_hash"),
    category: text("category").notNull().default("other"),
    liquidType: text("liquid_type").notNull().default("beverage"),
    consumableType: text("consumable_type").default("beverage"),
    source: text("source").notNull().default("ai"),
    impactScore: integer("impact_score").notNull().default(0),
    hydrationLevel: integer("hydration_level").notNull().default(50),
    glycemicImpact: text("glycemic_impact").notNull().default("low"),
    status: text("status").notNull().default("stable"),
    analysisJson: jsonb("analysis_json").$type<Record<string, unknown>>().notNull(),
    scanCount: integer("scan_count").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("products_barcode_idx").on(t.barcode),
    index("products_fingerprint_idx").on(t.nameFingerprint),
    index("products_image_hash_idx").on(t.imageHash),
  ]
);

export type InsertProduct = typeof productsTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
