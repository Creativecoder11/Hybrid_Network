"use client";

import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Tabs({
  tabs,
  defaultTab,
  onChange,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
  defaultTab?: string;
  onChange?: (key: string) => void;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  useEffect(() => {
    if (defaultTab && tabs.some((t) => t.key === defaultTab)) {
      setActive(defaultTab);
    }
  }, [defaultTab, tabs]);

  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  function handleSelect(key: string) {
    setActive(key);
    onChange?.(key);
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleSelect(t.key)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              t.key === active
                ? "border-accent-green text-accent-green"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-5">{activeTab?.content}</div>
    </div>
  );
}
