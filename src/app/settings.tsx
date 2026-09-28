import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import {
    getCurrentUser,
    getUserAccess,
    logout,
} from "@/../services/authService";
import {
    getCompanySettings,
    updateCompanySettings,
} from "@/../services/companyService";
import { getInventory } from "@/../services/inventoryService";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { DEFAULT_INVENTORY_COLUMNS } from "@/components/inventory-table";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";

/** Provides company-wide settings controlled by the administrator. */
export default function SettingsPage() {
  const { companyId } = useLocalSearchParams<{ companyId?: string }>();
  const [allowBarcodeScanning, setAllowBarcodeScanning] = useState(false);
  const [hasQuantityColumn, setHasQuantityColumn] = useState(false);
  const [quantityColumnName, setQuantityColumnName] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inventoryColumns, setInventoryColumns] = useState<
    { label: string; field: string }[]
  >([]);
  const [requiredColumnFields, setRequiredColumnFields] = useState<string[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const user = getCurrentUser();
    if (user)
      getUserAccess(user.uid)
        .then((access) => setIsAdmin(access?.role === "admin"))
        .catch(() => setIsAdmin(false));
    getCompanySettings(companyId)
      .then((settings) => {
        const savedQuantityColumn = String(
          (settings as { quantityColumnName?: string }).quantityColumnName ||
            "",
        );
        setAllowBarcodeScanning(
          Boolean(
            (settings as { allowBarcodeScanning?: boolean })
              .allowBarcodeScanning,
          ),
        );
        setQuantityColumnName(savedQuantityColumn);
        setHasQuantityColumn(Boolean(savedQuantityColumn));
        setDefaultLocation(
          String(
            (settings as { defaultLocation?: string }).defaultLocation || "",
          ),
        );
        setCompanyName(
          String((settings as { companyName?: string }).companyName || ""),
        );
        setRequiredColumnFields(
          Array.isArray(
            (settings as { requiredColumnFields?: unknown })
              .requiredColumnFields,
          )
            ? (settings as { requiredColumnFields: string[] })
                .requiredColumnFields
            : [],
        );
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Unable to load settings.",
        ),
      );
    getInventory(companyId)
      .then((inventory) => {
        const result = inventory as {
          columns?: { label: string; field: string }[];
        };
        setInventoryColumns(result.columns || DEFAULT_INVENTORY_COLUMNS);
      })
      .catch(() => setInventoryColumns(DEFAULT_INVENTORY_COLUMNS));
  }, [companyId]);

  async function saveSettings() {
    const user = getCurrentUser();
    if (!companyId || !user)
      return setMessage("An administrator session is required.");
    setBusy(true);
    setMessage(null);
    try {
      await updateCompanySettings(companyId, {
        allowBarcodeScanning,
        hasQuantityColumn,
        quantityColumnName,
        defaultLocation,
        requiredColumnFields,
      });
      setMessage("Company settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch (logoutError) {
      setSigningOut(false);
      setMessage(
        logoutError instanceof Error
          ? logoutError.message
          : "Unable to log out.",
      );
    }
  }

  function toggleRequiredColumn(field: string) {
    setRequiredColumnFields((current) =>
      current.includes(field)
        ? current.filter((currentField) => currentField !== field)
        : [...current, field],
    );
  }

  if (signingOut) {
    return (
      <AuthLoadingScreen
        title="Signing you out"
        description="Ending your secure session."
      />
    );
  }

  return (
    <RoleGuard role="member">
      <Screen
        eyebrow="Company settings"
        title="Tune the workspace"
        description="These settings apply to everyone working in this company."
      >
        <View className="max-w-2xl">
          <Button
            onPress={() => router.replace("/account" as never)}
            variant="secondary"
          >
            Back to account
          </Button>
        </View>
        <View className="max-w-2xl gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          {isAdmin && (
            <View className="flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-950">
                  Barcode scanning
                </Text>
                <Text className="mt-1 text-sm leading-5 text-slate-500">
                  Enable barcode workflows when imported inventory includes
                  barcode values.
                </Text>
              </View>
              <Switch
                onValueChange={setAllowBarcodeScanning}
                value={allowBarcodeScanning}
                trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                thumbColor={allowBarcodeScanning ? "#047857" : "#f8fafc"}
              />
            </View>
          )}
          {isAdmin && (
            <View className="gap-3 border-b border-slate-100 pb-5">
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-base font-bold text-slate-950">
                    Quantity column
                  </Text>
                  <Text className="mt-1 text-sm leading-5 text-slate-500">
                    Use the named Excel header for stock counts. When off, each
                    imported data row counts as one item.
                  </Text>
                </View>
                <Switch
                  onValueChange={setHasQuantityColumn}
                  value={hasQuantityColumn}
                  trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                  thumbColor={hasQuantityColumn ? "#047857" : "#f8fafc"}
                />
              </View>
              {hasQuantityColumn && (
                <TextInput
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950"
                  onChangeText={setQuantityColumnName}
                  placeholder="For example: Quantity, Stock on Hand"
                  placeholderTextColor="#64748b"
                  style={{ color: "#0f172a" }}
                  value={quantityColumnName}
                />
              )}
            </View>
          )}
          {isAdmin && (
            <View className="gap-3 border-b border-slate-100 pb-5">
              <View>
                <Text className="text-base font-bold text-slate-950">
                  Default location
                </Text>
                <Text className="mt-1 text-sm leading-5 text-slate-500">
                  Applied when an imported or barcode-added item has no
                  location.
                  {companyName ? ` Leave blank to use ${companyName}.` : ""}
                </Text>
              </View>
              <TextInput
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950"
                onChangeText={setDefaultLocation}
                placeholder={companyName || "Main warehouse"}
                placeholderTextColor="#64748b"
                style={{ color: "#0f172a" }}
                value={defaultLocation}
              />
            </View>
          )}
          {isAdmin && (
            <View className="gap-3 border-b border-slate-100 pb-5">
              <View>
                <Text className="text-base font-bold text-slate-950">
                  Required barcode-entry columns
                </Text>
                <Text className="mt-1 text-sm leading-5 text-slate-500">
                  Select the Excel columns a member must complete when adding a
                  new item by barcode. The scanned reference is always kept.
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {inventoryColumns
                  .filter((column) => column.field !== "itemCode")
                  .map((column) => {
                    const checked = requiredColumnFields.includes(column.field);
                    return (
                      <Pressable
                        key={column.field}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        className={`h-9 flex-row items-center gap-2 rounded-md border px-3 ${checked ? "border-[#102a43] bg-[#dcefe8]" : "border-[#d9d4ca] bg-white"}`}
                        onPress={() => toggleRequiredColumn(column.field)}
                      >
                        <SymbolView
                          name={{
                            ios: checked ? "checkmark.square.fill" : "square",
                            android: checked
                              ? "check_box"
                              : "check_box_outline_blank",
                            web: checked
                              ? "check_box"
                              : "check_box_outline_blank",
                          }}
                          size={17}
                          tintColor={checked ? "#102a43" : "#627d98"}
                        />
                        <Text className="text-xs font-semibold text-[#102a43]">
                          {column.label}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            </View>
          )}
          {isAdmin && (
            <Button busy={busy} onPress={saveSettings}>
              Save settings
            </Button>
          )}
          {message && <Text className="text-sm text-slate-600">{message}</Text>}
          <View className="gap-3 border-t border-slate-100 pt-5">
            <Text className="text-base font-bold text-slate-950">
              Account and legal
            </Text>
            <Button
              variant="secondary"
              onPress={() => router.push("/privacy" as never)}
            >
              Privacy policy
            </Button>
            <Button
              variant="secondary"
              onPress={() => router.push("/terms" as never)}
            >
              Terms of service
            </Button>
            <Button
              variant="secondary"
              onPress={() => router.push("/account-delete" as never)}
            >
              Request account deletion
            </Button>
            <Button variant="danger" onPress={handleLogout}>
              Log out
            </Button>
          </View>
        </View>
      </Screen>
    </RoleGuard>
  );
}
