"use client";

import { useLayoutEffect, useState } from "react";
import { THEME_STORAGE_KEY, type ThemeChoice } from "./theme";

const choices: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function isTheme(value: string | null): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

function applyTheme(theme: ThemeChoice) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useLayoutEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = isTheme(stored) ? stored : "system";
    setTheme(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      const current = localStorage.getItem(THEME_STORAGE_KEY);
      applyTheme(isTheme(current) ? current : "system");
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function choose(next: ThemeChoice) {
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex shrink-0 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700"
    >
      {choices.map((choice) => {
        const selected = theme === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={selected}
            onClick={() => choose(choice.value)}
            className={`h-8 cursor-pointer rounded-md px-2.5 text-sm transition-colors ${
              selected
                ? "bg-foreground text-background"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
