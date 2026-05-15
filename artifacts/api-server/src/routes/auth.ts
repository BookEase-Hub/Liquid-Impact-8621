import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from "../middleware/authMiddleware";

export const authRouter = Router();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenPair(userId: string, email: string) {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });
  return { accessToken, refreshToken, refreshTokenHash: hashToken(refreshToken) };
}

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

authRouter.post("/signup", async (req, res) => {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: displayName ?? null,
        emailVerified: false,
      })
      .returning();

    const { accessToken: at, refreshToken: rt, refreshTokenHash } = tokenPair(user.id, user.email);
    await db
      .update(usersTable)
      .set({ refreshTokenHash })
      .where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "User signed up");
    return res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken: at,
      refreshToken: rt,
    });
  } catch (err) {
    req.log.error({ err }, "Signup error");
    return res.status(500).json({ error: "Failed to create account" });
  }
});

authRouter.post("/signin", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { accessToken, refreshToken, refreshTokenHash } = tokenPair(user.id, user.email);
    await db.update(usersTable).set({ refreshTokenHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "User signed in");
    return res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    req.log.error({ err }, "Signin error");
    return res.status(500).json({ error: "Sign in failed" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    const payload = verifyAccessToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user || user.refreshTokenHash !== tokenHash) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const { accessToken, refreshToken: newRefresh, refreshTokenHash } = tokenPair(user.id, user.email);
    await db.update(usersTable).set({ refreshTokenHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    return res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

authRouter.post("/signout", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    try {
      const payload = verifyAccessToken(refreshToken);
      await db
        .update(usersTable)
        .set({ refreshTokenHash: null, updatedAt: new Date() })
        .where(eq(usersTable.id, payload.userId));
    } catch {
      // token already invalid — still succeed
    }
  }
  req.log.info("User signed out");
  return res.json({ success: true });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      req.log.info({ email }, "Forgot password: email not found (silent)");
      return res.json({
        message: "If an account with that email exists, a reset code has been sent.",
      });
    }

    const code = generateResetCode();
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db
      .update(usersTable)
      .set({ passwordResetTokenHash: codeHash, passwordResetExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "Password reset code generated");

    // In production: send email with the code
    // For now: return the code in the response for development
    const isDev = process.env.NODE_ENV !== "production";
    return res.json({
      message: "If an account with that email exists, a reset code has been sent.",
      ...(isDev && { devCode: code }),
    });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    return res.status(500).json({ error: "Failed to process request" });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  const { email, code, password } = req.body as {
    email?: string;
    code?: string;
    password?: string;
  };

  if (!email || !code || !password) {
    return res.status(400).json({ error: "Email, code, and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    if (new Date() > user.passwordResetExpiresAt) {
      return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    }

    const codeHash = hashToken(code);
    if (codeHash !== user.passwordResetTokenHash) {
      return res.status(400).json({ error: "Invalid reset code" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(usersTable)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "Password reset successfully");
    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

authRouter.post("/google", async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    return res.status(400).json({ error: "Google ID token is required" });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID || undefined,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const { email, sub: googleId, name: displayName, picture: avatarUrl } = payload;

    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (user) {
      if (!user.googleId) {
        await db.update(usersTable).set({ googleId, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      }
    } else {
      [user] = await db
        .insert(usersTable)
        .values({ email, googleId, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null, emailVerified: true })
        .returning();
    }

    const { accessToken, refreshToken, refreshTokenHash } = tokenPair(user.id, user.email);
    await db.update(usersTable).set({ refreshTokenHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "Google auth success");
    return res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName ?? displayName },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    req.log.error({ err }, "Google auth error");
    return res.status(401).json({ error: "Google authentication failed" });
  }
});

authRouter.post("/apple", async (req, res) => {
  const { identityToken, email: appleEmail, fullName } = req.body as {
    identityToken?: string;
    email?: string;
    fullName?: string;
  };

  if (!identityToken) {
    return res.status(400).json({ error: "Apple identity token is required" });
  }

  try {
    const parts = identityToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
    };

    const appleId = claims.sub;
    const email = claims.email ?? appleEmail;

    if (!appleId || !email) {
      return res.status(400).json({ error: "Invalid Apple token payload" });
    }

    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (user) {
      if (!user.appleId) {
        await db.update(usersTable).set({ appleId, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      }
    } else {
      [user] = await db
        .insert(usersTable)
        .values({ email, appleId, displayName: fullName ?? null, emailVerified: true })
        .returning();
    }

    const { accessToken, refreshToken, refreshTokenHash } = tokenPair(user.id, user.email);
    await db.update(usersTable).set({ refreshTokenHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "Apple auth success");
    return res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName ?? fullName },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    req.log.error({ err }, "Apple auth error");
    return res.status(401).json({ error: "Apple authentication failed" });
  }
});

authRouter.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});
