import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { getHistory } from "@/../services/auditService";
import { getCurrentUser, getUserAccess } from "@/../services/authService";
import { getCompanyMembers } from "@/../services/companyService";
import { AuditLogList } from "@/components/audit-log-list";
import { RoleGuard } from "@/components/role-guard";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";

type AuditEvent = {
  id: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  createdAt?: any;
  metadata?: Record<string, unknown>;
  success?: boolean;
};

type Member = { id: string; displayName?: string; email?: string };

function formatActor(name?: string | null, email?: string | null) {
  return name || email?.split("@")[0] || "Unknown member";
}

function formatAction(action: string) {
  return action.replace(/([A-Z])/g, " $1").trim();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Provides searchable administrator audit history. */
export default function AuditPage() {
  const { companyId } = useLocalSearchParams<{ companyId?: string }>();
  const [activeCompanyId, setActiveCompanyId] = useState<string | undefined>(
    companyId,
  );
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMenu, setFilterMenu] = useState<"user" | "action" | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadHistory() {
    if (!activeCompanyId || !getCurrentUser()) return;
    setRefreshing(true);
    try {
      const [nextEvents, nextMembers] = await Promise.all([
        getHistory(activeCompanyId) as Promise<AuditEvent[]>,
        getCompanyMembers(activeCompanyId) as Promise<Member[]>,
      ]);
      setEvents(nextEvents);
      setMembers(nextMembers);
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Unable to load audit history.",
      );
    } finally {
      setRefreshing(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [activeCompanyId]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    getUserAccess(user.uid)
      .then((access) => setActiveCompanyId(companyId || access?.companyId))
      .catch((accessError) =>
        setError(
          accessError instanceof Error
            ? accessError.message
            : "Unable to load company context.",
        ),
      );
  }, [companyId]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const actorMatches = !userFilter || event.actorId === userFilter;
        const actionMatches = !actionFilter || event.action === actionFilter;
        const dateMatches =
          !dateFilter ||
          formatDateKey(new Date(event.createdAt || 0)) ===
            formatDateKey(dateFilter);
        return actorMatches && actionMatches && dateMatches;
      }),
    [actionFilter, dateFilter, events, userFilter],
  );

  const actionOptions = useMemo(
    () => [...new Set(events.map((event) => event.action))].sort(),
    [events],
  );
  const selectedMember = members.find((member) => member.id === userFilter);
  const activeFilterCount = [userFilter, actionFilter, dateFilter].filter(
    Boolean,
  ).length;

  function clearFilters() {
    setUserFilter("");
    setActionFilter("");
    setDateFilter(null);
    setFilterMenu(null);
    setDatePickerOpen(false);
  }

  return (
    <RoleGuard role="admin">
      <Screen
        eyebrow="Audit history"
        title="See what changed"
        description="Filter company activity by person, action, or date to understand every important inventory event."
      >
        <View className="gap-3 rounded-xl border border-[#d9d4ca] bg-[#fffdf8] p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-[#102a43]">Filters</Text>
              {activeFilterCount > 0 && (
                <Text className="mt-1 text-xs font-semibold text-[#0f766e]">
                  {activeFilterCount} active
                </Text>
              )}
            </View>
            <View className="flex-row gap-2">
              <Pressable
                accessibilityLabel={
                  filtersOpen ? "Collapse filters" : "Expand filters"
                }
                className="h-9 flex-row items-center gap-1 rounded-lg border border-[#bcccdc] bg-white px-3 active:bg-[#e8e2d7]"
                onPress={() => {
                  setFiltersOpen((current) => !current);
                  setFilterMenu(null);
                  setDatePickerOpen(false);
                }}
              >
                <SymbolView
                  name={{
                    ios: "line.3.horizontal.decrease.circle",
                    android: "filter_list",
                    web: "filter_list",
                  }}
                  size={16}
                  tintColor="#102a43"
                />
                <Text className="text-xs font-bold text-[#102a43]">
                  {filtersOpen ? "Close" : "Filter"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Refresh audit activity"
                className={`h-9 w-9 items-center justify-center rounded-lg border border-[#bcccdc] bg-white active:bg-[#e8e2d7] ${refreshing ? "opacity-50" : ""}`}
                disabled={refreshing}
                onPress={loadHistory}
              >
                <SymbolView
                  name={{
                    ios: "arrow.clockwise",
                    android: "refresh",
                    web: "refresh",
                  }}
                  size={17}
                  tintColor="#102a43"
                />
              </Pressable>
            </View>
          </View>
          {filtersOpen && (
            <View className="gap-3 border-t border-[#d9d4ca] pt-3">
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  className={`h-11 min-w-[160px] flex-1 flex-row items-center justify-between rounded-lg border px-3 active:bg-[#e8e2d7] ${dateFilter ? "border-[#0f766e] bg-[#dcefe8]" : "border-[#bcccdc] bg-white"}`}
                  onPress={() => {
                    setFilterMenu((current) =>
                      current === "user" ? null : "user",
                    );
                    setDatePickerOpen(false);
                  }}
                >
                  <Text
                    className="text-sm font-semibold text-[#102a43]"
                    numberOfLines={1}
                  >
                    {selectedMember
                      ? formatActor(
                          selectedMember.displayName,
                          selectedMember.email,
                        )
                      : "All members"}
                  </Text>
                  <SymbolView
                    name={{
                      ios: "chevron.down",
                      android: "arrow_drop_down",
                      web: "arrow_drop_down",
                    }}
                    size={18}
                    tintColor="#52606d"
                  />
                </Pressable>
                <Pressable
                  className="h-11 min-w-[160px] flex-1 flex-row items-center justify-between rounded-lg border border-[#bcccdc] bg-white px-3 active:bg-[#e8e2d7]"
                  onPress={() => {
                    setFilterMenu((current) =>
                      current === "action" ? null : "action",
                    );
                    setDatePickerOpen(false);
                  }}
                >
                  <Text
                    className="text-sm font-semibold text-[#102a43]"
                    numberOfLines={1}
                  >
                    {actionFilter ? formatAction(actionFilter) : "All actions"}
                  </Text>
                  <SymbolView
                    name={{
                      ios: "chevron.down",
                      android: "arrow_drop_down",
                      web: "arrow_drop_down",
                    }}
                    size={18}
                    tintColor="#52606d"
                  />
                </Pressable>
                <Pressable
                  className="h-11 min-w-[160px] flex-1 flex-row items-center justify-between rounded-lg border border-[#bcccdc] bg-white px-3 active:bg-[#e8e2d7]"
                  onPress={() => {
                    setDatePickerOpen((current) => !current);
                    setFilterMenu(null);
                  }}
                >
                  <Text className="text-sm font-semibold text-slate-700">
                    {dateFilter
                      ? dateFilter.toLocaleDateString()
                      : "Choose date"}
                  </Text>
                  <SymbolView
                    name={{
                      ios: "calendar",
                      android: "calendar_today",
                      web: "calendar_today",
                    }}
                    size={16}
                    tintColor="#52606d"
                  />
                </Pressable>
              </View>
              {filterMenu === "user" && (
                <ScrollView className="max-h-52 rounded-lg border border-[#bcccdc] bg-white">
                  <Pressable
                    className="border-b border-slate-100 px-3 py-3 active:bg-[#dcefe8]"
                    onPress={() => {
                      setUserFilter("");
                      setFilterMenu(null);
                    }}
                  >
                    <Text className="text-sm font-semibold text-[#102a43]">
                      All members
                    </Text>
                  </Pressable>
                  {members.map((member) => (
                    <Pressable
                      key={member.id}
                      className="border-b border-slate-100 px-3 py-3 active:bg-[#dcefe8]"
                      onPress={() => {
                        setUserFilter(member.id);
                        setFilterMenu(null);
                      }}
                    >
                      <Text className="text-sm font-semibold text-[#102a43]">
                        {formatActor(member.displayName, member.email)}
                      </Text>
                      {member.email && (
                        <Text className="mt-1 text-xs text-[#627d98]">
                          {member.email}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {filterMenu === "action" && (
                <ScrollView className="max-h-52 rounded-lg border border-[#bcccdc] bg-white">
                  <Pressable
                    className="border-b border-slate-100 px-3 py-3 active:bg-[#dcefe8]"
                    onPress={() => {
                      setActionFilter("");
                      setFilterMenu(null);
                    }}
                  >
                    <Text className="text-sm font-semibold text-[#102a43]">
                      All actions
                    </Text>
                  </Pressable>
                  {actionOptions.map((action) => (
                    <Pressable
                      key={action}
                      className="border-b border-slate-100 px-3 py-3 active:bg-[#dcefe8]"
                      onPress={() => {
                        setActionFilter(action);
                        setFilterMenu(null);
                      }}
                    >
                      <Text className="text-sm font-semibold text-[#102a43]">
                        {formatAction(action)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {datePickerOpen && (
                <View className="w-full max-w-[320px] self-center gap-2 rounded-xl border-2 border-[#829ab1] bg-white p-3 shadow-sm">
                  <View className="flex-row items-center justify-between border-b border-slate-100 pb-2">
                    <View>
                      <Text className="text-sm font-bold text-[#102a43]">
                        Filter by date
                      </Text>
                      <Text className="mt-1 text-xs text-[#627d98]">
                        {dateFilter
                          ? dateFilter.toLocaleDateString()
                          : "Select a day to show its activity"}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Close calendar"
                      className="h-8 w-8 items-center justify-center rounded-md border border-[#bcccdc] bg-[#fffdf8] active:bg-[#e8e2d7]"
                      onPress={() => setDatePickerOpen(false)}
                    >
                      <SymbolView
                        name={{ ios: "xmark", android: "close", web: "close" }}
                        size={16}
                        tintColor="#102a43"
                      />
                    </Pressable>
                  </View>
                  <DateTimePicker
                    accentColor="#0f766e"
                    display={Platform.OS === "ios" ? "inline" : "calendar"}
                    onChange={(_, selectedDate) => {
                      if (Platform.OS !== "ios") setDatePickerOpen(false);
                      if (selectedDate) setDateFilter(selectedDate);
                    }}
                    textColor="#102a43"
                    themeVariant="light"
                    value={dateFilter || new Date()}
                    style={{ alignSelf: "center", maxWidth: 296 }}
                  />
                </View>
              )}
              {activeFilterCount > 0 && (
                <Pressable
                  className="self-start px-1 py-2"
                  onPress={clearFilters}
                >
                  <Text className="text-xs font-bold text-[#52606d]">
                    Clear all filters
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
        {error && <Text className="text-sm text-rose-600">{error}</Text>}
        {refreshing && !hasLoaded ? (
          <View accessibilityLabel="Loading audit activity" className="gap-3">
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                className="gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </View>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </View>
            ))}
          </View>
        ) : (
          <AuditLogList events={filteredEvents} />
        )}
      </Screen>
    </RoleGuard>
  );
}
