import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { router } from "expo-router";
import { Text, View } from "react-native";

/** Displays the app's terms entry point for store review and users. */
export default function TermsPage() {
  return (
    <Screen
      eyebrow="Legal"
      title="Terms of service"
      description="Use OrderInventory only for authorized company inventory work."
    >
      <View className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6">
        <Text className="text-sm leading-6 text-slate-700">
          Users are responsible for protecting their account credentials,
          sharing company join codes only with approved people, and submitting
          accurate inventory data. Company administrators control access and may
          remove members. Service availability and email delivery may depend on
          Firebase and configured providers.
        </Text>
      </View>
      <View className="max-w-2xl">
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
