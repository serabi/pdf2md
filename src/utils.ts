import { TFile } from 'obsidian';
import { PDF2MDSettings } from './types';
import { DefaultPrompt, SavedPrompt } from './types';
import PDF2MDPlugin from '../main';

export function getPromptById(plugin: PDF2MDPlugin, id: string): DefaultPrompt | SavedPrompt | null {
	// Check default prompts first
	const defaultPrompt = plugin.settings.defaultPrompts.find(p => p.id === id);
	if (defaultPrompt) return defaultPrompt;
	
	// Check saved prompts
	const savedPrompt = plugin.settings.savedPrompts.find(p => p.id === id);
	if (savedPrompt) return savedPrompt;
	
	return null;
}

export function getAllPrompts(plugin: PDF2MDPlugin): (DefaultPrompt | SavedPrompt)[] {
	return [...plugin.settings.defaultPrompts, ...plugin.settings.savedPrompts];
}
export function sanitizeFileName(fileName: string): string {
    // Remove or replace characters that are not allowed in Obsidian file names
    // Obsidian doesn't allow: \ / : * ? " < > |
    return fileName
        .replace(/[\\/:*?"<>|]/g, '-') // Replace invalid characters with dash
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim() // Remove leading/trailing whitespace
        .replace(/^\.+/, '') // Remove leading dots
        .replace(/\.+$/, '') // Remove trailing dots
        || 'untitled'; // Fallback if filename becomes empty
}

export function sanitizePath(path: string): string {
    // Sanitize file paths to prevent command injection and directory traversal
    // Remove null bytes, control characters, and potentially dangerous sequences
    return path
        .replace(/\0/g, '') // Remove null bytes
        .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
        .replace(/\.\./g, '') // Remove directory traversal attempts
        .replace(/[;&|`$(){}[\]]/g, '') // Remove shell metacharacters
        .trim();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function getOutputPath(settings: PDF2MDSettings, originalFile: TFile, baseName: string): string {
    if (settings.outputFolder) {
        // Use custom output folder
        const outputFolder = settings.outputFolder.trim();
        return outputFolder.endsWith('/') ? 
            `${outputFolder}${baseName}.md` : 
            `${outputFolder}/${baseName}.md`;
    } else {
        // Use same directory as original file
        return originalFile.parent ? 
            `${originalFile.parent.path}/${baseName}.md` : 
            `${baseName}.md`;
    }
}