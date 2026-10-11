import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app: the web client's build (npm run android:build, mode `android`) packaged into a native shell.
 * It runs from https://localhost, which the server must list in XMAGE_ALLOWED_ORIGINS.
 */
const config: CapacitorConfig = {
  appId: 'club.multivac.playmat',
  appName: 'Playmat',
  webDir: 'dist',
  android: {
    // release builds can't be inspected from chrome://inspect
    webContentsDebuggingEnabled: false,
  },
};

export default config;
