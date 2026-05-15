import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { SignInData, SignUpData } from "./validation";

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

function apiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  return domain ? `https://${domain}/api/auth` : "/api/auth";
}

async function post<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  return data;
}

async function get<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  return data;
}

export const AuthService = {
  async signIn(data: SignInData): Promise<AuthResponse> {
    return post<AuthResponse>("/signin", data);
  },

  async signUp(data: SignUpData): Promise<AuthResponse> {
    return post<AuthResponse>("/signup", {
      email: data.email,
      password: data.password,
      displayName: data.displayName,
    });
  },

  async signOut(refreshToken: string): Promise<void> {
    await post("/signout", { refreshToken }).catch(() => {});
  },

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return post("/refresh", { refreshToken });
  },

  async getMe(accessToken: string): Promise<AuthUser> {
    return get<AuthUser>("/me", accessToken);
  },

  async signInWithGoogle(idToken: string): Promise<AuthResponse> {
    return post<AuthResponse>("/google", { idToken });
  },

  async signInWithApple(): Promise<AuthResponse> {
    const nonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString(36).slice(2),
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ") || undefined;
    return post<AuthResponse>("/apple", {
      identityToken: credential.identityToken,
      email: credential.email,
      fullName,
    });
  },

  async forgotPassword(email: string): Promise<{ message: string; devCode?: string }> {
    return post("/forgot-password", { email });
  },

  async resetPassword(email: string, code: string, password: string): Promise<{ message: string }> {
    return post("/reset-password", { email, code, password });
  },

  isAppleAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") return Promise.resolve(false);
    return AppleAuthentication.isAvailableAsync();
  },
};
