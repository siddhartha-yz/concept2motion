import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dependencies } from "./prepare.mjs";

export async function launchBrowser() {
  const { chromium } = await import(
    pathToFileURL(
      path.join(dependencies, "node_modules/playwright-core/index.mjs"),
    )
  );
  const executablePath = process.env.CHROMIUM_PATH ?? chromium.executablePath();
  if (!fs.existsSync(executablePath))
    throw Error(
      "Chromium is not installed. Run the browser-install command in README or set CHROMIUM_PATH.",
    );
  return chromium.launch({ headless: true, executablePath });
}
