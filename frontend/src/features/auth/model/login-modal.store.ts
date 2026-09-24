import { create } from 'zustand';

type LoginModalState = {
  open: boolean;
  source?: string;
  openLogin: (source?: string) => void;
  closeLogin: () => void;
  setOpen: (open: boolean) => void;
};

export const useLoginModal = create<LoginModalState>((set) => ({
  open: false,
  openLogin: (source) => set({ open: true, source }),
  closeLogin: () => set({ open: false, source: undefined }),
  setOpen: (open) => set((state) => ({ open, source: open ? state.source : undefined })),
}));
