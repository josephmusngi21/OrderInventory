import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import {
    getCurrentUser,
    getUserAccess,
    logout,
} from "@/../services/authService";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

/** Provides the conventional account menu for members and administrators. */
export default function AccountPage() {
  const [email, setEmail] = useState("Account");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("member");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const refreshAccount = useCallback(() => {
    const user = getCurrentUser();
    if (!user) {
      setEmail("Signed out");
      setDisplayName("");
      setRole("member");
      setCompanyId(null);
      return;
    }
    setEmail(user.email || "Account");
    setError(null);
    getUserAccess(user.uid)
      .then((access) => {
        const savedName = user.displayName || access?.displayName || "";
        setDisplayName(savedName);
        setRole(access?.role || "member");
        setCompanyId(access?.companyId || null);
      })
      .catch((accessError) =>
        setError(
          accessError instanceof Error
            ? accessError.message
            : "Unable to load account details.",
        ),
      );
  }, []);

  useFocusEffect(refreshAccount);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch (logoutError) {
      setSigningOut(false);
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "Unable to log out.",
      );
    }
  }

  const missingProfileInfo =
    !displayName.trim() || !email || email === "Account";

  if (signingOut) {
    return (
      <AuthLoadingScreen
        title="Signing you out"
        description="Ending your secure session."
      />
    );
  }

  return (
    <Screen
      eyebrow="Account"
      title="Your account"
      description="Manage your session, profile context, and legal options from one place."
    >
      <View className="max-w-2xl gap-5">
        <View className="rounded-2xl bg-[#102a43] p-6">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-[#f4b942]">
            Signed in as
          </Text>
          <Text className="mt-3 text-xl font-bold text-[#fffdf8]">{email}</Text>
          {displayName && (
            <Text className="mt-1 text-sm font-semibold text-[#bcccdc]">
              {displayName}
            </Text>
          )}
          <Text className="mt-2 text-sm uppercase text-[#bcccdc]">
            {role} {companyId ? "· company member" : "· setup incomplete"}
          </Text>
        </View>
        {missingProfileInfo && (
          <View className="gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <Text className="text-sm font-bold text-amber-950">
              Profile information needed
            </Text>
            <Text className="text-sm leading-5 text-amber-900">
              Add your name so company administrators can identify you in the
              member list.
            </Text>
            <Button
              onPress={() => router.push("/profile" as never)}
              variant="secondary"
            >
              Complete profile
            </Button>
          </View>
        )}
        <View className="gap-3 rounded-2xl border border-[#d9d4ca] bg-[#fffdf8] p-5 shadow-sm">
          <Text className="text-lg font-bold text-[#102a43]">Account menu</Text>
          <Button
            variant="secondary"
            onPress={() => router.push("/profile" as never)}
          >
            Profile and security
          </Button>
          {role === "admin" && (
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/settings" as never,
                  params: { companyId: companyId || "" },
                })
              }
            >
              Company settings
            </Button>
          )}
          <Button
            variant="secondary"
            onPress={() => router.push("/privacy" as never)}
          >
            Privacy policy
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.push("/terms" as never)}
          >
            Terms of service
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.push("/account-delete" as never)}
          >
            Request account deletion
          </Button>
          <Button variant="danger" onPress={handleLogout}>
            Log out
          </Button>
          {error && <Text className="text-sm text-rose-600">{error}</Text>}
        </View>
      </View>
    </Screen>
  );
}
