import { PDF2MDSettings, DEFAULT_SETTINGS, DEFAULT_PROMPTS } from './types';
import { loadOllamaModels } from './ai';
import { getPromptById } from './utils';
import { setupFolderWatcher } from './watcher';
import type PDF2MDPlugin from '../main';

export async function initializeSettings(plugin: PDF2MDPlugin): Promise<void> {
	plugin.settings = Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());
	
	initializeDefaultPrompts(plugin.settings);
	migrateAnthropicModels(plugin.settings);
	validateSelectedModel(plugin.settings);
    updateCurrentPrompt(plugin, plugin.settings);
	
	await loadOllamaModelsIfConfigured(plugin);
	setupWatcherIfEnabled(plugin);
	
	console.log('[PDF2MD] Settings loaded successfully');
}

function initializeDefaultPrompts(settings: PDF2MDSettings): void {
	if (!settings.defaultPrompts || settings.defaultPrompts.length === 0) {
		settings.defaultPrompts = [...DEFAULT_PROMPTS];
	} else {
		const defaultIds = DEFAULT_PROMPTS.map(p => p.id);
		settings.defaultPrompts = settings.defaultPrompts.filter(p => 
			defaultIds.includes(p.id) || !p.isDefault
		);
		
		DEFAULT_PROMPTS.forEach(defaultPrompt => {
			const exists = settings.defaultPrompts.find(p => p.id === defaultPrompt.id);
			if (!exists) {
				settings.defaultPrompts.push({...defaultPrompt});
			}
		});
	}
}

function migrateAnthropicModels(settings: PDF2MDSettings): void {
	const latestAnthropicModels = [
		'claude-sonnet-4-0',
		'claude-opus-4-0',
		'claude-3-7-sonnet-latest',
		'claude-3-5-sonnet-latest'
	];
	
	// Always replace the entire array to ensure clean migration from old date-based models
	const currentModels = settings.anthropicModels || [];
	const hasOldModels = currentModels.some(model => 
		model.includes('20240') || model.includes('20250') || model.includes('claude-3-haiku') || model.includes('claude-3-opus') || model.includes('claude-3-sonnet')
	);
	
	if (!settings.anthropicModels || hasOldModels || !arraysEqual(currentModels, latestAnthropicModels)) {
		console.log('[PDF2MD] Migrating to simplified anthropic models list');
		settings.anthropicModels = [...latestAnthropicModels];
	}
}

function arraysEqual(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((val, i) => val === b[i]);
}

function validateSelectedModel(settings: PDF2MDSettings): void {
	if (settings.selectedProvider === 'anthropic' && 
		!settings.anthropicModels.includes(settings.selectedModel)) {
		console.log('[PDF2MD] Selected model is invalid:', settings.selectedModel);
		// Migrate old date-based models to new aliases
		if (settings.selectedModel.includes('claude-sonnet-4-')) {
			settings.selectedModel = 'claude-sonnet-4-0';
		} else if (settings.selectedModel.includes('claude-opus-4-')) {
			settings.selectedModel = 'claude-opus-4-0';
		} else if (settings.selectedModel.includes('claude-3-7-sonnet')) {
			settings.selectedModel = 'claude-3-7-sonnet-latest';
		} else if (settings.selectedModel.includes('claude-3-5-sonnet')) {
			settings.selectedModel = 'claude-3-5-sonnet-latest';
		} else {
			console.log('[PDF2MD] Updating to latest model:', settings.anthropicModels[0]);
			settings.selectedModel = settings.anthropicModels[0];
		}
	}
}

function updateCurrentPrompt(plugin: PDF2MDPlugin, settings: PDF2MDSettings): void {
	if (settings.selectedPromptId) {
		const selectedPrompt = getPromptById(plugin, settings.selectedPromptId);
		if (selectedPrompt) {
			settings.currentPrompt = selectedPrompt.content;
		} else {
			settings.selectedPromptId = '';
		}
	}
}

async function loadOllamaModelsIfConfigured(plugin: PDF2MDPlugin): Promise<void> {
	if (plugin.settings.ollamaUrl) {
		console.log('[PDF2MD] Loading Ollama models from:', plugin.settings.ollamaUrl);
		await loadOllamaModels(plugin);
	}
}

function setupWatcherIfEnabled(plugin: PDF2MDPlugin): void {
	if (plugin.settings.enableWatching && plugin.settings.watchFolder) {
		setupFolderWatcher(plugin);
	}
}