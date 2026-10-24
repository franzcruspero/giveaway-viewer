"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = choices.find((choice) => choice.value === theme) ?? choices[2];

  useLayoutEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = isTheme(stored) ? stored : "system";
    setTheme(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      applyTheme(isTheme(storedTheme) ? storedTheme : "system");
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: ThemeChoice) {
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {current.label}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`size-4 text-zinc-500 transition-transform dark:text-zinc-400 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div
          role="group"
          aria-label="Color theme"
          className="absolute right-0 z-50 mt-1.5 flex w-max min-w-full flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {choices.map((choice) => {
            const selected = theme === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(choice.value)}
                className={`h-9 cursor-pointer rounded-lg px-3 text-left text-sm whitespace-nowrap transition-colors ${
                  selected
                    ? "bg-foreground font-medium text-background"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
