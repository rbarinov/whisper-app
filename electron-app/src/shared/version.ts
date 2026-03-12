// Injected by webpack DefinePlugin from package.json at build time.
// In the main process (Node.js), falls back to reading package.json directly.
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : (() => { try { return require('../../package.json').version; } catch { return '0.0.0'; } })();

export const APP_RELEASE_TAG = `v${APP_VERSION}`;
export const APP_REPOSITORY_URL = 'https://github.com/rbarinov/whisper-app';
export const APP_LEGAL_NOTICE = `Version ${APP_VERSION}. Copyright Roman Barinov, 2026. Licensed under the MIT License.`;
