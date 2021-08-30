import * as vscode from "vscode";

function getOrDefault<T>(section: string, fallback: T) {
  const config = vscode.workspace.getConfiguration("reactScriptsTestAdapter");
  const value = config.get<T>(section);
  if (!value) return fallback;
  return value;
}

export function getDebugOutput(): string {
  return getOrDefault<string>("debugOutput", "internalConsole");
}

export function getBaseGlob(): string {
  return getOrDefault<string>("baseGlob", "src/**/*");
}
export function getTestGlob(): string {
  return getOrDefault<string>("testGlob", ".test.{js,jsx,ts,tsx}");
}

export function getWatchGlob(): string {
  return getOrDefault<string>("watchGlob", ".{js,jsx,ts,tsx}");
}

export function getMaxTestRunner(): number {
  const value = getOrDefault<number>("maxTestRunner", 5);
  return value
}