import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, TextInput, View } from "react-native";

import {
    getCurrentUser,
    updateAccountCredentials,
} from "@/../services/authService";
import { updateAccountProfile } from "@/../services/companyService";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

function formatName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** Provides profile and security updates separate from the Account overview. */
export default function ProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    const user = getCurrentUser();
    if (!user) return router.replace("/login" as never);
    setDisplayName(user.displayName || "");
    setEmail(user.email || "");
  }, []);

  useFocusEffect(loadProfile);

  async function saveProfile() {
    const name = formatName(displayName);
    if (!name) return setError("Enter a name for your company profile.");
    if (newPassword && newPassword.length < 6) {
      return setError("Your new password must be at least 6 characters.");
    }
    if (newPassword !== confirmPassword) {
      return setError("New passwords do not match.");
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateAccountCredentials({
        currentPassword,
        email,
        password: newPassword,
      });
      await updateAccountProfile(name);
      setDisplayName(name);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        "Profile saved. Check your new email inbox for verification if you changed it.",
      );
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Unable to save profile changes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow="Account"
      title="Profile and security"
      description="Update your name, email address, or password. Sensitive changes require your current password."
    >
      <View className="max-w-2xl gap-5 rounded-2xl border border-[#d9d4ca] bg-[#fffdf8] p-5 shadow-sm md:p-8">
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Name
          </Text>
          <TextInput
            autoCapitalize="words"
            autoComplete="name"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#64748b"
            style={{ color: "#0f172a" }}
            value={displayName}
          />
        </View>
        <View className="border-t border-slate-100 pt-5">
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Email
          </Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#64748b"
            style={{ color: "#0f172a" }}
            value={email}
          />
        </View>
        <View className="gap-3 border-t border-slate-100 pt-5">
          <Text className="text-sm font-semibold text-slate-700">
            Change password
          </Text>
          <TextInput
            autoComplete="current-password"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setCurrentPassword}
            placeholder="Current password for email or password changes"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={{ color: "#0f172a" }}
            value={currentPassword}
          />
          <TextInput
            autoComplete="new-password"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={{ color: "#0f172a" }}
            value={newPassword}
          />
          <TextInput
            autoComplete="new-password"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={{ color: "#0f172a" }}
            value={confirmPassword}
          />
        </View>
        {error && <Text className="text-sm text-rose-600">{error}</Text>}
        {message && <Text className="text-sm text-emerald-700">{message}</Text>}
        <Button busy={busy} onPress={saveProfile}>
          Save changes
        </Button>
        <Button
          onPress={() => router.replace("/account" as never)}
          variant="secondary"
        >
          Back to account
        </Button>
      </View>
    </Screen>
  );
}
