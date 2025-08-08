import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import PDF2MDPlugin from '../../main';
import { ConfirmModal } from './ConfirmModal';
import { PromptEditModal } from './PromptEditModal';
import { PromptViewModal } from './PromptViewModal';
import { SavedPrompt, DefaultPrompt, DEFAULT_PROMPTS, MODEL_DISPLAY_NAMES } from '../types';
import { loadOllamaModels } from '../ai';
import { getAllPrompts, getPromptById } from '../utils';
import { setupFolderWatcher } from '../watcher';

export class PDF2MDSettingTab extends PluginSettingTab {
	plugin: PDF2MDPlugin;
	activeTab: string = 'general';

	constructor(app: App, plugin: PDF2MDPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'PDF to Markdown Settings' });

		// Create tab navigation
		const tabContainer = containerEl.createDiv('tab-container');
		const generalTab = tabContainer.createEl('button', {
			text: 'General',
			cls: this.activeTab === 'general' ? 'tab-button active' : 'tab-button'
		});
		const promptsTab = tabContainer.createEl('button', {
			text: 'Prompts',
			cls: this.activeTab === 'prompts' ? 'tab-button active' : 'tab-button'
		});

		generalTab.onclick = () => {
			this.activeTab = 'general';
			this.display();
		};

		promptsTab.onclick = () => {
			this.activeTab = 'prompts';
			this.display();
		};

		// Create content container
		const contentContainer = containerEl.createDiv('tab-content');

		if (this.activeTab === 'general') {
			this.displayGeneralTab(contentContainer);
		} else {
			this.displayPromptsTab(contentContainer);
		}
	}

	displayGeneralTab(containerEl: HTMLElement): void {
		// AI Provider Selection
		new Setting(containerEl)
			.setName('AI Provider')
			.setDesc('Choose between Anthropic Claude or Ollama')
			.addDropdown(dropdown => dropdown
				.addOption('anthropic', 'Anthropic Claude')
				.addOption('ollama', 'Ollama (Local)')
				.setValue(this.plugin.settings.selectedProvider)
				.onChange(async (value: 'anthropic' | 'ollama') => {
					this.plugin.settings.selectedProvider = value;
					// Auto-select a sensible default prompt for the provider
					try {
						if (value === 'ollama') {
							const p = getPromptById(this.plugin, 'ollama-default-prompt');
							if (p) {
								this.plugin.settings.selectedPromptId = p.id;
								this.plugin.settings.currentPrompt = p.content;
							}
						} else if (value === 'anthropic') {
							const p = getPromptById(this.plugin, 'image-text-extraction');
							if (p) {
								this.plugin.settings.selectedPromptId = p.id;
								this.plugin.settings.currentPrompt = p.content;
							}
						}
					} catch {}
					await this.plugin.saveSettings();
					this.display(); // Refresh to show relevant settings
				}));

		if (this.plugin.settings.selectedProvider === 'anthropic') {
			// Anthropic API Key
			new Setting(containerEl)
				.setName('Anthropic API Key')
				.setDesc('Enter your Anthropic API key')
				.addText(text => text
					.setPlaceholder('sk-ant-...')
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (value) => {
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
					})
					.inputEl.type = 'password');

			// Model Selection for Anthropic
			new Setting(containerEl)
				.setName('Claude Model')
				.setDesc('Select the Claude model to use')
				.addDropdown(dropdown => {
					this.plugin.settings.anthropicModels.forEach(model => {
						const displayName = MODEL_DISPLAY_NAMES[model] || model;
						dropdown.addOption(model, displayName);
					});
					dropdown
						.setValue(this.plugin.settings.selectedModel)
						.onChange(async (value) => {
							this.plugin.settings.selectedModel = value;
							await this.plugin.saveSettings();
						});
				});
		} else {
			// Ollama URL
			new Setting(containerEl)
				.setName('Ollama URL')
				.setDesc('URL of your Ollama instance')
				.addText(text => text
					.setPlaceholder('http://localhost:11434')
					.setValue(this.plugin.settings.ollamaUrl)
					.onChange(async (value) => {
						this.plugin.settings.ollamaUrl = value;
						await this.plugin.saveSettings();
					}));

			// Refresh Ollama Models / Test Connection
			new Setting(containerEl)
				.setName('Ollama Tools')
				.setDesc('Manage Ollama connectivity and models')
				.addButton(button => button
					.setButtonText('Refresh Models')
					.onClick(async () => {
						const success = await loadOllamaModels(this.plugin);
						if (success) {
							new Notice('Ollama models loaded successfully');
						} else {
							new Notice('Failed to connect to Ollama. Please ensure Ollama is running at ' + this.plugin.settings.ollamaUrl);
						}
						this.display();
					}))
				.addButton(button => button
					.setButtonText('Test Connection')
					.onClick(async () => {
						// Use provider testConnection via ai router
						try {
							const { getProvider } = await import('../providers');
							const provider = getProvider('ollama');
							const ok = provider.testConnection ? await provider.testConnection(this.plugin) : false;
							if (ok) new Notice('Ollama connection OK');
							else new Notice('Ollama connection failed');
						} catch (e) {
							new Notice('Ollama connection test unavailable');
						}
					}));

			// Model Selection for Ollama (with simple vision labeling)
			if (this.plugin.settings.ollamaModels.length > 0) {
				new Setting(containerEl)
					.setName('Ollama Model')
					.setDesc('Select the model to use (vision-capable models recommended for images)')
					.addDropdown(dropdown => {
					const labelVision = (m: string) => {
						const visionList = new Set(this.plugin.settings.ollamaVisionModels || []);
						const heuristic = /llava|bakllava|moondream|qwen[- ]?vl|qwenvl|minicpm|yi[- ]?vl|phi-3-vision/i.test(m);
						return (visionList.has(m) || heuristic) ? `${m} (vision)` : m;
					};
						this.plugin.settings.ollamaModels.forEach(model => {
							dropdown.addOption(model, labelVision(model));
						});
						dropdown
							.setValue(this.plugin.settings.selectedModel)
							.onChange(async (value) => {
								this.plugin.settings.selectedModel = value;
								await this.plugin.saveSettings();
						});
					});

				// Warning if non-vision model selected and user hasn't overridden
				const selected = this.plugin.settings.selectedModel || '';
				const isVision = (this.plugin.settings.ollamaVisionModels || []).includes(selected) || /llava|bakllava|moondream|qwen[- ]?vl|qwenvl|minicpm|yi[- ]?vl|phi-3-vision/i.test(selected);
				if (!isVision && !this.plugin.settings.ollamaAssumeVision) {
					containerEl.createEl('p', {
						text: `Selected model may not support images. Enable "Assume model supports vision" above to force, or choose a vision-capable model (e.g., llava).`,
						cls: 'setting-item-description mod-warning'
					});
				}
			} else {
				containerEl.createEl('p', { 
					text: 'No Ollama models found. Click "Refresh" above to load models from your Ollama instance.',
					cls: 'setting-item-description mod-warning'
				});
			}

			// Ollama advanced settings
			containerEl.createEl('h3', { text: 'Ollama Advanced Settings' });

			new Setting(containerEl)
				.setName('Images per request')
				.setDesc('How many images to send per request (many models only support 1).')
				.addText(text => text
					.setPlaceholder('1')
					.setValue(String(this.plugin.settings.ollamaImagesPerRequest ?? 1))
					.onChange(async (value) => {
						const num = Math.max(1, parseInt(value || '1', 10) || 1);
						this.plugin.settings.ollamaImagesPerRequest = num;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Retry attempts')
				.setDesc('Number of retries on transient errors')
				.addText(text => text
					.setPlaceholder('2')
					.setValue(String(this.plugin.settings.ollamaRetryCount ?? 2))
					.onChange(async (value) => {
						const num = Math.max(0, parseInt(value || '2', 10) || 2);
						this.plugin.settings.ollamaRetryCount = num;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Retry delay (ms)')
				.setDesc('Delay between retries in milliseconds')
				.addText(text => text
					.setPlaceholder('1000')
					.setValue(String(this.plugin.settings.ollamaRetryDelayMs ?? 1000))
					.onChange(async (value) => {
						const num = Math.max(0, parseInt(value || '1000', 10) || 1000);
						this.plugin.settings.ollamaRetryDelayMs = num;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Assume model supports vision')
				.setDesc('Treat the selected model as vision-capable even if name detection fails')
				.addToggle(toggle => toggle
					.setValue(Boolean(this.plugin.settings.ollamaAssumeVision))
					.onChange(async (value) => {
						this.plugin.settings.ollamaAssumeVision = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Enable streaming (experimental)')
				.setDesc('Request streaming responses from Ollama (UI updates not yet streaming)')
				.addToggle(toggle => toggle
					.setValue(Boolean(this.plugin.settings.ollamaEnableStreaming))
					.onChange(async (value) => {
						this.plugin.settings.ollamaEnableStreaming = value;
						await this.plugin.saveSettings();
					}));
		}

		// PDF image extraction controls
		containerEl.createEl('h3', { text: 'PDF Image Extraction' });

		new Setting(containerEl)
			.setName('DPI')
			.setDesc('Dots per inch for page rasterization (50-600)')
			.addText(text => text
				.setPlaceholder('200')
				.setValue(String(this.plugin.settings.pdfImageDpi ?? 200))
				.onChange(async (value) => {
					const num = Math.max(50, Math.min(600, parseInt(value || '200', 10) || 200));
					this.plugin.settings.pdfImageDpi = num;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max width (px)')
			.setDesc('Scale images to this maximum width (256-4096)')
			.addText(text => text
				.setPlaceholder('2048')
				.setValue(String(this.plugin.settings.pdfImageMaxWidth ?? 2048))
				.onChange(async (value) => {
					const num = Math.max(256, Math.min(4096, parseInt(value || '2048', 10) || 2048));
					this.plugin.settings.pdfImageMaxWidth = num;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Image format')
			.setDesc('Choose PNG (lossless) or JPEG (smaller)')
			.addDropdown(dropdown => dropdown
				.addOption('png', 'PNG')
				.addOption('jpeg', 'JPEG')
				.setValue(this.plugin.settings.pdfImageFormat ?? 'png')
				.onChange(async (value: 'png' | 'jpeg') => {
					this.plugin.settings.pdfImageFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('JPEG quality')
			.setDesc('Applies when format is JPEG (1-100)')
			.addText(text => text
				.setPlaceholder('85')
				.setValue(String(this.plugin.settings.pdfJpegQuality ?? 85))
				.onChange(async (value) => {
					const num = Math.max(1, Math.min(100, parseInt(value || '85', 10) || 85));
					this.plugin.settings.pdfJpegQuality = num;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Poppler pdftoppm path (optional)')
			.setDesc('If set, use this path to pdftoppm. Otherwise the system PATH and common locations are tried.')
			.addText(text => text
				.setPlaceholder('/usr/bin/pdftoppm or C\\\:\\Program Files\\poppler\\bin\\pdftoppm.exe')
				.setValue(this.plugin.settings.popplerPdftoppmPath || '')
				.onChange(async (value) => {
					this.plugin.settings.popplerPdftoppmPath = value.trim();
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Test Poppler')
				.onClick(async () => {
					try {
						const ok = await (await import('../utils')).testPdftoppmPath(this.plugin.settings.popplerPdftoppmPath);
						if (ok) new Notice('Poppler test succeeded (pdftoppm available)');
						else new Notice('Poppler test failed: pdftoppm not found');
					} catch (e) {
						new Notice('Poppler test failed');
					}
				}));

		// Prompt Selection
		containerEl.createEl('h3', { text: 'Prompt Configuration' });
		
		new Setting(containerEl)
			.setName('Selected Prompt')
			.setDesc('Choose a prompt template for PDF conversion')
			.addDropdown(dropdown => {
				// Add option for custom/edited prompt
				dropdown.addOption('', 'Custom/Edited');
				
				const allPrompts = getAllPrompts(this.plugin);
				allPrompts.forEach((prompt: SavedPrompt | DefaultPrompt) => {
					dropdown.addOption(prompt.id, prompt.name);
				});
				
				// Set value to empty string if no match found or if selectedPromptId is empty
				const currentValue = this.plugin.settings.selectedPromptId || '';
				dropdown
					.setValue(currentValue)
					.onChange(async (value) => {
						if (value === '') {
							// User selected "Custom/Edited" - don't change the current prompt
							this.plugin.settings.selectedPromptId = '';
						} else {
							// User selected a specific prompt template
							this.plugin.settings.selectedPromptId = value;
							const selectedPrompt = getPromptById(this.plugin, value);
							if (selectedPrompt) {
								this.plugin.settings.currentPrompt = selectedPrompt.content;
							}
						}
						await this.plugin.saveSettings();
						this.display(); // Refresh to show updated current prompt
					});
			});

		new Setting(containerEl)
			.setName('Current Prompt')
			.setDesc('Edit the current prompt or select from templates above')
			.addTextArea(text => text
				.setPlaceholder('Enter your prompt...')
				.setValue(this.plugin.settings.currentPrompt)
				.onChange(async (value) => {
					this.plugin.settings.currentPrompt = value;
					// Clear selected prompt ID since this is now a custom edit
					this.plugin.settings.selectedPromptId = '';
					await this.plugin.saveSettings();
				})
			)
			.then(setting => {
				const textarea = setting.controlEl.querySelector('textarea')!;
				textarea.rows = 8;
				textarea.style.minHeight = '150px';
				textarea.style.fontFamily = 'var(--font-monospace)';
			});

		containerEl.createEl('p', { 
			text: 'To manage prompts (create, edit, delete), go to the "Prompts" tab.',
			cls: 'setting-item-description'
		});

		// Post-processing and Validation
		containerEl.createEl('h3', { text: 'Post-processing & Validation' });

		new Setting(containerEl)
			.setName('Enable Post-processing Template')
			.setDesc('Apply a template to wrap the generated markdown with frontmatter, headers, etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePostProcessing)
				.onChange(async (value) => {
					this.plugin.settings.enablePostProcessing = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide post-processing prompt
				}));

		if (this.plugin.settings.enablePostProcessing) {
			new Setting(containerEl)
				.setName('Post-processing Template')
				.setDesc('Template to wrap the generated content. Available placeholders: {{content}} (generated markdown), {{date}} (YYYY-MM-DD), {{datetime}} (ISO format), {{time}} (HH:MM:SS)')
				.addTextArea(text => text
					.setPlaceholder('---\ntags: [pdf2md, converted]\ndate: {{date}}\n---\n\n{{content}}')
					.setValue(this.plugin.settings.postProcessingTemplate)
					.onChange(async (value) => {
						this.plugin.settings.postProcessingTemplate = value;
						await this.plugin.saveSettings();
					})
				)
				.then(setting => {
					const textarea = setting.controlEl.querySelector('textarea')!;
					textarea.rows = 4;
					textarea.style.minHeight = '100px';
					textarea.style.fontFamily = 'var(--font-monospace)';
				});
		}

		// Folder Settings
		containerEl.createEl('h3', { text: 'File & Folder Settings' });

		new Setting(containerEl)
			.setName('Output Folder')
			.setDesc('Folder to save generated Markdown files (leave empty to save in same folder as PDF)')
			.addText(text => text
				.setPlaceholder('e.g., Converted PDFs')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Filename Pattern')
			.setDesc('Pattern for generated markdown filenames. Available placeholders: {{basename}} (original filename without extension), {{date}} (YYYY-MM-DD), {{datetime}} (ISO format), {{time}} (HH:MM:SS)')
			.addText(text => text
				.setPlaceholder('{{basename}}')
				.setValue(this.plugin.settings.filenamePattern)
				.onChange(async (value) => {
					this.plugin.settings.filenamePattern = value.trim() || '{{basename}}';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Embed Original PDF')
			.setDesc('Include the original PDF embedded at the bottom of the generated Markdown file')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.embedPDF)
				.onChange(async (value) => {
					this.plugin.settings.embedPDF = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Move Processed PDFs')
			.setDesc('Move processed PDF files to a designated folder after conversion')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.moveProcessedPDFs)
				.onChange(async (value) => {
					this.plugin.settings.moveProcessedPDFs = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide folder setting
				}));

		if (this.plugin.settings.moveProcessedPDFs) {
			new Setting(containerEl)
				.setName('Processed PDF Folder')
				.setDesc('Folder to move processed PDF files to')
				.addText(text => text
					.setPlaceholder('e.g., Processed PDFs')
					.setValue(this.plugin.settings.processedPDFFolder)
					.onChange(async (value) => {
						this.plugin.settings.processedPDFFolder = value.trim();
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName('Enable Folder Watching')
			.setDesc('Automatically process PDFs when added to the watch folder')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableWatching)
				.onChange(async (value) => {
					this.plugin.settings.enableWatching = value;
					await this.plugin.saveSettings();
					if (value && this.plugin.settings.watchFolder) {
						setupFolderWatcher(this.plugin);
					} else if (!value && this.plugin.fileWatcher) {
						if (this.plugin.fileWatcher.cleanup) {
							this.plugin.fileWatcher.cleanup();
						}
						this.plugin.fileWatcher = null;
					}
					this.display(); // Refresh to show/hide watch folder setting
				}));

		if (this.plugin.settings.enableWatching) {
			new Setting(containerEl)
				.setName('Watch Folder')
				.setDesc('Folder to monitor for new PDF files')
				.addText(text => text
					.setPlaceholder('e.g., PDF Inbox')
					.setValue(this.plugin.settings.watchFolder)
					.onChange(async (value) => {
						this.plugin.settings.watchFolder = value.trim();
						await this.plugin.saveSettings();
						// Restart watcher with new folder
						if (this.plugin.settings.enableWatching && value.trim()) {
							setupFolderWatcher(this.plugin);
						}
					}));
		}
	}

	displayPromptsTab(containerEl: HTMLElement): void {
		// Default Prompts Section
		containerEl.createEl('h3', { text: 'Default Prompts' });
		containerEl.createEl('p', { 
			text: 'These are built-in prompts that can be edited and customized. Use "Reset to Default" to restore original content.',
			cls: 'setting-item-description'
		});

		this.plugin.settings.defaultPrompts.forEach((prompt, index) => {
			const setting = new Setting(containerEl)
				.setName(prompt.name)
				.setDesc('Built-in prompt (editable)')
				.addButton(button => button
					.setButtonText('Edit')
					.onClick(() => {
						// Convert DefaultPrompt to SavedPrompt format for editing
						const promptForEditing: SavedPrompt = {
							id: prompt.id,
							name: prompt.name,
							content: prompt.content,
							createdAt: Date.now() // Add a timestamp for editing
						};
						new PromptEditModal(this.app, promptForEditing, async (updatedPrompt: SavedPrompt) => {
							// Update the default prompt
							this.plugin.settings.defaultPrompts[index] = {
								id: prompt.id,
								name: updatedPrompt.name,
								content: updatedPrompt.content,
								isDefault: true
							};
							await this.plugin.saveSettings();
							new Notice('Default prompt updated successfully');
							this.display();
						}).open();
					}))
				.addButton(button => button
					.setButtonText('View/Copy')
					.onClick(() => {
						new PromptViewModal(this.app, prompt, false).open();
					}))
				.addButton(button => button
					.setButtonText('Use This Prompt')
					.onClick(async () => {
						this.plugin.settings.selectedPromptId = prompt.id;
						this.plugin.settings.currentPrompt = prompt.content;
						await this.plugin.saveSettings();
						new Notice(`"${prompt.name}" prompt selected`);
						// Switch to General tab to show the selected prompt
						this.activeTab = 'general';
						this.display();
					}))
				.addButton(button => button
					.setButtonText('Reset to Default')
					.setWarning()
					.onClick(async () => {
						const confirmModal = new ConfirmModal(
							this.app,
							'Reset Prompt',
							`Are you sure you want to reset "${prompt.name}" to its original default content?`,
							async () => {
								// Find the original default prompt
								const originalPrompt = DEFAULT_PROMPTS.find(p => p.id === prompt.id);
								if (originalPrompt) {
									this.plugin.settings.defaultPrompts[index] = {...originalPrompt};
									await this.plugin.saveSettings();
									new Notice('Prompt reset to default');
									this.display();
								}
							}
						);
						confirmModal.open();
					}));
		});

		// Custom Prompts Section
		containerEl.createEl('h3', { text: 'Custom Prompts' });
		
		new Setting(containerEl)
			.setName('Create New Prompt')
			.setDesc('Create a custom prompt for PDF conversion')
			.addButton(button => button
				.setButtonText('New Prompt')
				.onClick(() => {
					new PromptEditModal(this.app, null, async (prompt: SavedPrompt) => {
						this.plugin.settings.savedPrompts.push(prompt);
						await this.plugin.saveSettings();
						new Notice('Prompt created successfully');
						this.display();
					}).open();
				}));

		if (this.plugin.settings.savedPrompts.length > 0) {
			this.plugin.settings.savedPrompts.forEach((prompt, index) => {
				const setting = new Setting(containerEl)
					.setName(prompt.name)
					.setDesc(`Created: ${new Date(prompt.createdAt).toLocaleDateString()}`)
					.addButton(button => button
						.setButtonText('Edit')
						.onClick(() => {
							new PromptEditModal(this.app, prompt, async (updatedPrompt: SavedPrompt) => {
								this.plugin.settings.savedPrompts[index] = updatedPrompt;
								await this.plugin.saveSettings();
								new Notice('Prompt updated successfully');
								this.display();
							}).open();
						}))
					.addButton(button => button
						.setButtonText('Use This Prompt')
						.onClick(async () => {
							this.plugin.settings.selectedPromptId = prompt.id;
							this.plugin.settings.currentPrompt = prompt.content;
							await this.plugin.saveSettings();
							new Notice(`"${prompt.name}" prompt selected`);
							// Switch to General tab to show the selected prompt
							this.activeTab = 'general';
							this.display();
						}))
					.addButton(button => button
						.setButtonText('Delete')
						.setWarning()
						.onClick(async () => {
							const confirmModal = new ConfirmModal(
								this.app,
								'Delete Prompt',
								`Are you sure you want to delete the prompt "${prompt.name}"?`,
								async () => {
									this.plugin.settings.savedPrompts.splice(index, 1);
									await this.plugin.saveSettings();
									new Notice('Prompt deleted');
									this.display();
								}
							);
							confirmModal.open();
						}));
			});
		} else {
			containerEl.createEl('p', { 
				text: 'No custom prompts created yet. Use the "New Prompt" button above to create one.',
				cls: 'setting-item-description'
			});
		}
	}
}