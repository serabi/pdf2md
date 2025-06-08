import { TFile, Notice } from 'obsidian';
import PDF2MDPlugin from '../main';
import { processPDF } from './processing';

export function setupFolderWatcher(plugin: PDF2MDPlugin) {
    console.log('[PDF2MD] Setting up folder watcher for:', plugin.settings.watchFolder);
    
    // Remove existing watcher
    if (plugin.fileWatcher) {
        plugin.fileWatcher = null;
    }

    // Setup multiple watchers for different file events
    const watchFolder = plugin.settings.watchFolder.trim();
    console.log('[PDF2MD] Watch folder configured as:', watchFolder);
    
    if (!watchFolder) {
        console.log('[PDF2MD] No watch folder configured, skipping watcher setup');
        return;
    }

    // Helper function to check if file is in watched folder
    const isInWatchFolder = (filePath: string): boolean => {
        // Normalize paths for comparison
        const normalizedFilePath = filePath.replace(/\\/g, '/');
        const normalizedWatchFolder = watchFolder.replace(/\\/g, '/');
        
        console.log('[PDF2MD] Checking file path:', normalizedFilePath, 'against watch folder:', normalizedWatchFolder);
        
        const isMatch = normalizedFilePath.startsWith(normalizedWatchFolder + '/') || 
                        normalizedFilePath === normalizedWatchFolder ||
                        normalizedFilePath.startsWith(normalizedWatchFolder) && normalizedFilePath.charAt(normalizedWatchFolder.length) === '/';
        
        console.log('[PDF2MD] Path match result:', isMatch);
        return isMatch;
    };

    // Helper function to process PDF with logging
    const processPDFWithLogging = (file: TFile, eventType: string) => {
        console.log(`[PDF2MD] ${eventType} PDF detected in watched folder:`, file.path);
        new Notice(`Auto-processing PDF (${eventType}): ${file.name}`, 3000);
        // Process with slight delay to ensure file is fully written
        setTimeout(() => {
            processPDF(plugin, file);
        }, 1000);
    };

    // Setup multiple event watchers
    const watchers: any[] = [];

    // Watch for file creation (new files added)
    watchers.push(plugin.registerEvent(
        plugin.app.vault.on('create', (file) => {
            console.log('[PDF2MD] File created:', file.path, 'Extension:', file instanceof TFile ? file.extension : 'N/A');
            if (file instanceof TFile && file.extension === 'pdf' && isInWatchFolder(file.path)) {
                processPDFWithLogging(file, 'New');
            }
        })
    ));

    // Watch for file moves/renames (files moved into folder)
    watchers.push(plugin.registerEvent(
        plugin.app.vault.on('rename', (file, oldPath) => {
            console.log('[PDF2MD] File renamed/moved from:', oldPath, 'to:', file.path);
            if (file instanceof TFile && file.extension === 'pdf' && isInWatchFolder(file.path)) {
                // Check if it was moved INTO the watch folder (wasn't there before)
                if (!isInWatchFolder(oldPath)) {
                    processPDFWithLogging(file, 'Moved');
                }
            }
        })
    ));

    // Store all watchers
    plugin.fileWatcher = {
        cleanup: () => {
            watchers.forEach(watcher => {
                if (watcher) {
                    // Watchers are automatically cleaned up by registerEvent
                }
            });
        }
    };
    
    console.log('[PDF2MD] Folder watcher set up successfully with create and rename event handlers');
}