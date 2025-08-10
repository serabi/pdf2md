import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import PDF2MDPlugin from '../../main';
import { ConfirmModal } from './ConfirmModal';
import { PromptEditModal } from './PromptEditModal';
import { PromptViewModal } from './PromptViewModal';
import { SavedPrompt, DefaultPrompt, DEFAULT_PROMPTS, MODEL_DISPLAY_NAMES } from '../types';
import { loadOllamaModels } from '../ai';
import { getAllPrompts, getPromptById } from '../utils';
import { setupFolderWatcher } from '../watcher';
import { runDiagnostics } from '../diagnostics';

export class PDF2MDSettingTab extends PluginSettingTab {
	plugin: PDF2MDPlugin;
	activeTab: string = 'general';

	constructor(app: App, plugin: PDF2MDPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		try {
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
        const ollamaTab = tabContainer.createEl('button', {
            text: 'Ollama',
            cls: this.activeTab === 'ollama' ? 'tab-button active' : 'tab-button'
        });
        const openaiTab = tabContainer.createEl('button', {
            text: 'OpenAI',
            cls: this.activeTab === 'openai' ? 'tab-button active' : 'tab-button'
        });
        const lmstudioTab = tabContainer.createEl('button', {
            text: 'LM Studio',
            cls: this.activeTab === 'lmstudio' ? 'tab-button active' : 'tab-button'
        });

			generalTab.onclick = () => {
				this.activeTab = 'general';
				this.display();
			};

			promptsTab.onclick = () => {
				this.activeTab = 'prompts';
				this.display();
			};
        ollamaTab.onclick = () => {
            this.activeTab = 'ollama';
            this.display();
        };
        openaiTab.onclick = () => {
            this.activeTab = 'openai';
            this.display();
        };
        lmstudioTab.onclick = () => {
            this.activeTab = 'lmstudio';
            this.display();
        };

			// Create content container
			const contentContainer = containerEl.createDiv('tab-content');

        if (this.activeTab === 'general') {
				this.displayGeneralTab(contentContainer);
        } else if (this.activeTab === 'prompts') {
				this.displayPromptsTab(contentContainer);
        } else if (this.activeTab === 'ollama') {
            this.displayOllamaTab(contentContainer);
        } else if (this.activeTab === 'openai') {
            // OpenAI settings
            new Setting(contentContainer)
                .setName('OpenAI API Key')
                .setDesc('Enter your OpenAI API key')
                .addText(text => text
                    .setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.openaiApiKey || '')
                    .onChange(async (value) => {
                        this.plugin.settings.openaiApiKey = value;
                        await this.plugin.saveSettings();
                    })
                    .inputEl.type = 'password');

            new Setting(contentContainer)
                .setName('Base URL')
                .setDesc('Optional. For Azure or OpenAI-compatible endpoints')
                .addText(text => text
                    .setPlaceholder('https://api.openai.com')
                    .setValue(this.plugin.settings.openaiBaseUrl || 'https://api.openai.com')
                    .onChange(async (value) => {
                        this.plugin.settings.openaiBaseUrl = value.trim();
                        await this.plugin.saveSettings();
                    }));

            new Setting(contentContainer)
                .setName('Organization ID (optional)')
                .setDesc('OpenAI organization header')
                .addText(text => text
                    .setPlaceholder('org_...')
                    .setValue(this.plugin.settings.openaiOrganization || '')
                    .onChange(async (value) => {
                        this.plugin.settings.openaiOrganization = value.trim();
                        await this.plugin.saveSettings();
                    }));

            new Setting(contentContainer)
                .setName('Temperature')
                .setDesc('0.0–1.0')
                .addText(text => text
                    .setPlaceholder('0.2')
                    .setValue(String(this.plugin.settings.openaiTemperature ?? 0.2))
                    .onChange(async (value) => {
                        const num = Math.max(0, Math.min(1, parseFloat(value || '0.2') || 0.2));
                        this.plugin.settings.openaiTemperature = num;
                        await this.plugin.saveSettings();
                    }));

            new Setting(contentContainer)
                .setName('Max tokens')
                .setDesc('Upper bound for generation')
                .addText(text => text
                    .setPlaceholder('2048')
                    .setValue(String(this.plugin.settings.openaiMaxTokens ?? 2048))
                    .onChange(async (value) => {
                        const num = Math.max(64, Math.min(8192, parseInt(value || '2048', 10) || 2048));
                        this.plugin.settings.openaiMaxTokens = num;
                        await this.plugin.saveSettings();
                    }));
        } else if (this.activeTab === 'lmstudio') {
            // LM Studio settings (OpenAI-compatible)
            new Setting(contentContainer)
                .setName('LM Studio Base URL')
                .setDesc('Enter the LM Studio API URL (e.g., http://10.0.0.97:1234)')
                .addText(text => text
                    .setPlaceholder('http://localhost:1234')
                    .setValue(this.plugin.settings.lmstudioBaseUrl || 'http://localhost:1234')
                    .onChange(async (value) => {
                        this.plugin.settings.lmstudioBaseUrl = value.trim();
                        await this.plugin.saveSettings();
                    }));

            new Setting(contentContainer)
                .setName('API Key (optional)')
                .setDesc('Only if your LM Studio server requires it')
                .addText(text => text
                    .setPlaceholder('lm-...')
                    .setValue(this.plugin.settings.lmstudioApiKey || '')
                    .onChange(async (value) => {
                        this.plugin.settings.lmstudioApiKey = value;
                        await this.plugin.saveSettings();
                    })
                    .inputEl.type = 'password');

            // Tools: Refresh models / Test Connection
            new Setting(contentContainer)
                .setName('LM Studio Tools')
                .setDesc('Connectivity and model listing')
                .addButton(button => button
                    .setButtonText('Refresh Models')
                    .onClick(async () => {
                        try {
                            const { getProvider } = await import('../providers');
                            const provider = getProvider('lmstudio');
                            const ok = provider.loadModels ? await provider.loadModels(this.plugin) : false;
                            new Notice(ok ? 'LM Studio models loaded' : 'Failed to load LM Studio models');
                            this.display();
                        } catch {
                            new Notice('LM Studio refresh unavailable');
                        }
                    }))
                .addButton(button => button
                    .setButtonText('Test Connection')
                    .onClick(async () => {
                        try {
                            const { getProvider } = await import('../providers');
                            const provider = getProvider('lmstudio');
                            const ok = provider.testConnection ? await provider.testConnection(this.plugin) : false;
                            new Notice(ok ? 'LM Studio connection OK' : 'LM Studio connection failed');
                        } catch {
                            new Notice('LM Studio connection test unavailable');
                        }
                    }));

            {
                const models = this.plugin.settings.lmstudioModels || [];
                const visionList = new Set(this.plugin.settings.lmstudioVisionModels || []);
                if (models.length > 0) {
                    new Setting(contentContainer)
                        .setName('Model')
                        .setDesc('Select a model discovered from LM Studio')
                        .addDropdown(dropdown => {
                            const labelVision = (m: string) => (visionList.has(m) ? `${m} (vision)` : m);
                            models.forEach(model => dropdown.addOption(model, labelVision(model)));
                            dropdown
                                .setValue(this.plugin.settings.selectedModel)
                                .onChange(async (value) => {
                                    this.plugin.settings.selectedModel = value;
                                    await this.plugin.saveSettings();
                                });
                        });
                } else {
                    new Setting(contentContainer)
                        .setName('Model')
                        .setDesc('Enter the model ID exposed by LM Studio or refresh models above')
                        .addText(text => text
                            .setPlaceholder('e.g., llama-3.1:8b-instruct-q4_K_M')
                            .setValue(this.plugin.settings.selectedModel)
                            .onChange(async (value) => {
                                this.plugin.settings.selectedModel = value.trim();
                                await this.plugin.saveSettings();
                            }));
                }
            }

            new Setting(contentContainer)
                .setName('Temperature')
                .setDesc('0.0–1.0')
                .addText(text => text
                    .setPlaceholder('0.2')
                    .setValue(String(this.plugin.settings.lmstudioTemperature ?? 0.2))
                    .onChange(async (value) => {
                        const num = Math.max(0, Math.min(1, parseFloat(value || '0.2') || 0.2));
                        this.plugin.settings.lmstudioTemperature = num;
                        await this.plugin.saveSettings();
                    }));

            new Setting(contentContainer)
                .setName('Max tokens')
                .setDesc('Upper bound for generation')
                .addText(text => text
                    .setPlaceholder('2048')
                    .setValue(String(this.plugin.settings.lmstudioMaxTokens ?? 2048))
                    .onChange(async (value) => {
                        const num = Math.max(64, Math.min(8192, parseInt(value || '2048', 10) || 2048));
                        this.plugin.settings.lmstudioMaxTokens = num;
                        await this.plugin.saveSettings();
                    }));
        }
        } catch (e) {
			console.error('[PDF2MD] Settings render error:', (e as any)?.message, e);
			try {
				this.containerEl.empty();
				this.containerEl.createEl('h2', { text: 'PDF to Markdown Settings' });
				this.containerEl.createEl('p', { text: 'Failed to render settings UI. See console for details.' });
			} catch {}
        }

    }

    displayGeneralTab(containerEl: HTMLElement): void {
		// AI Provider Selection
		new Setting(containerEl)
			.setName('AI Provider')
            .setDesc('Choose AI provider')
            .addDropdown(dropdown => dropdown
				.addOption('anthropic', 'Anthropic Claude')
				.addOption('ollama', 'Ollama (Local)')
                .addOption('openai', 'OpenAI')
                .addOption('lmstudio', 'LM Studio')
				.setValue(this.plugin.settings.selectedProvider)
                .onChange(async (value: 'anthropic' | 'ollama' | 'openai' | 'openrouter' | 'lmstudio') => {
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
                        } else if (value === 'openai') {
                            const p = getPromptById(this.plugin, 'image-text-extraction');
                            if (p) {
                                this.plugin.settings.selectedPromptId = p.id;
                                this.plugin.settings.currentPrompt = p.content;
                            }
                        } else if (value === 'lmstudio') {
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
        } else if (this.plugin.settings.selectedProvider === 'ollama') {
			// Ollama settings moved to Ollama tab

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

            // Note for Ollama advanced settings location
            containerEl.createEl('p', {
                text: 'For advanced Ollama options, see the Ollama settings tab.',
                cls: 'setting-item-description'
            });
        } else if (this.plugin.settings.selectedProvider === 'openai') {
            // OpenAI minimal model selector (manual entry)
            new Setting(containerEl)
                .setName('OpenAI Model')
                .setDesc('Enter an OpenAI chat/vision model (e.g., gpt-4o)')
                .addText(text => text
                    .setPlaceholder('gpt-4o')
                    .setValue(this.plugin.settings.selectedModel)
                    .onChange(async (value) => {
                        this.plugin.settings.selectedModel = value.trim();
                        await this.plugin.saveSettings();
                    }));
        } else if (this.plugin.settings.selectedProvider === 'lmstudio') {
            // LM Studio model selector (dropdown if available)
            const models = this.plugin.settings.lmstudioModels || [];
            const visionList = new Set(this.plugin.settings.lmstudioVisionModels || []);
            if (models.length > 0) {
                new Setting(containerEl)
                    .setName('LM Studio Model')
                    .setDesc('Select a model discovered from LM Studio')
                    .addDropdown(dropdown => {
                        const labelVision = (m: string) => (visionList.has(m) ? `${m} (vision)` : m);
                        models.forEach(model => dropdown.addOption(model, labelVision(model)));
                        dropdown
                            .setValue(this.plugin.settings.selectedModel)
                            .onChange(async (value) => {
                                this.plugin.settings.selectedModel = value;
                                await this.plugin.saveSettings();
                            });
                    });
            } else {
                new Setting(containerEl)
                    .setName('LM Studio Model')
                    .setDesc('Enter the model ID exposed by LM Studio or refresh models from the LM Studio tab')
                    .addText(text => text
                        .setPlaceholder('e.g., llama-3.1:8b-instruct-q4_K_M')
                        .setValue(this.plugin.settings.selectedModel)
                        .onChange(async (value) => {
                            this.plugin.settings.selectedModel = value.trim();
                            await this.plugin.saveSettings();
                        }));
            }
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

		// OCR (Tesseract)
		containerEl.createEl('h3', { text: 'OCR (Tesseract) Fallback' });

		new Setting(containerEl)
			.setName('Tesseract binary path (optional)')
			.setDesc('If set, use this path to Tesseract; otherwise the system PATH is used')
			.addText(text => text
				.setPlaceholder('/usr/bin/tesseract or C\\\:\\Program Files\\Tesseract-OCR\\tesseract.exe')
				.setValue(this.plugin.settings.tesseractPath || '')
				.onChange(async (value) => {
					this.plugin.settings.tesseractPath = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Languages')
			.setDesc('Tesseract language codes (e.g., eng, eng+por)')
			.addText(text => text
				.setPlaceholder('eng')
				.setValue(this.plugin.settings.tesseractLanguages || 'eng')
				.onChange(async (value) => {
					this.plugin.settings.tesseractLanguages = value.trim() || 'eng';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('OEM (engine mode)')
			.setDesc('0=Legacy, 1=LSTM (default), 2=Legacy+LSTM, 3=Default')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(String(this.plugin.settings.tesseractOEM ?? 1))
				.onChange(async (value) => {
					const num = Math.max(0, Math.min(3, parseInt(value || '1', 10) || 1));
					this.plugin.settings.tesseractOEM = num;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('PSM (page segmentation)')
			.setDesc('Common: 6 (block of text). Try 4 for columns, 7 for single line.')
			.addText(text => text
				.setPlaceholder('6')
				.setValue(String(this.plugin.settings.tesseractPSM ?? 6))
				.onChange(async (value) => {
					const num = Math.max(0, Math.min(13, parseInt(value || '6', 10) || 6));
					this.plugin.settings.tesseractPSM = num;
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

        // Multi-pass refinement
        containerEl.createEl('h3', { text: 'AI Multi-pass Refinement' });

        new Setting(containerEl)
            .setName('Enable multi-pass')
            .setDesc('Run additional AI cleanup/refinement passes on the initial Markdown')
            .addToggle(toggle => toggle
                .setValue(Boolean(this.plugin.settings.enableMultiPass))
                .onChange(async (value) => {
                    this.plugin.settings.enableMultiPass = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.enableMultiPass) {
            new Setting(containerEl)
                .setName('Pass 2 prompt')
                .setDesc('Prompt used to clean and normalize the initial Markdown')
                .addTextArea(text => text
                    .setPlaceholder('Enter a refinement prompt for pass 2')
                    .setValue(this.plugin.settings.pass2Prompt || '')
                    .onChange(async (value) => {
                        this.plugin.settings.pass2Prompt = value;
                        await this.plugin.saveSettings();
                    }))
                .then(setting => {
                    const textarea = setting.controlEl.querySelector('textarea')!;
                    textarea.rows = 4;
                    textarea.style.minHeight = '80px';
                    textarea.style.fontFamily = 'var(--font-monospace)';
                });

            new Setting(containerEl)
                .setName('Enable third pass')
                .setDesc('Run an optional third pass for structural improvements')
                .addToggle(toggle => toggle
                    .setValue(Boolean(this.plugin.settings.enableThirdPass))
                    .onChange(async (value) => {
                        this.plugin.settings.enableThirdPass = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.enableThirdPass) {
                new Setting(containerEl)
                    .setName('Pass 3 prompt')
                    .setDesc('Prompt used to improve structure, headings, and tables')
                    .addTextArea(text => text
                        .setPlaceholder('Enter a refinement prompt for pass 3')
                        .setValue(this.plugin.settings.pass3Prompt || '')
                        .onChange(async (value) => {
                            this.plugin.settings.pass3Prompt = value;
                            await this.plugin.saveSettings();
                        }))
                    .then(setting => {
                        const textarea = setting.controlEl.querySelector('textarea')!;
                        textarea.rows = 4;
                        textarea.style.minHeight = '80px';
                        textarea.style.fontFamily = 'var(--font-monospace)';
                    });
            }
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

	displayOllamaTab(containerEl: HTMLElement): void {
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

		// Ollama Tools (Refresh / Test / Diagnostics)
		new Setting(containerEl)
			.setName('Ollama Tools')
			.setDesc('Connectivity, models, and health checks')
			.addButton(button => button
				.setButtonText('Refresh Models')
				.onClick(async () => {
					const success = await loadOllamaModels(this.plugin);
					if (success) new Notice('Ollama models loaded successfully');
					else new Notice('Failed to connect to Ollama. Please ensure it is running.');
					this.display();
				}))
			.addButton(button => button
				.setButtonText('Test Connection')
				.onClick(async () => {
					try {
						const { getProvider } = await import('../providers');
						const provider = getProvider('ollama');
						const ok = provider.testConnection ? await provider.testConnection(this.plugin) : false;
						new Notice(ok ? 'Ollama connection OK' : 'Ollama connection failed');
					} catch {
						new Notice('Ollama connection test unavailable');
					}
				}))
			.addButton(button => button
				.setButtonText('Run Diagnostics')
				.onClick(async () => {
					try {
						const res = await runDiagnostics(this.plugin);
						const lines = [
							`Provider: ${res.provider}`,
							`Provider connection: ${res.providerConnectionOk ? 'OK' : 'FAIL'}`,
							res.modelsCount !== undefined ? `Models: ${res.modelsCount}` : '',
							`Tiny test: ${res.tinyTestOk === undefined ? 'N/A' : (res.tinyTestOk ? 'OK' : 'FAIL')}`,
							`Poppler: ${res.popplerOk ? 'OK' : 'Missing'}`,
							`Tesseract: ${res.tesseractOk ? 'OK' : 'Missing'}`,
							...(res.messages || [])
						].filter(Boolean);
						new Notice(lines.join('\n'), 8000);
					} catch (e) {
						new Notice('Diagnostics failed');
					}
				}));

		// Advanced Ollama Settings (moved from General)
		containerEl.createEl('h3', { text: 'Advanced' });
		// Reuse existing advanced controls by calling the tail of displayGeneralTab
		// Model selection control
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

			// Warning if non-vision model selected
			const selected = this.plugin.settings.selectedModel || '';
			const isVision = (this.plugin.settings.ollamaVisionModels || []).includes(selected) || /llava|bakllava|moondream|qwen[- ]?vl|qwenvl|minicpm|yi[- ]?vl|phi-3-vision/i.test(selected);
			if (!isVision && !this.plugin.settings.ollamaAssumeVision) {
				containerEl.createEl('p', {
					text: `Selected model may not support images. Enable "Assume model supports vision" to force, or choose a vision-capable model (e.g., llava).`,
					cls: 'setting-item-description mod-warning'
				});
			}
		} else {
			containerEl.createEl('p', { 
				text: 'No Ollama models found. Click "Refresh Models" above to load models from your Ollama instance.',
				cls: 'setting-item-description mod-warning'
			});
		}

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
			.setDesc('Request streaming responses from Ollama')
			.addToggle(toggle => toggle
				.setValue(Boolean(this.plugin.settings.ollamaEnableStreaming))
				.onChange(async (value) => {
					this.plugin.settings.ollamaEnableStreaming = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max tokens (num_predict)')
			.setDesc('Limit tokens generated per chunk (e.g., 512–2048)')
			.addText(text => text
				.setPlaceholder('1024')
				.setValue(String(this.plugin.settings.ollamaNumPredict ?? 1024))
				.onChange(async (value) => {
					const num = Math.max(64, Math.min(4096, parseInt(value || '1024', 10) || 1024));
					this.plugin.settings.ollamaNumPredict = num;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Lower = more deterministic (0.0–1.0)')
			.addText(text => text
				.setPlaceholder('0.2')
				.setValue(String(this.plugin.settings.ollamaTemperature ?? 0.2))
				.onChange(async (value) => {
					const num = Math.max(0, Math.min(1, parseFloat(value || '0.2') || 0.2));
					this.plugin.settings.ollamaTemperature = num;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable text-only fallback')
			.setDesc('If image processing fails or model lacks vision, try a conservative text-only cleanup (Tesseract)')
			.addToggle(toggle => toggle
				.setValue(Boolean(this.plugin.settings.ollamaTextFallbackEnabled))
				.onChange(async (value) => {
					this.plugin.settings.ollamaTextFallbackEnabled = value;
					await this.plugin.saveSettings();
				}));
	}
}