import { router, useFocusEffect, useNavigation } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentUser, getUserAccess } from "@/../services/authService";
import {
    generateJoinCode,
    getCompanyMembers,
    removeCompanyMember,
} from "@/../services/companyService";
import {
    getPendingInventoryApprovals,
    reviewInventoryApproval,
} from "@/../services/inventoryService";
import { InventoryRow, InventoryTable } from "@/components/inventory-table";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";

type Member = {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  status?: string;
};

type Approval = {
  id: string;
  submittedBy?: string;
  submitterName?: string;
  submitterEmail?: string;
  rowCount?: number;
  submittedAt?: any;
  rows?: InventoryRow[];
  columns?: { label: string; field: string }[];
  changeSummary?: { added: number; removed: number; edited: number };
  changes?: {
    type: "added" | "removed" | "edited";
    itemCode: string;
    row?: InventoryRow;
  }[];
};

function formatSubmitter(approval: Approval) {
  return (
    approval.submitterName ||
    approval.submitterEmail?.split("@")[0] ||
    "company member"
  );
}

/** Provides administrator controls for members, invite codes, and inventory approvals. */
export default function AdminPage() {
  const navigation = useNavigation();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [previewApproval, setPreviewApproval] = useState<Approval | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const refreshAdminData = useCallback(async () => {
    const user = getCurrentUser();
    if (!user) return setError("Sign in as an administrator to continue.");
    setBusy(true);
    setError(null);
    try {
      const access = await getUserAccess(user.uid);
      if (!access?.companyId) {
        throw new Error("Your account is not connected to a company.");
      }
      setCompanyId(access.companyId);
      const [membersResult, approvalsResult] = await Promise.allSettled([
        getCompanyMembers(access.companyId),
        getPendingInventoryApprovals(access.companyId) as Promise<Approval[]>,
      ]);
      if (membersResult.status === "rejected") throw membersResult.reason;
      setMembers(membersResult.value as Member[]);
      setApprovals(
        approvalsResult.status === "fulfilled" ? approvalsResult.value : [],
      );
    } catch (adminError) {
      setError(
        adminError instanceof Error
          ? adminError.message
          : "Unable to load administrator data.",
      );
    } finally {
      setBusy(false);
      setHasLoaded(true);
    }
  }, []);

  async function handleGenerateJoinCode() {
    const user = getCurrentUser();
    if (!user) return setError("Sign in as an administrator to continue.");
    try {
      const code = await generateJoinCode(user.uid);
      setJoinCode(code.code);
    } catch (codeError) {
      setError(
        codeError instanceof Error
          ? codeError.message
          : "Unable to generate join code.",
      );
    }
  }

  async function handleReview(
    approvalId: string,
    decision: "approved" | "rejected",
  ) {
    if (!companyId) return;
    try {
      await reviewInventoryApproval(companyId, approvalId, decision);
      setPreviewApproval(null);
      setApprovals((current) =>
        current.filter((approval) => approval.id !== approvalId),
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to review inventory.",
      );
    }
  }

  function confirmReview(
    approval: Approval,
    decision: "approved" | "rejected",
  ) {
    const publish = decision === "approved";
    Alert.alert(
      publish ? "Approve inventory changes" : "Reject inventory changes",
      publish
        ? "Publish these proposed changes to the company inventory?"
        : "Reject this proposed inventory submission?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: publish ? "Approve and publish" : "Reject",
          style: publish ? "default" : "destructive",
          onPress: () => void handleReview(approval.id, decision),
        },
      ],
    );
  }

  async function handleRemove(member: Member) {
    if (!companyId || member.role === "admin") return;
    try {
      await removeCompanyMember(companyId, member.id);
      setMembers((current) =>
        current.filter((entry) => entry.id !== member.id),
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove member.",
      );
    }
  }

  useFocusEffect(
    useCallback(() => {
      void refreshAdminData();
    }, [refreshAdminData]),
  );

  useEffect(() => {
    if (!previewApproval) return;
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    ).catch(() => undefined);
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => undefined);
    };
  }, [navigation, previewApproval]);

  const activeMemberCount = members.filter(
    (member) => member.status === "active" || !member.status,
  ).length;
  const isInitialLoading = busy && !hasLoaded;

  if (previewApproval) {
    const changes = previewApproval.changes || [];
    const removedRows = changes
      .filter((change) => change.type === "removed")
      .map((change) => change.row)
      .filter((row): row is InventoryRow => Boolean(row));
    const rowChangeTypes = Object.fromEntries(
      changes.map((change) => [change.itemCode, change.type]),
    ) as Record<string, "added" | "removed" | "edited">;
    const changePriority = { added: 0, edited: 1, removed: 2 };
    const previewRows = [...(previewApproval.rows || []), ...removedRows].sort(
      (left, right) => {
        const leftType = rowChangeTypes[String(left.itemCode)];
        const rightType = rowChangeTypes[String(right.itemCode)];
        const leftPriority = leftType ? changePriority[leftType] : 3;
        const rightPriority = rightType ? changePriority[rightType] : 3;
        return leftPriority - rightPriority;
      },
    );

    return (
      <RoleGuard role="admin">
        <SafeAreaView
          className="flex-1 bg-[#f4f1ea]"
          edges={["top", "bottom", "left"]}
        >
          <View className="h-14 flex-row items-center justify-between border-b border-[#d9d4ca] px-4">
            <View>
              <Text className="text-base font-black text-[#102a43]">
                Proposed inventory changes
              </Text>
              <Text className="text-xs text-[#627d98]">
                Submitted by {formatSubmitter(previewApproval)}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityLabel="Reject proposed changes"
                className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 active:bg-rose-100"
                onPress={() => confirmReview(previewApproval, "rejected")}
              >
                <Text className="text-xs font-bold text-rose-700">Reject</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Approve and publish proposed changes"
                className="h-9 rounded-lg bg-[#102a43] px-3 active:bg-[#243b53]"
                onPress={() => confirmReview(previewApproval, "approved")}
              >
                <Text className="text-xs font-bold text-white">Approve</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Exit proposed changes"
                className="h-9 flex-row items-center gap-1 rounded-lg border border-[#bcccdc] bg-[#fffdf8] px-3 active:bg-[#e8e2d7]"
                onPress={() => setPreviewApproval(null)}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={16}
                  tintColor="#102a43"
                />
                <Text className="text-xs font-bold text-[#102a43]">Exit</Text>
              </Pressable>
            </View>
          </View>
          <View className="flex-row gap-4 border-b border-[#d9d4ca] px-4 py-2">
            <Text className="text-xs font-bold text-emerald-700">
              Green: added
            </Text>
            <Text className="text-xs font-bold text-rose-700">
              Red: removed
            </Text>
            <Text className="text-xs font-bold text-amber-800">
              Yellow: edited
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingRight: 12 }}>
            <InventoryTable
              columns={previewApproval.columns}
              fullBleed
              onChange={() => undefined}
              rowChangeTypes={rowChangeTypes}
              rows={previewRows}
              selectableRows={false}
            />
          </ScrollView>
        </SafeAreaView>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard role="admin">
      <Screen
        eyebrow="Administration"
        title="Company control room"
        description="Manage access, refresh your invite code, and review company activity."
      >
        {error && (
          <Text className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </Text>
        )}
        <View className="gap-4 md:flex-row">
          <View className="flex-1 rounded-2xl bg-[#102a43] p-5">
            <Text className="text-xs font-bold uppercase tracking-[2px] text-emerald-300">
              Current invite code
            </Text>
            <Text className="mt-4 text-3xl font-bold tracking-[4px] text-white">
              {joinCode || "--------"}
            </Text>
            <Text className="mt-3 text-sm leading-5 text-slate-300">
              Warning: this code expires in one minute. Share it only with an
              approved teammate who is ready to join now.
            </Text>
            <View className="mt-5">
              <Button busy={busy} onPress={handleGenerateJoinCode}>
                {joinCode ? "Regenerate code" : "Generate join code"}
              </Button>
            </View>
          </View>
          <View className="flex-1 rounded-2xl border border-[#d9d4ca] bg-[#fffdf8] p-5">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-lg font-bold text-slate-950">Members</Text>
              <View className="flex-row gap-2">
                <Pressable
                  accessibilityLabel={
                    membersExpanded ? "Collapse members" : "Expand members"
                  }
                  className="h-9 w-9 items-center justify-center rounded-lg border border-[#bcccdc] bg-[#fffdf8] active:bg-[#e8e2d7]"
                  onPress={() => setMembersExpanded((current) => !current)}
                >
                  <SymbolView
                    name={{
                      ios: membersExpanded ? "chevron.up" : "chevron.down",
                      android: membersExpanded ? "expand_less" : "expand_more",
                      web: membersExpanded ? "expand_less" : "expand_more",
                    }}
                    size={18}
                    tintColor="#102a43"
                  />
                </Pressable>
                <Button
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/settings" as never,
                      params: { companyId: companyId || "" },
                    })
                  }
                >
                  Settings
                </Button>
              </View>
            </View>
            {isInitialLoading ? (
              <Skeleton className="mt-2 h-4 w-32" />
            ) : (
              <Text className="mt-1 text-sm text-slate-500">
                {companyId
                  ? `${activeMemberCount} active ${activeMemberCount === 1 ? "member" : "members"}`
                  : "Company members unavailable"}
              </Text>
            )}
            {membersExpanded && (
              <View className="mt-4 gap-2 border-t border-[#d9d4ca] pt-3">
                {isInitialLoading &&
                  [0, 1].map((index) => (
                    <View key={index} className="gap-2 py-3">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-52" />
                    </View>
                  ))}
                {!isInitialLoading &&
                  members.map((member) => (
                    <View
                      key={member.id}
                      className="flex-row items-center justify-between gap-3 border-b border-slate-100 py-3"
                    >
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-sm font-semibold text-slate-900"
                          numberOfLines={1}
                        >
                          {member.displayName || member.email || member.id}
                        </Text>
                        <Text
                          className="mt-1 text-xs text-slate-600"
                          numberOfLines={1}
                        >
                          {member.email || "No email available"}
                        </Text>
                        <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-[#627d98]">
                          {member.role || "member"} ·{" "}
                          {member.status || "active"}
                        </Text>
                      </View>
                      {member.role !== "admin" &&
                        member.status === "active" && (
                          <Pressable
                            accessibilityLabel={`Remove ${member.displayName || member.email || "member"} from company`}
                            className="mt-3 h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-rose-50 active:bg-rose-100"
                            onPress={() =>
                              Alert.alert(
                                "Remove member",
                                `Remove ${member.email || member.id} from this company?`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Remove",
                                    style: "destructive",
                                    onPress: () => handleRemove(member),
                                  },
                                ],
                              )
                            }
                          >
                            <SymbolView
                              name={{
                                ios: "person.crop.circle.badge.minus",
                                android: "person_remove",
                                web: "person_remove",
                              }}
                              size={16}
                              tintColor="#be123c"
                            />
                          </Pressable>
                        )}
                    </View>
                  ))}
              </View>
            )}
          </View>
        </View>
        <View className="gap-4">
          <Text className="text-lg font-bold text-slate-950">
            Inventory approvals
          </Text>
          <View className="gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            {isInitialLoading &&
              [0, 1].map((index) => (
                <View
                  key={index}
                  className="gap-3 border-b border-amber-200 pb-3"
                >
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-9 w-40" />
                </View>
              ))}
            {!isInitialLoading && approvals.length === 0 && (
              <Text className="text-sm text-amber-900">
                No inventory submissions are waiting for review.
              </Text>
            )}
            {!isInitialLoading &&
              approvals.map((approval) => (
                <View
                  key={approval.id}
                  className="border-b border-amber-200 pb-3"
                >
                  <Text className="text-sm font-semibold text-amber-950">
                    {approval.rowCount || 0} rows submitted for review
                  </Text>
                  <Text className="mt-1 text-xs text-amber-800">
                    Submitted by {formatSubmitter(approval)}
                  </Text>
                  {approval.submitterName && approval.submitterEmail && (
                    <Text className="mt-1 text-xs text-amber-700">
                      {approval.submitterEmail}
                    </Text>
                  )}
                  {approval.changeSummary && (
                    <Text className="mt-2 text-xs font-semibold text-amber-900">
                      +{approval.changeSummary.added} added · -
                      {approval.changeSummary.removed} removed · /
                      {approval.changeSummary.edited} edited
                    </Text>
                  )}
                  <Pressable
                    className="mt-3 self-start rounded-md border border-amber-300 bg-white px-3 py-2 active:bg-amber-100"
                    onPress={() => setPreviewApproval(approval)}
                  >
                    <Text className="text-xs font-bold text-amber-950">
                      View proposed changes
                    </Text>
                  </Pressable>
                  <View className="mt-3 flex-row gap-2">
                    <Button onPress={() => confirmReview(approval, "approved")}>
                      Approve and publish
                    </Button>
                    <Button
                      variant="danger"
                      onPress={() => confirmReview(approval, "rejected")}
                    >
                      Reject
                    </Button>
                  </View>
                </View>
              ))}
          </View>
        </View>
      </Screen>
    </RoleGuard>
  );
}
