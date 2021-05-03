import * as vscode from "vscode";

function getOrDefault(section: string, fallback: string) {
  const config = vscode.workspace.getConfiguration("reactScriptsTestAdapter");
  const value = config.get<string>(section);
  if (!value || value === "") return fallback;
  return value;
}

// export function getDescribeRegex(): RegExp {
//   const text = getOrDefault("testRegex", "");
//   if (text !== "") return new RegExp(text, "gm");
//   return new RegExp(/describe\(\'(?<describe>([^\>]*))\',/, "gm");
// }

export function getDebugOutput(): string {
  return getOrDefault("debugOutput", "internalConsole");
}

export function getTestRegex(): RegExp {
  const text = getOrDefault("testRegex", "");
  if (text !== "") return new RegExp(text, "gm");
  return new RegExp(/test\(\'(?<test>([^\>]*))\',/, "gm");
}

export function getTestEncoding(): "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "latin1" | "binary" | "hex" | null | undefined {
  return getOrDefault("testEncoding", "utf8") as "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "latin1" | "binary" | "hex" | null | undefined;
}

export function getBaseGlob(): string {
  return getOrDefault("baseGlob", "src/**/*");
}
export function getTestGlob(): string {
  return getOrDefault("testGlob", ".test.{js,jsx,ts,tsx}");
}

export function getWatchGlob(): string {
  return getOrDefault("watchGlob", ".{js,jsx,ts,tsx}");
}