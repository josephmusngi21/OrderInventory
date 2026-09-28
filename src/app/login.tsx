import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { getUserAccess, login } from "@/../services/authService";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

/** Provides the email/password sign-in flow. */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      const credentials = await login(email, password);
      const access = await getUserAccess(credentials.user.uid);
      if (!access?.companyId) {
        router.replace("/company-create");
      } else {
        router.replace({
          pathname: "/inventory",
          params: { companyId: access.companyId },
        });
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <AuthLoadingScreen
        title="Signing you in"
        description="Preparing your company workspace."
      />
    );
  }

  return (
    <Screen
      eyebrow="OrderInventory"
      title="Welcome back"
      description="Sign in to keep your team's inventory accurate and ready to share."
    >
      <View className="max-w-xl gap-4 rounded-2xl border border-[#d9d4ca] bg-[#fffdf8] p-5 shadow-sm md:p-8">
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Email
          </Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#64748b"
            style={{ color: "#0f172a" }}
            value={email}
          />
        </View>
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Password
          </Text>
          <TextInput
            autoComplete="password"
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={{ color: "#0f172a" }}
            value={password}
          />
        </View>
        {error && <Text className="text-sm text-rose-600">{error}</Text>}
        <Button busy={busy} onPress={handleLogin}>
          Sign in
        </Button>
        <Pressable className="py-2" onPress={() => router.push("/signup")}>
          <Text className="text-center text-sm font-bold text-emerald-700">
            Create an account
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
