import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mehak.bolbahi',
  appName: 'Bol Bahi',
  webDir: 'out',
  android: { allowMixedContent: false },
  plugins: { SystemBars: { insetsHandling: 'native', style: 'LIGHT' } },
};

export default config;
