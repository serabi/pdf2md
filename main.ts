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
		
		configurePDFJS();
		
		console.log('[PDF2MD] Loading settings...');
		await initializeSettings(this);
		
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