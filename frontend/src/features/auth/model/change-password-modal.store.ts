import { create } from 'zustand';

type ChangePasswordModalState = {
  open: boolean;
  openChangePassword: () => void;
  closeChangePassword: () => void;
  setOpen: (open: boolean) => void;
};

export const useChangePasswordModal = create<ChangePasswordModalState>((set) => ({
  open: false,
  openChangePassword: () => set({ open: true }),
  closeChangePassword: () => set({ open: false }),
  setOpen: (open) => set({ open }),
}));
