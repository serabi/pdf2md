import { App, Modal, Notice, TFile } from 'obsidian';
import PDF2MDPlugin from '../../main';
import { processPDF } from '../processing';
import { setProgressReporter, clearProgressReporter, ProgressUpdate } from '../progress';

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

		// Live progress UI
		const progressContainer = contentEl.createDiv('pdf2md-progress');
		const progressLabel = progressContainer.createEl('div', { text: 'Idle' });
		const progressBarWrapper = progressContainer.createEl('div', { cls: 'progress-bar-wrapper' });
		const progressBar = progressBarWrapper.createEl('div', { cls: 'progress-bar' });
		progressBar.style.width = '0%';

		setProgressReporter((u: ProgressUpdate) => {
			if (u.phase === 'chunk' && u.total && u.current) {
				progressLabel.setText(`${u.message}`);
				const pct = Math.min(100, Math.max(0, Math.round((u.current / u.total) * 100)));
				progressBar.style.width = pct + '%';
			} else {
				progressLabel.setText(u.message);
			}
		});

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
		clearProgressReporter();
	}
}