import fs from "fs";
import path from "path";

const promptsDir = path.join(process.cwd(), "src", "prompts");

export function loadPrompt(fileName) {
  const filePath = path.join(promptsDir, fileName);
  return fs.readFileSync(filePath, "utf-8");
}

export function fillPrompt(template, variables) {
  let result = template;

  for (const key in variables) {
    result = result.replaceAll(`{{${key}}}`, variables[key] ?? "");
  }

  return result;
}