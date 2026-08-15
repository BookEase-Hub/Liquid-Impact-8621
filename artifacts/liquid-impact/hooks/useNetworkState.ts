import { useState, useEffect, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
}

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: true,
    isInternetReachable: null,
    connectionType: null,
  });

  const update = useCallback((s: NetInfoState) => {
    setState({
      isOnline: s.isConnected ?? true,
      isInternetReachable: s.isInternetReachable,
      connectionType: s.type,
    });
  }, []);

  useEffect(() => {
    NetInfo.fetch().then(update);
    const unsub = NetInfo.addEventListener(update);
    return unsub;
  }, [update]);

  return state;
}
