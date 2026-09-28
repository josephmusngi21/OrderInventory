import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { router } from "expo-router";
import { Text, View } from "react-native";

/** Displays the app's privacy notice entry point for store review and users. */
export default function PrivacyPage() {
  return (
    <Screen
      eyebrow="Legal"
      title="Privacy policy"
      description="OrderInventory uses Firebase Authentication and Firestore to provide company-scoped inventory services."
    >
      <View className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6">
        <Text className="text-sm leading-6 text-slate-700">
          Your account data is used to authenticate you and associate your
          activity with the company you join or create. Inventory and audit
          records are scoped to company membership. Contact the app owner to
          request access, correction, or deletion of your personal data.
        </Text>
        <Text className="mt-4 text-sm leading-6 text-slate-700">
          If a company administrator enables barcode scanning, OrderInventory
          requests camera access only when you choose to scan a barcode. Camera
          frames are used on-device to find an inventory item and are not
          recorded, uploaded, or shared by the app.
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
