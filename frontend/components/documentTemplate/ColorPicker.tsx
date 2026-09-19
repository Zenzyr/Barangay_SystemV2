"use client";

const PALETTE = [
  "#000000", "#404040", "#595959", "#7f7f7f", "#c00000", "#ff0000", "#ed7d31", "#ffc000",
  "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0", "#ffffff",
];

/** Swatch grid + custom colour input. `onPick(null)` clears the colour. */
export function ColorPicker({
  current,
  onPick,
  clearLabel,
  label,
}: {
  current?: string | null;
  onPick: (color: string | null) => void;
  clearLabel: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-8 gap-1" role="listbox" aria-label={label}>
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            role="option"
            aria-selected={current?.toLowerCase() === color}
            aria-label={color}
            title={color}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(color)}
            style={{ backgroundColor: color }}
            className={`size-6 rounded border ${current?.toLowerCase() === color ? "ring-2 ring-blue-500 ring-offset-1" : "border-slate-300"}`}
          />
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
        Custom
        <input
          type="color"
          value={current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#000000"}
          onChange={(e) => onPick(e.target.value)}
          className="h-7 w-14 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
        />
      </label>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(null)}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
      >
        {clearLabel}
      </button>
    </div>
  );
}
