import { TFile } from 'obsidian';
import { PDF2MDSettings } from './types';
import { DefaultPrompt, SavedPrompt } from './types';
import PDF2MDPlugin from '../main';
import { requestUrl } from 'obsidian';

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

export function generateFilename(pattern: string, originalBasename: string): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const datetime = now.toISOString();
    const time = now.toTimeString().split(' ')[0];
    
    return pattern
        .replace(/\{\{basename\}\}/g, originalBasename)
        .replace(/\{\{date\}\}/g, date)
        .replace(/\{\{datetime\}\}/g, datetime)
        .replace(/\{\{time\}\}/g, time);
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

export async function testPdftoppmPath(userPath?: string): Promise<boolean> {
    try {
        const { spawn } = require('child_process');
        const candidatePaths: string[] = [];
        if (userPath && userPath.trim()) candidatePaths.push(userPath.trim());
        candidatePaths.push('pdftoppm');
        const isWin = process.platform === 'win32';
        if (isWin) {
            candidatePaths.push('C://Program Files//poppler//bin//pdftoppm.exe');
            candidatePaths.push('C://Program Files (x86)//poppler//bin//pdftoppm.exe');
        } else if (process.platform === 'darwin') {
            candidatePaths.push('/opt/homebrew/bin/pdftoppm');
            candidatePaths.push('/usr/local/bin/pdftoppm');
            candidatePaths.push('/usr/bin/pdftoppm');
        } else {
            candidatePaths.push('/usr/bin/pdftoppm');
            candidatePaths.push('/usr/local/bin/pdftoppm');
        }

        for (const p of candidatePaths) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const child = spawn(p, ['-h']);
                    let resolved = false;
                    child.on('error', () => reject(new Error('spawn error')));
                    child.on('close', (code: number) => {
                        if (code === 0 || code === 1) {
                            resolved = true;
                            resolve();
                        } else {
                            reject(new Error('nonzero'));
                        }
                    });
                    setTimeout(() => { if (!resolved) reject(new Error('timeout')); }, 3000);
                });
                return true;
            } catch {}
        }
        return false;
    } catch {
        return false;
    }
}

export async function runTesseract(options: {
    imagePaths: string[];
    tesseractPath?: string;
    languages?: string;
    oem?: number;
    psm?: number;
}): Promise<string> {
    const { spawn } = require('child_process');
    const path = require('path');
    const os = require('os');
    const fs = require('fs').promises;
    const tmpOut = path.join(os.tmpdir(), `pdf2md-ocr-${Date.now()}`);
    const tesseract = options.tesseractPath && options.tesseractPath.trim().length > 0 ? options.tesseractPath : 'tesseract';
    const lang = options.languages || 'eng';
    const oem = typeof options.oem === 'number' ? options.oem : 1;
    const psm = typeof options.psm === 'number' ? options.psm : 6;

    // For multiple images, concatenate OCR results
    let aggregate = '';
    for (let i = 0; i < options.imagePaths.length; i++) {
        const img = options.imagePaths[i];
        const outBase = `${tmpOut}-${i}`;
        const args = [img, outBase, '-l', lang, '--oem', String(oem), '--psm', String(psm), 'txt'];
        await new Promise<void>((resolve, reject) => {
            const proc = spawn(tesseract, args);
            let stderr = '';
            proc.stderr.on('data', (d: any) => { stderr += d.toString(); });
            proc.on('close', async (code: number) => {
                if (code === 0) {
                    try {
                        const txt = await fs.readFile(`${outBase}.txt`, 'utf-8');
                        aggregate += (aggregate ? '\n\n---\n\n' : '') + txt.trim();
                        await fs.unlink(`${outBase}.txt`).catch(() => {});
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(stderr || 'Tesseract failed'));
                }
            });
            proc.on('error', (e: any) => reject(e));
        });
    }
    return aggregate;
}

export async function testTesseractPath(userPath?: string): Promise<boolean> {
    try {
        const { spawn } = require('child_process');
        const candidates: string[] = [];
        if (userPath && userPath.trim()) candidates.push(userPath.trim());
        candidates.push('tesseract');
        const isWin = process.platform === 'win32';
        if (isWin) {
            candidates.push('C://Program Files//Tesseract-OCR//tesseract.exe');
        } else {
            candidates.push('/usr/bin/tesseract');
            candidates.push('/usr/local/bin/tesseract');
        }
        for (const p of candidates) {
            const ok = await new Promise<boolean>((resolve) => {
                try {
                    const child = spawn(p, ['-v']);
                    child.on('error', () => resolve(false));
                    child.on('close', (code: number) => resolve(code === 0 || code === 1));
                    setTimeout(() => resolve(false), 2000);
                } catch {
                    resolve(false);
                }
            });
            if (ok) return true;
        }
        return false;
    } catch {
        return false;
    }
}