import { Plugin } from 'obsidian';
import { PDF2MDSettings } from './src/types';
import { configurePDFJS } from './src/pdf';
import { initializeSettings } from './src/settings';
import { registerUI } from './src/ui-registration';

export default class PDF2MDPlugin extends Plugin {
	settings: PDF2MDSettings;
	fileWatcher: any = null;

	async onload() {
		console.log('[PDF2MD] Plugin loading...');
		try {
			configurePDFJS();
		} catch (e) {
			console.warn('[PDF2MD] PDF.js configuration skipped:', (e as any)?.message);
		}
		
		console.log('[PDF2MD] Loading settings...');
		try {
			await initializeSettings(this);
		} catch (e) {
			console.error('[PDF2MD] initializeSettings failed, using defaults:', (e as any)?.message);
			// Fallback to defaults to ensure settings tab still loads
			const { DEFAULT_SETTINGS } = await import('./src/types');
			this.settings = { ...DEFAULT_SETTINGS } as any;
		}
		
		registerUI(this);
	}

	onunload() {
		// Cleanup folder watcher
		if (this.fileWatcher) {
			console.log('[PDF2MD] Cleaning up folder watcher');
			if (this.fileWatcher.cleanup) {
				this.fileWatcher.cleanup();
			}
			this.fileWatcher = null;
		}
	}

	async loadSettings() {
		await initializeSettings(this);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}