import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mehak.stationery',
  appName: 'Bol Bahi Inventory',
  webDir: 'out',
  android: { allowMixedContent: false },
  plugins: { SystemBars: { insetsHandling: 'native', style: 'LIGHT' } },
};

export default config;
