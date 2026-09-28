import { router } from "expo-router";
import { Linking, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

const SUPPORT_EMAIL = "support@orderinventory.example";

/** Provides the account deletion request path required for account management. */
export default function AccountDeletePage() {
  async function requestDeletion() {
    const subject = encodeURIComponent(
      "OrderInventory account deletion request",
    );
    const body = encodeURIComponent(
      "Please delete my OrderInventory account and associated personal data.",
    );
    await Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
    );
  }

  return (
    <Screen
      eyebrow="Account"
      title="Request account deletion"
      description="Send a deletion request to the OrderInventory support team."
    >
      <View className="max-w-2xl gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Text className="text-sm leading-6 text-slate-700">
          Your request will be reviewed and handled according to the privacy
          policy and applicable retention requirements. Company administrators
          may need to transfer company-owned inventory before personal data is
          removed.
        </Text>
        <Button onPress={requestDeletion}>Email deletion request</Button>
        <Button
          variant="secondary"
          onPress={() => router.replace("/account" as never)}
        >
          Back to account
        </Button>
      </View>
    </Screen>
  );
}
