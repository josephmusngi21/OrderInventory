import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { getCurrentUser, getUserAccess } from "@/../services/authService";
import { getInventoryVersions } from "@/../services/inventoryService";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";

type InventoryVersion = {
  id: string;
  createdBy?: string;
  createdAt?: any;
  rowCount?: number;
  creatorName?: string;
  creatorEmail?: string;
  submittedBy?: string;
  submittedAt?: any;
  reviewedBy?: string;
  reviewedAt?: any;
  submitterName?: string;
  submitterEmail?: string;
  reviewerName?: string;
  reviewerEmail?: string;
  isBaseline?: boolean;
  changeSummary?: { added: number; removed: number; edited: number };
  changes?: {
    type: "added" | "removed" | "edited";
    itemCode: string;
    name?: string;
    fields?: { field: string; before: string; after: string }[];
    requiredDetails?: { label: string; value: string }[];
  }[];
};

function formatCreator(name?: string, email?: string) {
  return name || email?.split("@")[0] || "Team member";
}

function formatDate(value: any) {
  if (!value) return "Pending timestamp";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Pending timestamp"
    : date.toLocaleString();
}

function formatChangeIdentity(
  change: NonNullable<InventoryVersion["changes"]>[number],
) {
  if (change.requiredDetails?.length) {
    return change.requiredDetails
      .map((detail) => `${detail.label}: ${detail.value}`)
      .join(" | ");
  }
  return change.name || change.itemCode;
}

/** Lists immutable saved inventory versions for later review. */
export default function HistoryPage() {
  const { companyId } = useLocalSearchParams<{ companyId?: string }>();
  const [activeCompanyId, setActiveCompanyId] = useState<string | undefined>(
    companyId,
  );
  const [versions, setVersions] = useState<InventoryVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  async function loadVersions() {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      setVersions(
        (await getInventoryVersions(activeCompanyId)) as InventoryVersion[],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load inventory history.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVersions();
  }, [activeCompanyId]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }
    getUserAccess(user.uid)
      .then((access) => {
        const nextCompanyId = companyId || access?.companyId;
        setActiveCompanyId(nextCompanyId);
        if (!nextCompanyId) setLoading(false);
      })
      .catch((accessError) => {
        setError(
          accessError instanceof Error
            ? accessError.message
            : "Unable to load company context.",
        );
        setLoading(false);
      });
  }, [companyId]);

  const isInitialLoading = loading && versions.length === 0;

  return (
    <RoleGuard role="member">
      <Screen
        eyebrow="Inventory history"
        title="Review earlier versions"
        description="Saved snapshots make it easy to double-check inventory changes later."
      >
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-950">
              Saved versions
            </Text>
            <Button busy={loading} variant="secondary" onPress={loadVersions}>
              Refresh
            </Button>
          </View>
          {error && <Text className="text-sm text-rose-600">{error}</Text>}
          {isInitialLoading &&
            [0, 1, 2].map((index) => (
              <View
                key={index}
                className="gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-9 w-28" />
              </View>
            ))}
          {!isInitialLoading && versions.length === 0 && (
            <Text className="rounded-2xl bg-white p-5 text-sm text-slate-500">
              No saved versions yet. Save inventory changes to create the first
              snapshot.
            </Text>
          )}
          {!isInitialLoading &&
            versions.map((version, index) => (
              <View
                key={version.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <Text className="text-base font-bold text-slate-950">
                  Version {versions.length - index}
                </Text>
                <Text className="mt-1 text-sm text-slate-600">
                  {version.rowCount || 0} rows · saved by{" "}
                  {formatCreator(version.creatorName, version.creatorEmail)}
                </Text>
                {version.creatorName && version.creatorEmail && (
                  <Text className="mt-1 text-xs text-slate-500">
                    {version.creatorEmail}
                  </Text>
                )}
                <Text className="mt-1 text-xs text-slate-500">
                  {formatDate(version.createdAt)}
                </Text>
                {version.submittedBy && (
                  <View className="mt-3 gap-1 border-t border-slate-100 pt-3">
                    <Text className="text-sm font-semibold text-slate-700">
                      Submitted for review by{" "}
                      {formatCreator(
                        version.submitterName,
                        version.submitterEmail,
                      )}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {formatDate(version.submittedAt)}
                    </Text>
                    {version.reviewedBy && (
                      <>
                        <Text className="mt-1 text-sm font-semibold text-slate-700">
                          Approved by{" "}
                          {formatCreator(
                            version.reviewerName,
                            version.reviewerEmail,
                          )}
                        </Text>
                        <Text className="text-xs text-slate-500">
                          {formatDate(version.reviewedAt)}
                        </Text>
                      </>
                    )}
                  </View>
                )}
                {version.isBaseline ? (
                  <Text className="mt-3 text-sm font-semibold text-slate-700">
                    Baseline inventory
                  </Text>
                ) : (
                  version.changeSummary && (
                    <Text className="mt-3 text-sm font-semibold text-slate-700">
                      +{version.changeSummary.added} added · -
                      {version.changeSummary.removed} removed · /
                      {version.changeSummary.edited} edited
                    </Text>
                  )
                )}
                {!version.isBaseline && (
                  <Pressable
                    className="mt-3 self-start rounded-md border border-[#bcccdc] bg-[#fffdf8] px-3 py-2 active:bg-[#e8e2d7]"
                    onPress={() =>
                      setExpandedVersionId((current) =>
                        current === version.id ? null : version.id,
                      )
                    }
                  >
                    <Text className="text-xs font-bold text-[#102a43]">
                      {expandedVersionId === version.id
                        ? "Hide changes"
                        : "View changes"}
                    </Text>
                  </Pressable>
                )}
                {!version.isBaseline && expandedVersionId === version.id && (
                  <View className="mt-3 gap-2 border-t border-slate-100 pt-3">
                    {(version.changes || []).length === 0 ? (
                      <Text className="text-sm text-slate-500">
                        No item-level changes from the previous version.
                      </Text>
                    ) : (
                      version.changes?.map((change) => (
                        <View key={`${change.type}-${change.itemCode}`}>
                          <Text
                            className={`text-sm ${change.type === "added" ? "text-emerald-700" : change.type === "removed" ? "text-rose-700" : "text-[#52606d]"}`}
                          >
                            {change.type === "added"
                              ? "+"
                              : change.type === "removed"
                                ? "-"
                                : "/"}{" "}
                            {formatChangeIdentity(change)}
                          </Text>
                          {change.type === "edited" &&
                            change.fields?.map((field) => (
                              <Text
                                key={field.field}
                                className="ml-4 mt-1 text-xs text-slate-500"
                              >
                                {field.field}: {field.before} to {field.after}
                              </Text>
                            ))}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))}
        </View>
      </Screen>
    </RoleGuard>
  );
}
