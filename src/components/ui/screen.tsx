import { PropsWithChildren, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentUser, getUserAccess } from "@/../services/authService";
import { getCompanySettings } from "@/../services/companyService";

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
  scroll?: boolean;
}>;

/** Provides the shared page frame used by the application screens. */
export function Screen({
  eyebrow,
  title,
  description,
  scroll = true,
  children,
}: ScreenProps) {
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setCompanyName("");
      return;
    }
    getUserAccess(user.uid)
      .then((access) => {
        if (!access?.companyId) return setCompanyName("");
        return getCompanySettings(access.companyId).then((settings) =>
          setCompanyName(
            String((settings as { companyName?: string }).companyName || ""),
          ),
        );
      })
      .catch(() => setCompanyName(""));
  }, []);

  const workspaceLabel = companyName
    ? `${companyName.slice(0, 28)} workspace`
    : "Company workspace";

  const content = (
    <View className="mx-auto w-full max-w-7xl gap-7 px-5 py-6 md:px-10 md:py-10">
      <View className="flex-row items-center justify-between border-b border-[#d9d4ca] pb-5">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#102a43]">
            <Text className="text-sm font-black text-[#f4f1ea]">OI</Text>
          </View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-[#52606d]">
            OrderInventory
          </Text>
        </View>
        <Text
          className="max-w-[150px] text-right text-xs font-semibold uppercase tracking-wider text-[#829ab1] md:max-w-[260px]"
          numberOfLines={1}
        >
          {workspaceLabel}
        </Text>
      </View>
      <View className="max-w-4xl">
        {eyebrow && (
          <Text className="text-xs font-bold uppercase tracking-[2px] text-[#d95d39]">
            {eyebrow}
          </Text>
        )}
        <Text className="mt-2 text-3xl font-black tracking-tight text-[#102a43] md:text-5xl">
          {title}
        </Text>
        {description && (
          <Text className="mt-3 max-w-2xl text-base leading-6 text-[#52606d]">
            {description}
          </Text>
        )}
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#f4f1ea]">
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
