import { create } from "zustand";
import { officialInterface } from "../types/official.type";
import { barangaySettings } from "../types/barangaySettings.type";
import { settingsApi, officialsApi } from "../utils/barangayApi";

type ApiError = { response?: { data?: { message?: string } }; message?: string };

/**
 * In-memory cache of the active officials and barangay settings. The Settings
 * page writes here after every change so that document generation always pulls
 * the CURRENT officials without needing source-code changes. It is intentionally
 * NOT persisted (localStorage) so a stale cache never outlives leadership — it
 * is repopulated from the database on app start / document generation.
 */
type BarangayStore = {
  officials: officialInterface[];
  settings: barangaySettings | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setOfficials: (officials: officialInterface[]) => void;
  setSettings: (settings: barangaySettings) => void;
  /** Build a map of active official name by position for document rendering. */
  activeByPosition: () => Record<string, string>;
  /** Build a map of active official NAMES BY position, precedence-sorted, for roster rendering. */
  activeOfficialsByPosition: () => Record<string, string[]>;
  /** Build a map of active official signature image URLs by position. */
  activeSignatureByPosition: () => Record<string, string>;
  /** Build a map of full active official objects by position (first active holder). */
  activeOfficialByPosition: () => Record<string, officialInterface>;
};

const useBarangaySettingsStore = create<BarangayStore>((set, get) => ({
  officials: [],
  settings: null,
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loaded || get().loading) return;
    await get().refresh();
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [officials, settings] = await Promise.all([
        officialsApi.getAll(),
        settingsApi.get(),
      ]);
      set({ officials, settings, loaded: true, loading: false });
    } catch (err) {
      set({
        loading: false,
        error:
          (err as ApiError)?.response?.data?.message ||
          (err as ApiError)?.message ||
          "Failed to load settings",
      });
    }
  },

  setOfficials: (officials) => set({ officials }),
  setSettings: (settings) => set({ settings }),

  activeByPosition: () => {
    const map: Record<string, string> = {};
    const active = get().officials.filter((o) => o.status === "active");
    // Highest precedence first so the top Kagawad wins the display slot.
    const sorted = [...active].sort(
      (a, b) => a.position.localeCompare(b.position) || a.precedence - b.precedence
    );
    for (const o of sorted) {
      if (!map[o.position]) map[o.position] = o.fullName;
    }
    return map;
  },

  // Groups the ACTIVE officials by position (precedence-sorted) so documents
  // that print a full roster (e.g. Barangay Certification) can place every
  // holder — kagawad 1..7 — not just the first name per position.
  activeOfficialsByPosition: () => {
    const map: Record<string, string[]> = {};
    const active = get().officials
      .filter((o) => o.status === "active")
      .sort((a, b) => a.precedence - b.precedence || a.fullName.localeCompare(b.fullName));
    for (const o of active) {
      (map[o.position] ??= []).push(o.fullName);
    }
    return map;
  },

  activeSignatureByPosition: () => {
    const map: Record<string, string> = {};
    const active = get().officials.filter((o) => o.status === "active");
    const sorted = [...active].sort(
      (a, b) => a.position.localeCompare(b.position) || a.precedence - b.precedence
    );
    for (const o of sorted) {
      if (!map[o.position] && o.signatureImage) map[o.position] = o.signatureImage;
    }
    return map;
  },

  activeOfficialByPosition: () => {
    const map: Record<string, officialInterface> = {};
    const active = get().officials.filter((o) => o.status === "active");
    const sorted = [...active].sort(
      (a, b) => a.position.localeCompare(b.position) || a.precedence - b.precedence
    );
    for (const o of sorted) {
      if (!map[o.position]) map[o.position] = o;
    }
    return map;
  },
}));

export default useBarangaySettingsStore;