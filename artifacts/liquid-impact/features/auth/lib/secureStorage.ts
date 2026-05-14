import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEYS = {
  ACCESS_TOKEN: "li_access_token",
  REFRESH_TOKEN: "li_refresh_token",
  USER: "li_user",
} as const;

async function set(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function get(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function remove(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const storage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([set(KEYS.ACCESS_TOKEN, accessToken), set(KEYS.REFRESH_TOKEN, refreshToken)]);
  },
  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([get(KEYS.ACCESS_TOKEN), get(KEYS.REFRESH_TOKEN)]);
    return { accessToken, refreshToken };
  },
  async clearTokens(): Promise<void> {
    await Promise.all([remove(KEYS.ACCESS_TOKEN), remove(KEYS.REFRESH_TOKEN), remove(KEYS.USER)]);
  },
  async saveUser(user: object): Promise<void> {
    await set(KEYS.USER, JSON.stringify(user));
  },
  async getUser<T>(): Promise<T | null> {
    const raw = await get(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
};
