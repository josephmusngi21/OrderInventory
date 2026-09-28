import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { signup } from "@/../services/authService";
import { validateJoinCode } from "@/../services/companyService";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

type SignupMode = "create" | "join";

/** Provides account creation and the create-or-join company choice. */
export default function SignupPage() {
  const [mode, setMode] = useState<SignupMode>("join");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validateForm() {
    if (!email.trim()) return "Enter your email address.";
    if (!displayName.trim()) return "Enter a name for your company profile.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    if (mode === "join" && !code.trim()) return "Enter your company code.";
    return null;
  }

  async function withTimeout<T>(operation: Promise<T>) {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              "The request timed out. Check your connection and try again.",
            ),
          ),
        15000,
      );
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  async function handleSignup() {
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const credentials = await withTimeout(
        signup(email, password, displayName),
      );
      const joinDetails =
        mode === "join"
          ? await withTimeout(validateJoinCode(code, displayName))
          : null;

      if (joinDetails) {
        if (!joinDetails.joinCodeId) {
          throw new Error(
            "The validated company code is missing its identifier.",
          );
        }
        router.replace({
          pathname: "/inventory",
          params: { companyId: joinDetails.companyId },
        });
      } else {
        router.replace("/company-create");
      }
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Unable to create your account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow="New workspace"
      title="Set up your account"
      description="Choose whether you are starting a company workspace or joining one with an invite code."
    >
      <View className="max-w-xl gap-5 rounded-2xl border border-[#d9d4ca] bg-[#fffdf8] p-5 shadow-sm md:p-8">
        <View className="flex-row gap-2 rounded-2xl bg-slate-100 p-1">
          {(["create", "join"] as SignupMode[]).map((option) => (
            <Pressable
              key={option}
              style={[
                styles.modeOption,
                mode === option && styles.modeOptionActive,
              ]}
              onPress={() => setMode(option)}
            >
              <Text
                className={`text-center text-sm font-bold ${mode === option ? "text-emerald-800" : "text-slate-500"}`}
              >
                {option === "create" ? "Create a company" : "Join a company"}
              </Text>
            </Pressable>
          ))}
        </View>
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Name
          </Text>
          <TextInput
            autoCapitalize="words"
            autoComplete="name"
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#64748b"
            style={{ color: "#0f172a" }}
            value={displayName}
          />
        </View>
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
            autoComplete="new-password"
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor="#64748b"
            secureTextEntry={!showPassword}
            style={{ color: "#0f172a" }}
            value={password}
          />
        </View>
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Confirm password
          </Text>
          <TextInput
            autoComplete="new-password"
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setConfirmPassword}
            placeholder="Enter your password again"
            placeholderTextColor="#64748b"
            secureTextEntry={!showPassword}
            style={{ color: "#0f172a" }}
            value={confirmPassword}
          />
          <Pressable
            className="mt-2 self-start py-1"
            onPress={() => setShowPassword((current) => !current)}
          >
            <Text className="text-sm font-bold text-emerald-700">
              {showPassword ? "Hide passwords" : "Show passwords"}
            </Text>
          </Pressable>
        </View>
        {mode === "join" && (
          <View>
            <Text className="mb-2 text-sm font-semibold text-slate-700">
              Company code
            </Text>
            <TextInput
              autoCapitalize="characters"
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base uppercase text-slate-950"
              onChangeText={setCode}
              placeholder="Enter your invite code"
              placeholderTextColor="#64748b"
              style={{ color: "#0f172a" }}
              value={code}
            />
          </View>
        )}
        {mode === "create" && (
          <Text className="text-sm leading-5 text-slate-500">
            After signup, continue to the company setup screen to finish your
            administrator workspace.
          </Text>
        )}
        {error && <Text className="text-sm text-rose-600">{error}</Text>}
        <Button busy={busy} onPress={handleSignup}>
          Create account
        </Button>
        <Pressable className="py-2" onPress={() => router.push("/login")}>
          <Text className="text-center text-sm font-bold text-emerald-700">
            Already have an account? Sign in
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeOption: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modeOptionActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
