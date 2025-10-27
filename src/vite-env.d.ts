/// <reference types="vite/client" />

interface Window {
  electron?: {
    quitApp: () => void;
  };
}