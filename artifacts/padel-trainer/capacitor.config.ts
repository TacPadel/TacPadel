import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TacPadel.app',
  appName: 'TacPadel',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  },
  // HIER EINFÜGEN:
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
