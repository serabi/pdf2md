import { App, Modal, Notice } from 'obsidian';
import { DefaultPrompt, SavedPrompt } from '../types';

export class PromptViewModal extends Modal {
	prompt: DefaultPrompt | SavedPrompt;
	canEdit: boolean;

	constructor(app: App, prompt: DefaultPrompt | SavedPrompt, canEdit: boolean = true) {
		super(app);
		this.prompt = prompt;
		this.canEdit = canEdit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('prompt-view-modal');

		contentEl.createEl('h2', { text: this.prompt.name });

		const textArea = contentEl.createEl('textarea', {
			attr: {
				readonly: 'true',
				rows: '20',
				cols: '80'
			}
		});
		textArea.value = this.prompt.content;
		textArea.style.width = '100%';
		textArea.style.fontFamily = 'monospace';
		textArea.style.color = 'var(--text-normal)';
		textArea.style.backgroundColor = 'var(--background-secondary)';
		textArea.style.border = '1px solid var(--background-modifier-border)';
		textArea.style.padding = '0.75em';
		textArea.style.borderRadius = '4px';

		const buttonContainer = contentEl.createDiv('button-container');
		
		const copyBtn = buttonContainer.createEl('button', {
			text: 'Copy to Clipboard',
			cls: 'mod-cta'
		});
		copyBtn.onclick = () => {
			navigator.clipboard.writeText(this.prompt.content);
			new Notice('Prompt copied to clipboard');
		};

		const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
		closeBtn.onclick = () => this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}