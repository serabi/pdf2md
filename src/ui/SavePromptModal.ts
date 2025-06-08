import { App, Modal, Notice } from 'obsidian';

export class SavePromptModal extends Modal {
	onSave: (name: string) => void;

	constructor(app: App, onSave: (name: string) => void) {
		super(app);
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Save Prompt' });

		const inputContainer = contentEl.createDiv();
		inputContainer.createEl('label', { text: 'Prompt name:' });
		
		const input = inputContainer.createEl('input', {
			type: 'text',
			placeholder: 'Enter a name for this prompt'
		});
		input.focus();

		const buttonContainer = contentEl.createDiv('button-container');
		
		const saveBtn = buttonContainer.createEl('button', {
			text: 'Save',
			cls: 'mod-cta'
		});
		
		saveBtn.onclick = () => {
			const name = input.value.trim();
			if (name) {
				this.close();
				this.onSave(name);
			} else {
				new Notice('Please enter a name for the prompt');
			}
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		// Enter to save
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				saveBtn.click();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}