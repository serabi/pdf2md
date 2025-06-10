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
		'claude-sonnet-4-20250514',
		'claude-opus-4-20250514',
		'claude-3-5-sonnet-20241022',
		'claude-3-5-sonnet-20240620',
		'claude-3-5-haiku-20241022',
		'claude-3-opus-20240229',
		'claude-3-sonnet-20240229',
		'claude-3-haiku-20240307'
	];
	
	if (!settings.anthropicModels || settings.anthropicModels.length < latestAnthropicModels.length) {
		console.log('[PDF2MD] Updating anthropic models list for existing installation');
		settings.anthropicModels = [...latestAnthropicModels];
	} else {
		latestAnthropicModels.forEach(model => {
			if (!settings.anthropicModels.includes(model)) {
				console.log('[PDF2MD] Adding new model:', model);
				settings.anthropicModels.unshift(model);
			}
		});
	}
}

function validateSelectedModel(settings: PDF2MDSettings): void {
	if (settings.selectedProvider === 'anthropic' && 
		!settings.anthropicModels.includes(settings.selectedModel)) {
		console.log('[PDF2MD] Selected model is invalid:', settings.selectedModel);
		console.log('[PDF2MD] Updating to latest model:', settings.anthropicModels[0]);
		settings.selectedModel = settings.anthropicModels[0];
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