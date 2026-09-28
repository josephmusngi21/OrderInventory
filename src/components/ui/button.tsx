import { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

type ButtonProps = PropsWithChildren<{
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "quiet" | "danger";
}>;

/** Shared action button with consistent visual hierarchy and busy state. */
export function Button({
  children,
  onPress,
  busy = false,
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  const styles = {
    primary: "bg-[#102a43] active:bg-[#243b53]",
    secondary: "border border-[#bcccdc] bg-[#fffdf8] active:bg-[#e8e2d7]",
    quiet: "bg-transparent active:bg-[#e8e2d7]",
    danger: "bg-[#d95d39] active:bg-[#ba4a2e]",
  }[variant];
  const textStyles =
    variant === "primary" || variant === "danger"
      ? "text-white"
      : "text-slate-800";

  return (
    <Pressable
      className={`min-h-[46px] items-center justify-center rounded-xl px-5 py-3 ${styles} ${disabled || busy ? "opacity-50" : ""}`}
      disabled={disabled || busy}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator
          color={
            variant === "primary" || variant === "danger"
              ? "#ffffff"
              : "#0f172a"
          }
        />
      ) : (
        <Text className={`text-center text-sm font-bold ${textStyles}`}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
