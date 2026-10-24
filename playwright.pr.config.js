import { defineConfig } from "@playwright/test";
import fullConfig from "./playwright.config.js";

// Every scenario runs in Chromium. Repeat browser-sensitive interactions on
// touch Chromium and Firefox; the scheduled/manual workflow retains all cases.
const interactionSpecs = [
  "mobile.spec.js",
  "timer.spec.js",
  "cube-player.spec.js",
  "cube-shell.spec.js",
  "dropdowns.spec.js",
  "library-controls.spec.js",
  "library-console.spec.js",
  "routes-settings.spec.js",
  "commands.spec.js",
  "settings-controls.spec.js",
];

export default defineConfig({
  ...fullConfig,
  projects: fullConfig.projects.map((project) => ({
    ...project,
    ...(project.name === "chromium"
      ? {}
      : { testMatch: interactionSpecs.map((name) => `**/${name}`) }),
  })),
});
