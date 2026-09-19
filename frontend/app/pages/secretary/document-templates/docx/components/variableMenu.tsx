"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { TemplateVariable } from "@/app/types/docxTemplate.type";

const GROUP_ORDER: TemplateVariable["group"][] = [
  "Resident",
  "Barangay",
  "Officials",
  "Document",
  "Document-specific",
];

export function VariableMenu({
  variables,
  onInsert,
  usedKeys,
}: {
  variables: TemplateVariable[];
  onInsert: (key: string) => void;
  usedKeys: Set<string>;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUP_ORDER.map((group) => ({
      group,
      items: variables.filter(
        (v) =>
          v.group === group &&
          (!q ||
            v.label.toLowerCase().includes(q) ||
            v.key.includes(q) ||
            group.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [variables, query]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search variables…"
          aria-label="Search variables"
          className="h-8 w-full rounded-md border border-slate-200 pl-7 pr-2 text-sm outline-none focus:border-blue-400"
        />
      </div>
      {variables.length === 0 ? (
        <p className="px-1 py-3 text-xs text-slate-500">
          No variables available.
        </p>
      ) : null}
      {groups.map(({ group, items }) => (
        <div key={group}>
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {group}
          </p>
          <ul>
            {items.map((v) => (
              <li key={v.key}>
                <button
                  type="button"
                  title={v.note}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInsert(v.key)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-sky-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-800">
                      {v.label}
                    </span>
                    {v.note ? (
                      <span className="block truncate text-[11px] text-slate-500">
                        {v.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-sky-700">
                    {usedKeys.has(v.key) ? "✓ " : ""}
                    {`{{${v.key}}}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {variables.length > 0 && groups.length === 0 ? (
        <p className="px-1 py-3 text-xs text-slate-500">
          No variables match “{query}”.
        </p>
      ) : null}
    </div>
  );
}
