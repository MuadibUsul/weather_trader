"use client";

import { create } from "zustand";

export type Environment = "PAPER" | "REAL";

type UiState = {
  environment: Environment;
  modalOpen: boolean;
  setEnvironment: (env: Environment) => void;
  openModal: () => void;
  closeModal: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  environment: "REAL",
  modalOpen: false,
  setEnvironment: (environment) => set({ environment }),
  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),
}));
