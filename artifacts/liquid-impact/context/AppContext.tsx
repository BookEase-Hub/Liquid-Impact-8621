import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import type {
  AppState,
  DailyMission,
  DailyStatus,
  ScanResult,
  SubscriptionTier,
  WeeklyScore,
} from "@/types";

const STORAGE_KEY = "@liquid_impact_v2";
const TODAY = () => new Date().toDateString();
const THIS_MONTH = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
};

export const SUBSCRIPTION_LIMITS: Record<
  SubscriptionTier,
  { daily: number | null; monthly: number | null; label: string; color: string }
> = {
  free: { daily: 3, monthly: null, label: "Free", color: "#6B6B80" },
  starter: { daily: null, monthly: 100, label: "Starter", color: "#00B4D8" },
  pro: { daily: null, monthly: null, label: "Pro", color: "#7B2CBF" },
  elite: { daily: null, monthly: null, label: "Elite", color: "#FFD700" },
  family: { daily: null, monthly: null, label: "Family", color: "#FF6B9D" },
};

const DEFAULT_MISSIONS: DailyMission[] = [
  {
    id: "mission_scan3",
    title: "Scan 3 Drinks",
    description: "Analyze 3 different drinks today",
    progress: 0,
    target: 3,
    completed: false,
    icon: "camera",
    xp: 50,
  },
  {
    id: "mission_water",
    title: "Stay Hydrated",
    description: "Scan a drink with 70%+ hydration score",
    progress: 0,
    target: 1,
    completed: false,
    icon: "water",
    xp: 30,
  },
  {
    id: "mission_healthy",
    title: "Healthy Choice",
    description: "Scan a drink scoring 80 or above",
    progress: 0,
    target: 1,
    completed: false,
    icon: "leaf",
    xp: 40,
  },
  {
    id: "mission_streak",
    title: "Keep the Streak",
    description: "Scan at least one drink today",
    progress: 0,
    target: 1,
    completed: false,
    icon: "flame",
    xp: 20,
  },
];

type Action =
  | { type: "LOAD_STATE"; payload: AppState }
  | { type: "ADD_SCAN"; payload: ScanResult }
  | { type: "SET_ONBOARDED" }
  | { type: "SET_SUBSCRIPTION"; payload: SubscriptionTier }
  | { type: "UPDATE_MISSIONS"; payload: DailyMission[] };

function getInitialState(): AppState {
  return {
    scans: [],
    streak: 0,
    longestStreak: 0,
    lastScanDate: null,
    subscription: "free",
    hasOnboarded: null,
    missions: DEFAULT_MISSIONS,
    lastMissionReset: null,
  };
}

