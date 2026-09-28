import { router } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { getCurrentUser } from "@/../services/authService";
import { createCompany } from "@/../services/companyService";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

/** Provides the admin join-code surface after account creation. */
export default function CompanyCreatePage() {
  const [companyName, setCompanyName] = useState("");
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCompanyWithTimeout(name: string, userUid: string) {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        console.error("[company setup UI] timed out after 15 seconds");
        reject(
          new Error(
            "Company setup timed out. Check your connection and try again.",
          ),
        );
      }, 15000);
    });

    try {
      return await Promise.race([
        createCompany(name, userUid, getCurrentUser()?.displayName || ""),
        timeout,
      ]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  async function handleCreateCompany() {
    const user = getCurrentUser();
    if (!user) {
      setError("Sign in before creating a company workspace.");
      return;
    }

    setBusy(true);
    setError(null);
    console.log("[company setup UI] create button pressed");
    try {
      const result = await createCompanyWithTimeout(companyName, user.uid);
      setCompanyId(result.companyId);
      setJoinCode(result.joinCode.code);
      console.log(
        `[company setup UI] succeeded - companyId=${result.companyId}`,
      );
    } catch (createError) {
      console.error("[company setup UI] failed", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to generate a join code.",
      );
    } finally {
      setBusy(false);
    }
  }

  function continueToInventory() {
    if (companyId) {
      router.replace({ pathname: "/inventory", params: { companyId } });
    }
  }

  return (
    <Screen
      eyebrow="Administrator setup"
      title="Create your company"
      description="Set the workspace name, then generate an invite code for your team."
    >
      <View className="max-w-2xl gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">
            Company name
          </Text>
          <TextInput
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950"
            onChangeText={setCompanyName}
            placeholder="Northstar Supply Co."
            placeholderTextColor="#64748b"
            style={{ color: "#0f172a" }}
            value={companyName}
          />
        </View>
        <View className="rounded-2xl bg-emerald-50 p-4">
          <Text className="text-sm font-bold text-emerald-950">
            Invite code
          </Text>
          <Text className="mt-1 text-sm leading-5 text-emerald-800">
            Warning: the code expires in one minute. Share it only with an
            approved teammate who is ready to join now.
          </Text>
          {joinCode && (
            <Text className="mt-4 text-2xl font-bold tracking-[4px] text-emerald-950">
              {joinCode}
            </Text>
          )}
        </View>
        <View className="gap-3 sm:flex-row">
          <View className="flex-1">
            <Button
              busy={busy}
              onPress={handleCreateCompany}
              disabled={Boolean(companyId)}
            >
              {joinCode ? "Company created" : "Create company"}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="secondary"
              onPress={continueToInventory}
              disabled={!companyId}
            >
              Continue to inventory
            </Button>
          </View>
        </View>
        {error && <Text className="text-sm text-rose-600">{error}</Text>}
      </View>
    </Screen>
  );
}
