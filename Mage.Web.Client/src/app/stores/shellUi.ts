import { create } from 'zustand';

/** The signed-in shell's own dialogs, so screens with their own header (Career) can open them too. */
interface ShellUiState {
  settingsOpen: boolean;
  setSettingsOpen(open: boolean): void;
}

export const useShellUi = create<ShellUiState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
