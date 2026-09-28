import { router } from "expo-router";
import { PropsWithChildren, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { getCurrentUser, getUserAccess } from "@/../services/authService";

type Role = "admin" | "member";

type RoleGuardProps = PropsWithChildren<{
  role: Role;
  redirectTo?: string;
}>;

/** Restricts a route to an authenticated user with the required role. */
export function RoleGuard({
  role,
  redirectTo = "/login",
  children,
}: RoleGuardProps) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const user = getCurrentUser();

    if (!user) {
      router.replace(redirectTo as never);
      return () => {
        active = false;
      };
    }

    getUserAccess(user.uid)
      .then((access) => {
        if (!active) return;
        const hasAccess =
          access?.role === role ||
          (role === "member" && access?.role === "admin");
        setAllowed(hasAccess);
        setChecking(false);
        if (!hasAccess) router.replace(redirectTo as never);
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
        router.replace(redirectTo as never);
      });

    return () => {
      active = false;
    };
  }, [redirectTo, role]);

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f7f2]">
        <ActivityIndicator color="#047857" />
        <Text className="mt-3 text-sm text-slate-500">Checking access...</Text>
      </View>
    );
  }

  return allowed ? <>{children}</> : null;
}
