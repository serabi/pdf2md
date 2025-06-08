import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
	title: string;
	message: string;
	onConfirm: () => void;

	constructor(app: App, title: string, message: string, onConfirm: () => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.message });

		const buttonContainer = contentEl.createDiv('button-container');
		
		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Yes',
			cls: 'mod-cta'
		});
		confirmBtn.onclick = () => {
			this.close();
			this.onConfirm();
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'No' });
		cancelBtn.onclick = () => this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}