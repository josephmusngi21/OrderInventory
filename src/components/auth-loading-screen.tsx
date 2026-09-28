import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthLoadingScreenProps = {
  title: string;
  description: string;
};

/** Keeps authentication transitions visually stable while Firebase updates the session. */
export function AuthLoadingScreen({
  title,
  description,
}: AuthLoadingScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-[#f4f1ea]">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-full max-w-sm items-center rounded-2xl border border-[#d9d4ca] bg-[#fffdf8] px-6 py-10 shadow-sm">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#102a43]">
            <Text className="text-base font-black text-[#f4f1ea]">OI</Text>
          </View>
          <ActivityIndicator className="mt-7" color="#0f766e" size="large" />
          <Text className="mt-6 text-xl font-black text-[#102a43]">
            {title}
          </Text>
          <Text className="mt-2 text-center text-sm leading-6 text-[#52606d]">
            {description}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
