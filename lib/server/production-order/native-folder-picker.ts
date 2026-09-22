import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type NativeFolderPickerResult =
  | { status: "selected"; path: string }
  | { status: "cancelled" };

export class NativeFolderPickerUnavailableError extends Error {
  constructor(message = "Обзор папок недоступен на этом компьютере.") {
    super(message);
    this.name = "NativeFolderPickerUnavailableError";
  }
}

export function nativeFolderPickerSupported(platform: NodeJS.Platform = process.platform) {
  return platform === "darwin" || platform === "win32" || platform === "linux";
}

function cleanOutput(value: string) {
  return value.replace(/[\r\n]+$/g, "").trim();
}

function isCancellation(error: unknown) {
  const candidate = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
  const text = `${candidate.message ?? ""} ${candidate.stderr ?? ""} ${candidate.stdout ?? ""}`.toLowerCase();
  return text.includes("user canceled")
    || text.includes("user cancelled")
    || text.includes("operation canceled")
    || text.includes("operation cancelled")
    || candidate.code === "2";
}

async function chooseOnMac() {
  const script = 'POSIX path of (choose folder with prompt "Выберите папку для хранения КП, заявок и чертежей")';
  const result = await execFileAsync("/usr/bin/osascript", ["-e", script], {
    timeout: 120_000,
    maxBuffer: 16 * 1024,
  });
  return cleanOutput(result.stdout);
}

async function chooseOnWindows() {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Выберите папку для хранения КП, заявок и чертежей'",
    "$dialog.ShowNewFolderButton = $true",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  [Console]::Out.Write($dialog.SelectedPath)",
    "  exit 0",
    "}",
    "exit 2",
  ].join("; ");
  const result = await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
    timeout: 120_000,
    windowsHide: false,
    maxBuffer: 16 * 1024,
  });
  return cleanOutput(result.stdout);
}

async function chooseOnLinux() {
  const result = await execFileAsync("zenity", [
    "--file-selection",
    "--directory",
    "--title=Выберите папку для хранения КП, заявок и чертежей",
  ], {
    timeout: 120_000,
    maxBuffer: 16 * 1024,
  });
  return cleanOutput(result.stdout);
}

export async function chooseProductionOrderStorageFolder(
  platform: NodeJS.Platform = process.platform,
): Promise<NativeFolderPickerResult> {
  try {
    const selected = platform === "darwin"
      ? await chooseOnMac()
      : platform === "win32"
        ? await chooseOnWindows()
        : platform === "linux"
          ? await chooseOnLinux()
          : null;
    if (!selected) {
      if (!nativeFolderPickerSupported(platform)) throw new NativeFolderPickerUnavailableError();
      return { status: "cancelled" };
    }
    return { status: "selected", path: selected };
  } catch (error) {
    if (isCancellation(error)) return { status: "cancelled" };
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new NativeFolderPickerUnavailableError();
    throw error;
  }
}
