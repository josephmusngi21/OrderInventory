import { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";

type SkeletonProps = {
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/** Provides a lightweight, pulsing placeholder while content is loading. */
export function Skeleton({ className = "", style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible={false}
      className={`rounded-lg bg-[#d9d4ca] ${className}`}
      style={[{ opacity }, style]}
    />
  );
}
