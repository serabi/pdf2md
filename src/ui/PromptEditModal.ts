import { App, Modal, Notice } from 'obsidian';
import { SavedPrompt } from '../types';

export class PromptEditModal extends Modal {
	prompt: SavedPrompt | null;
	onSave: (prompt: SavedPrompt) => void;
	nameInput: HTMLInputElement;
	contentTextArea: HTMLTextAreaElement;

	constructor(app: App, prompt: SavedPrompt | null, onSave: (prompt: SavedPrompt) => void) {
		super(app);
		this.prompt = prompt;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('prompt-edit-modal');

		contentEl.createEl('h2', { text: this.prompt ? 'Edit Prompt' : 'Create New Prompt' });

		// Name input
		const nameContainer = contentEl.createDiv();
		nameContainer.createEl('label', { text: 'Prompt Name:' });
		this.nameInput = nameContainer.createEl('input', {
			type: 'text',
			placeholder: 'Enter a name for this prompt',
			value: this.prompt?.name || ''
		});
		this.nameInput.style.width = '100%';
		this.nameInput.style.marginBottom = '10px';

		// Content textarea
		const contentContainer = contentEl.createDiv();
		contentContainer.createEl('label', { text: 'Prompt Content:' });
		this.contentTextArea = contentContainer.createEl('textarea', {
			placeholder: 'Enter your prompt content here...',
			attr: {
				rows: '15',
				cols: '80'
			}
		});
		this.contentTextArea.value = this.prompt?.content || '';
		this.contentTextArea.style.width = '100%';
		this.contentTextArea.style.fontFamily = 'monospace';
		this.contentTextArea.style.color = 'var(--text-normal)';
		this.contentTextArea.style.backgroundColor = 'var(--background-secondary)';
		this.contentTextArea.style.border = '1px solid var(--background-modifier-border)';
		this.contentTextArea.style.padding = '0.75em';
		this.contentTextArea.style.borderRadius = '4px';

		const buttonContainer = contentEl.createDiv('button-container');
		
		const saveBtn = buttonContainer.createEl('button', {
			text: this.prompt ? 'Update' : 'Create',
			cls: 'mod-cta'
		});
		
		saveBtn.onclick = () => {
			const name = this.nameInput.value.trim();
			const content = this.contentTextArea.value.trim();
			
			if (!name) {
				new Notice('Please enter a name for the prompt');
				return;
			}
			
			if (!content) {
				new Notice('Please enter content for the prompt');
				return;
			}

			const savedPrompt: SavedPrompt = {
				id: this.prompt?.id || Date.now().toString(),
				name: name,
				content: content,
				createdAt: this.prompt?.createdAt || Date.now()
			};

			this.close();
			this.onSave(savedPrompt);
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		// Focus name input
		this.nameInput.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}