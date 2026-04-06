// Global window augmentations for PWA install prompt
declare global {
  interface Window {
    deferredInstallPrompt: BeforeInstallPromptEvent | null | undefined;
    triggerInstall: () => void;
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}

export {};
