import {
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

export const springs = {
  gentle: { damping: 15, stiffness: 100, mass: 1, overshootClamping: true as const },
  bouncy: { damping: 10, stiffness: 200, mass: 0.8, overshootClamping: false as const },
  snappy: { damping: 20, stiffness: 300, mass: 0.5, overshootClamping: true as const },
  sluggish: { damping: 25, stiffness: 60, mass: 1.5, overshootClamping: false as const },
};

export const timings = {
  fast: { duration: 150 },
  normal: { duration: 250 },
  slow: { duration: 400 },
  verySlow: { duration: 600 },
};

export function springIn(sv: SharedValue<number>, toValue = 1) {
  'worklet';
  sv.value = withSpring(toValue, springs.bouncy);
}

export function springOut(sv: SharedValue<number>, toValue = 0) {
  'worklet';
  sv.value = withSpring(toValue, springs.gentle);
}

export function fadeIn(sv: SharedValue<number>, delay = 0) {
  'worklet';
  sv.value = withDelay(delay, withTiming(1, timings.normal));
}

export function fadeOut(sv: SharedValue<number>) {
  'worklet';
  sv.value = withTiming(0, timings.fast);
}

export function scalePress(sv: SharedValue<number>) {
  'worklet';
  sv.value = withSpring(0.96, springs.snappy);
}

export function scaleRelease(sv: SharedValue<number>) {
  'worklet';
  sv.value = withSpring(1, springs.bouncy);
}

export function cardEnterY(sv: SharedValue<number>, index = 0) {
  'worklet';
  sv.value = withDelay(index * 60, withSpring(0, springs.gentle));
}

export function interpolateOpacity(progress: number, inputRange = [0, 1]) {
  'worklet';
  return interpolate(progress, inputRange, [0, 1], Extrapolation.CLAMP);
}

export function interpolateScale(progress: number, min = 0.92, max = 1) {
  'worklet';
  return interpolate(progress, [0, 1], [min, max], Extrapolation.CLAMP);
}
