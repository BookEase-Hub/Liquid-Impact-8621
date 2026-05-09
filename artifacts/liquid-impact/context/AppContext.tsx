import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import type { AppState, DailyMission, ScanResult, SubscriptionTier } from "@/types";

const STORAGE_KEY = "@liquid_impact_state";
const TODAY = () => new Date().toDateString();

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
    description: "Scan a drink with 70%+ hydration",
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
  const last = new Date(lastScanDate);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return currentStreak;
  if (diff === 1) return currentStreak;
  return 0;
}

function resetMissionsIfNeeded(state: AppState): DailyMission[] {
  if (state.lastMissionReset !== TODAY()) {
    return DEFAULT_MISSIONS;
  }
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
      const lastDate = state.lastScanDate;
      let newStreak = state.streak;

      if (lastDate !== today) {
        const wasYesterday =
          lastDate ===
          new Date(Date.now() - 86400000).toDateString();
        newStreak = wasYesterday ? state.streak + 1 : 1;
      }

      const updatedMissions = state.missions.map((m) => {
        if (m.completed) return m;
        let newProgress = m.progress;
        if (m.id === "mission_scan3") newProgress += 1;
        if (m.id === "mission_water" && scan.hydrationLevel >= 70)
          newProgress += 1;
        if (m.id === "mission_healthy" && scan.impactScore >= 80)
          newProgress += 1;
        return {
          ...m,
          progress: Math.min(newProgress, m.target),
          completed: newProgress >= m.target,
        };
      });

      return {
        ...state,
        scans: [scan, ...state.scans].slice(0, 200),
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
  todayScanCount: number;
  avgScore: number;
  weeklyScores: { day: string; shortDay: string; score: number; count: number }[];
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
          dispatch({
            type: "LOAD_STATE",
            payload: { ...getInitialState(), hasOnboarded: false },
          });
        }
      } else {
        dispatch({
          type: "LOAD_STATE",
          payload: { ...getInitialState(), hasOnboarded: false },
        });
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

  const FREE_LIMIT = 5;
  const canScan =
    state.subscription !== "free" || todayScanCount < FREE_LIMIT;

  const avgScore =
    state.scans.length > 0
      ? Math.round(
          state.scans.slice(0, 20).reduce((sum, s) => sum + s.impactScore, 0) /
            Math.min(state.scans.length, 20),
        )
      : 0;

  const weeklyScores = (() => {
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
                dayScans.reduce((sum, s) => sum + s.impactScore, 0) /
                  dayScans.length,
              )
            : 0,
        count: dayScans.length,
      };
    });
  })();

  return (
    <AppContext.Provider
      value={{
        state,
        addScan,
        completeOnboarding,
        setSubscription,
        canScan,
        todayScanCount,
        avgScore,
        weeklyScores,
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
