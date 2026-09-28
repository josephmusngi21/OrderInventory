import { Text, View } from "react-native";

type AuditEvent = {
  id: string;
  action: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorId?: string | null;
  createdAt?: { toDate?: () => Date } | Date | string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
};

type AuditLogListProps = {
  events: AuditEvent[];
};

function formatDate(value: AuditEvent["createdAt"]) {
  if (!value) return "Pending timestamp";
  const date =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Pending timestamp"
    : date.toLocaleString();
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    companyCreated: "Company created",
    joinAttempt: "Join code checked",
    joinSuccess: "Joined company",
    joinCodeGenerated: "Join code generated",
    joinCodeRevoked: "Join code revoked",
    memberRemoved: "Member removed",
    companySettingsUpdated: "Company settings updated",
    inventorySubmittedForApproval: "Inventory submitted for approval",
    inventoryApproved: "Inventory approved",
    inventoryRejected: "Inventory rejected",
    inventoryVersionSaved: "Inventory version saved",
    inventoryAutoApproved: "Inventory auto-approved",
  };
  return labels[action] || action.replace(/([A-Z])/g, " $1").trim();
}

function formatActor(name?: string | null, email?: string | null) {
  return name || email?.split("@")[0] || "System";
}

/** Displays audit events with readable action, actor, timestamp, and metadata. */
export function AuditLogList({ events }: AuditLogListProps) {
  if (events.length === 0) {
    return (
      <View className="rounded-3xl border border-slate-200 bg-white px-6 py-12">
        <Text className="text-center text-base font-semibold text-slate-900">
          No events found
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Activity will appear here as your team works.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {events.map((event) => (
        <View
          key={event.id}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-2">
              <View
                className={`h-2.5 w-2.5 rounded-full ${event.success === false ? "bg-rose-500" : "bg-emerald-500"}`}
              />
              <Text className="text-sm font-bold text-slate-900">
                {formatAction(event.action)}
              </Text>
            </View>
            <Text className="text-xs text-slate-500">
              {formatDate(event.createdAt)}
            </Text>
          </View>
          <Text className="mt-2 text-sm text-slate-600">
            {formatActor(event.actorName, event.actorEmail)}
          </Text>
          {event.actorName && event.actorEmail && (
            <Text className="mt-1 text-xs text-slate-500">
              {event.actorEmail}
            </Text>
          )}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <Text className="mt-2 text-xs leading-5 text-slate-500">
              {Object.entries(event.metadata)
                .filter(([key]) => !key.toLowerCase().endsWith("id"))
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join("  |  ")}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