function computeStreak(
  lastScanDate: string | null,
  currentStreak: number,
): number {
  if (!lastScanDate) return 0;
  const diff = Math.floor(
    (Date.now() - new Date(lastScanDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff > 1) return 0;
  return currentStreak;
}

function resetMissionsIfNeeded(state: AppState): DailyMission[] {
  if (state.lastMissionReset !== TODAY()) return DEFAULT_MISSIONS;
  return state.missions;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return {
        ...action.payload,
        hasOnboarded: action.payload.hasOnboarded ?? false,
        missions: resetMissionsIfNeeded(action.payload),
      };

    case "ADD_SCAN": {
      const scan = action.payload;
      const today = TODAY();
      let newStreak = state.streak;

      if (state.lastScanDate !== today) {
        const wasYesterday =
          state.lastScanDate ===
          new Date(Date.now() - 86400000).toDateString();
        newStreak = wasYesterday ? state.streak + 1 : 1;
      }

      const updatedMissions = state.missions.map((m) => {
        if (m.completed) return m;
        let np = m.progress;
        if (m.id === "mission_scan3") np += 1;
        if (m.id === "mission_streak") np = 1;
        if (m.id === "mission_water" && scan.hydrationLevel >= 70) np += 1;
        if (m.id === "mission_healthy" && scan.impactScore >= 80) np += 1;
        return { ...m, progress: Math.min(np, m.target), completed: np >= m.target };
      });

      return {
        ...state,
        scans: [scan, ...state.scans].slice(0, 500),
        streak: newStreak,
        longestStreak: Math.max(newStreak, state.longestStreak),
        lastScanDate: today,
        missions: updatedMissions,
        lastMissionReset: state.lastMissionReset ?? today,
      };
    }

    case "SET_ONBOARDED":
      return { ...state, hasOnboarded: true };

    case "SET_SUBSCRIPTION":
      return { ...state, subscription: action.payload };

    case "UPDATE_MISSIONS":
      return { ...state, missions: action.payload };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  addScan: (scan: ScanResult) => void;
  completeOnboarding: () => void;
  setSubscription: (tier: SubscriptionTier) => void;
  canScan: boolean;
  scanLimitMessage: string;
  todayScanCount: number;
  monthScanCount: number;
  avgScore: number;
  weeklyScores: WeeklyScore[];
  dailyStatus: DailyStatus;
  xpTotal: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, getInitialState());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as AppState;
          const streak = computeStreak(saved.lastScanDate, saved.streak);
          dispatch({ type: "LOAD_STATE", payload: { ...saved, streak } });
        } catch {
          dispatch({ type: "LOAD_STATE", payload: { ...getInitialState(), hasOnboarded: false } });
        }
      } else {
        dispatch({ type: "LOAD_STATE", payload: { ...getInitialState(), hasOnboarded: false } });
      }
    });
  }, []);

  useEffect(() => {
    if (state.hasOnboarded === null) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addScan = useCallback((scan: ScanResult) => {
    dispatch({ type: "ADD_SCAN", payload: scan });
  }, []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: "SET_ONBOARDED" });
  }, []);

  const setSubscription = useCallback((tier: SubscriptionTier) => {
    dispatch({ type: "SET_SUBSCRIPTION", payload: tier });
  }, []);

  const todayScanCount = state.scans.filter(
    (s) => new Date(s.scannedAt).toDateString() === TODAY(),
  ).length;

  const monthScanCount = state.scans.filter((s) => {
    const d = new Date(s.scannedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const limits = SUBSCRIPTION_LIMITS[state.subscription];
  const canScan =
    (limits.daily === null || todayScanCount < limits.daily) &&
    (limits.monthly === null || monthScanCount < limits.monthly);

  const scanLimitMessage =
    !canScan && limits.daily !== null
      ? `${todayScanCount}/${limits.daily} daily scans used`
      : !canScan && limits.monthly !== null
      ? `${monthScanCount}/${limits.monthly} monthly scans used`
      : "";

  const avgScore =
    state.scans.length > 0
      ? Math.round(
          state.scans.slice(0, 20).reduce((s, r) => s + r.impactScore, 0) /
            Math.min(state.scans.length, 20),
        )
      : 0;

  const weeklyScores: WeeklyScore[] = (() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const short = ["S", "M", "T", "W", "T", "F", "S"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toDateString();
      const dayScans = state.scans.filter(
        (s) => new Date(s.scannedAt).toDateString() === dayStr,
      );
      return {
        day: days[d.getDay()],
        shortDay: short[d.getDay()],
        score:
          dayScans.length > 0
            ? Math.round(
                dayScans.reduce((s, r) => s + r.impactScore, 0) / dayScans.length,
              )
            : 0,
        count: dayScans.length,
      };
    });
  })();

  const dailyStatus: DailyStatus = (() => {
    const recent = state.scans.slice(0, 5);
    if (recent.length === 0) {
      return { dehydrationRisk: false, recommendation: "Scan a drink to see your body status", hydration: 0, energy: 0, recovery: 0, focus: 0 };
    }
    const avgHyd = Math.round(recent.reduce((s, r) => s + r.hydrationLevel, 0) / recent.length);
    const avgImpact = Math.round(recent.reduce((s, r) => s + r.impactScore, 0) / recent.length);
    const avgCaff = recent.reduce((s, r) => s + r.composition.caffeineMg, 0) / recent.length;
    const dehydrationRisk = recent.some((s) => s.dehydrationRisk) || avgHyd < 40;
    return {
      dehydrationRisk,
      recommendation: dehydrationRisk
        ? "⚠️ Your recent drinks may cause dehydration. Drink more water!"
        : "✅ Your hydration levels look good. Keep it up!",
      hydration: avgHyd,
      energy: Math.min(100, avgImpact),
      recovery: Math.min(100, Math.max(0, 100 - (avgCaff / 200) * 100)),
      focus: Math.min(100, Math.max(0, 50 + avgImpact * 0.5)),
    };
  })();

  const xpTotal = state.missions
    .filter((m) => m.completed)
    .reduce((s, m) => s + m.xp, 0);

  return (
    <AppContext.Provider
      value={{
        state,
        addScan,
        completeOnboarding,
        setSubscription,
        canScan,
        scanLimitMessage,
        todayScanCount,
        monthScanCount,
        avgScore,
        weeklyScores,
        dailyStatus,
        xpTotal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
