import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { accountInterface } from '../types/account.type';

type UserStore = {
  user: accountInterface | null;
  setUser: (userData: NonNullable<accountInterface>) => void;
  clearUser: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
};

const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (userData) => set({ user: userData }),
      clearUser: () => set({ user: null }),
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export default useUserStore;