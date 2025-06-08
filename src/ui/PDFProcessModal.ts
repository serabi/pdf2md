import { App, Modal, Notice, TFile } from 'obsidian';
import PDF2MDPlugin from '../../main';
import { processPDF } from '../processing';

export class PDFProcessModal extends Modal {
	plugin: PDF2MDPlugin;

	constructor(app: App, plugin: PDF2MDPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		console.log('[PDF2MD] Opening PDF process modal...');
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pdf2md-modal');

		contentEl.createEl('h2', { text: 'Convert PDF to Markdown' });

		// File selection
		const fileInputContainer = contentEl.createDiv('file-input-container');
		fileInputContainer.createEl('label', { text: 'Select a PDF file:' });
		
		const fileInput = fileInputContainer.createEl('input', {
			type: 'file',
			attr: {
				accept: '.pdf'
			}
		});

		// Or select from vault
		const vaultFileContainer = contentEl.createDiv('vault-file-container');
		vaultFileContainer.createEl('p', { text: 'Or select a PDF from your vault:' });
		
		const pdfFiles = this.app.vault.getFiles().filter(f => f.extension === 'pdf');
		
		if (pdfFiles.length > 0) {
			const select = vaultFileContainer.createEl('select');
			select.createEl('option', { text: 'Choose a PDF...', value: '' });
			
			pdfFiles.forEach(file => {
				select.createEl('option', { text: file.path, value: file.path });
			});

			// Process button
			const processBtn = contentEl.createEl('button', {
				text: 'Convert to Markdown',
				cls: 'mod-cta'
			});

			processBtn.onclick = async () => {
				const selectedPath = select.value;
				if (selectedPath) {
					const file = this.app.vault.getAbstractFileByPath(selectedPath) as TFile;
					if (file) {
						this.close();
						await processPDF(this.plugin, file);
					}
				} else if (fileInput.files && fileInput.files[0]) {
					// Handle uploaded file
					this.close();
					new Notice('Processing uploaded PDF...');
					// Implementation for uploaded files would go here
				} else {
					new Notice('Please select a PDF file');
				}
			};
		} else {
			vaultFileContainer.createEl('p', { 
				text: 'No PDF files found in vault',
				cls: 'mod-warning'
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}