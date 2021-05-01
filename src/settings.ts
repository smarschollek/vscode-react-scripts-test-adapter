import * as vscode from "vscode";

function getOrDefault(section: string, fallback: string) {
  const config = vscode.workspace.getConfiguration("luaTestAdapter");
  const value = config.get<string>(section);
  if (!value || value === "") return fallback;
  return value;
}

// export function getDescribeRegex(): RegExp {
//   const text = getOrDefault("testRegex", "");
//   if (text !== "") return new RegExp(text, "gm");
//   return new RegExp(/describe\(\'(?<describe>([^\>]*))\',/, "gm");
// }

export function getTestRegex(): RegExp {
  const text = getOrDefault("testRegex", "");
  if (text !== "") return new RegExp(text, "gm");
  return new RegExp(/test\(\'(?<test>([^\>]*))\',/, "gm");
}

export function getTestEncoding(): "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "latin1" | "binary" | "hex" | null | undefined {
  return getOrDefault("testEncoding", "utf8") as "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "latin1" | "binary" | "hex" | null | undefined;
}

export function getTestGlob(): string {
  return getOrDefault("testGlob", "src/**/*test.{js,jsx,ts,tsx}");
}