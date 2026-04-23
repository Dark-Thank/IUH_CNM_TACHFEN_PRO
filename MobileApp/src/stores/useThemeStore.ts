import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeState } from "@/types/store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,

      toggleTheme: () => {
        const newValue = !get().isDark;
        set({ isDark: newValue });
      },

      setTheme: (dark: boolean) => {
        set({ isDark: dark });
      },
    }),
    {
      name: "theme-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
