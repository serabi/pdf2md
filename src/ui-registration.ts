import { TFile } from 'obsidian';
import { PDFProcessModal } from './ui/PDFProcessModal';
import { PDF2MDSettingTab } from './ui/PDF2MDSettingTab';
import { processPDF } from './processing';
import type PDF2MDPlugin from '../main';

export function registerUI(plugin: PDF2MDPlugin): void {
	registerRibbonIcon(plugin);
	registerCommands(plugin);
	registerSettingsTab(plugin);
	registerFileMenu(plugin);
}

function registerRibbonIcon(plugin: PDF2MDPlugin): void {
	const ribbonIconEl = plugin.addRibbonIcon('file-text', 'PDF to Markdown', async (evt: MouseEvent) => {
		new PDFProcessModal(plugin.app, plugin).open();
	});
	ribbonIconEl.addClass('pdf2md-ribbon-icon');
}

function registerCommands(plugin: PDF2MDPlugin): void {
	plugin.addCommand({
		id: 'open-pdf-processor',
		name: 'Convert PDF to Markdown',
		callback: () => {
			new PDFProcessModal(plugin.app, plugin).open();
		}
	});

	plugin.addCommand({
		id: 'process-current-pdf',
		name: 'Process current PDF file',
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === 'pdf') {
				if (!checking) {
					new PDFProcessModal(plugin.app, plugin, file).open();
				}
				return true;
			}
			return false;
		}
	});
}

function registerSettingsTab(plugin: PDF2MDPlugin): void {
	plugin.addSettingTab(new PDF2MDSettingTab(plugin.app, plugin));
}

function registerFileMenu(plugin: PDF2MDPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			if (file instanceof TFile && file.extension === 'pdf') {
				menu.addItem((item) => {
					item
						.setTitle('Convert to Markdown')
						.setIcon('file-text')
						.onClick(() => processPDF(plugin, file));
				});
			}
		})
	);
}