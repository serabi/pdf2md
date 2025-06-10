import * as promptsData from '../prompts.json';

// Types for PDF.js and canvas
export interface PDFPageProxy {
	getViewport(options: { scale: number }): any;
	render(options: { canvasContext: any; viewport: any }): { promise: Promise<void> };
}

export interface PDFDocumentProxy {
	numPages: number;
	getPage(pageNumber: number): Promise<PDFPageProxy>;
}

export interface PDF2MDSettings {
	anthropicApiKey: string;
	ollamaUrl: string;
	selectedModel: string;
	selectedProvider: 'anthropic' | 'ollama';
	currentPrompt: string;
	savedPrompts: SavedPrompt[];
	anthropicModels: string[];
	ollamaModels: string[];
	selectedPromptId: string;
	defaultPrompts: DefaultPrompt[];
	postProcessingTemplate: string;
	enablePostProcessing: boolean;
	watchFolder: string;
	outputFolder: string;
	enableWatching: boolean;
	filenamePattern: string;
	embedPDF: boolean;
	moveProcessedPDFs: boolean;
	processedPDFFolder: string;
}

export interface SavedPrompt {
	id: string;
	name: string;
	content: string;
	createdAt: number;
}

export interface DefaultPrompt {
	id: string;
	name: string;
	content: string;
	isDefault: boolean;
}

// Load default prompts from external JSON file
export const DEFAULT_PROMPTS: DefaultPrompt[] = promptsData.defaultPrompts;

export const DEFAULT_SETTINGS: PDF2MDSettings = {
	anthropicApiKey: '',
	ollamaUrl: 'http://localhost:11434',
	selectedModel: 'claude-3-5-sonnet-20241022',
	selectedProvider: 'anthropic',
	currentPrompt: DEFAULT_PROMPTS[0].content,
	savedPrompts: [],
	anthropicModels: [
		'claude-sonnet-4-20250514',
		'claude-opus-4-20250514',
		'claude-3-7-sonnet-20250219',
		'claude-3-5-sonnet-20241022',
		'claude-3-5-sonnet-20240620',
		'claude-3-5-haiku-20241022',
		'claude-3-opus-20240229',
		'claude-3-sonnet-20240229',
		'claude-3-haiku-20240307'
	],
	ollamaModels: [],
	selectedPromptId: 'image-text-extraction',
	defaultPrompts: DEFAULT_PROMPTS,
	postProcessingTemplate: '---\ntags: [pdf2md, converted]\ndate: {{date}}\n---\n\n{{content}}',
	enablePostProcessing: true,
	watchFolder: '',
	outputFolder: '',
	enableWatching: false,
	filenamePattern: '{{basename}}',
	embedPDF: false,
	moveProcessedPDFs: false,
	processedPDFFolder: 'Processed PDFs'
}