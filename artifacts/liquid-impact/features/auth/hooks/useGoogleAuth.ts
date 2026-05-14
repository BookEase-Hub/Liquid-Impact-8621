import { useEffect, useCallback } from "react";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import { useAuthStore } from "../store";

export function useGoogleAuth() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const redirectUri = makeRedirectUri({ scheme: "liquid-impact", path: "auth/callback" });

  const [request, response, promptAsync] = Google.useAuthRequest({
    // clientId selects the right ID for the current platform automatically.
    // Set all four in env so the OAuth flow works on every platform:
    //   EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID    – Expo Go / development
    //   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     – iOS native build
    //   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID – Android native build
    //   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID     – web / backend token verification
    clientId:
      process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
      "",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      if (authentication?.idToken) {
        signInWithGoogle(authentication.idToken).catch(() => {});
      } else if (authentication?.accessToken) {
        // Fall back to access token when idToken unavailable (web flow)
        signInWithGoogle(authentication.accessToken).catch(() => {});
      }
    }
  }, [response, signInWithGoogle]);

  const signIn = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  return { signIn, request };
}
