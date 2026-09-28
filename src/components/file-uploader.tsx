import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

type SelectedFile = DocumentPicker.DocumentPickerAsset;

type FileUploaderProps = {
  onFileSelected: (file: SelectedFile) => void;
  busy?: boolean;
  error?: string | null;
};

/** Provides a focused XLSX-only file selection surface for mobile and web. */
export function FileUploader({
  onFileSelected,
  busy = false,
  error,
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    setSelectedFile(file);
    onFileSelected(file);
  }

  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose an Excel workbook"
        className="min-h-[150px] items-center justify-center rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-6 py-8 active:opacity-70"
        disabled={busy}
        onPress={chooseFile}
      >
        <Text className="text-3xl">+</Text>
        <Text className="mt-2 text-center text-base font-semibold text-emerald-950">
          {busy ? "Reading workbook..." : "Choose an .xlsx workbook"}
        </Text>
        <Text className="mt-1 text-center text-sm text-emerald-800">
          Tap to browse your device. Only Excel workbooks are accepted.
        </Text>
      </Pressable>
      {selectedFile && (
        <View className="rounded-2xl bg-slate-100 px-4 py-3">
          <Text className="text-sm font-semibold text-slate-900">
            {selectedFile.name}
          </Text>
          <Text className="mt-1 text-xs text-slate-500">
            {selectedFile.size
              ? `${Math.round(selectedFile.size / 1024)} KB`
              : "Ready to import"}
          </Text>
        </View>
      )}
      {error && <Text className="text-sm text-rose-600">{error}</Text>}
    </View>
  );
}
