import { TFile, Notice } from 'obsidian';
import { ConfirmModal } from './ui/ConfirmModal';
import type PDF2MDPlugin from '../main';
import { processWithAI } from './ai';
import { reportProgress } from './progress';
import { extractImagesFromPDF } from './pdf';
import { getOutputPath, sanitizeFileName, arrayBufferToBase64, generateFilename } from './utils';

export async function processPDF(plugin: PDF2MDPlugin, file: TFile) {
    try {
        new Notice('PDF2MD: Step 1 — Extracting page images');
        if (plugin.settings.selectedProvider === 'anthropic' && !plugin.settings.anthropicApiKey) {
            new Notice('Please set your Anthropic API key in settings');
            return;
        }
        const arrayBuffer = await plugin.app.vault.readBinary(file);
        
        // Step 1: Extract images from PDF
        console.log('[PDF2MD] Step 1: Extracting images from PDF...');
        const pdfImages = await extractImagesFromPDF(arrayBuffer, plugin.settings);
        if (!pdfImages || pdfImages.length === 0) {
            console.error('[PDF2MD] Failed to extract images from PDF');
            new Notice('Failed to extract images from PDF. Try using the "Process Images" option instead.', 8000);
            return;
        }
        console.log('[PDF2MD] Step 1 complete: Extracted', pdfImages.length, 'images from PDF');
        
        // Continue with AI processing
        await processImagesWithAI(plugin, pdfImages, file);
    } catch (error) {
        console.error('[PDF2MD] Critical error in processPDF:', error);
        console.error('[PDF2MD] Error stack:', error.stack);
        new Notice('Failed to process PDF: ' + error.message);
    }
}

export async function processImages(plugin: PDF2MDPlugin, imageFiles: TFile[]) {
    try {
        new Notice('Processing images...');
        if (plugin.settings.selectedProvider === 'anthropic' && !plugin.settings.anthropicApiKey) {
            new Notice('Please set your Anthropic API key in settings');
            return;
        }

        // Convert image files to base64 data URLs
        console.log('[PDF2MD] Step 1: Converting image files to data URLs...');
        const imageDataUrls: string[] = [];
        
        for (const imageFile of imageFiles) {
            const arrayBuffer = await plugin.app.vault.readBinary(imageFile);
            
            // Detect image type from file extension
            let mimeType = 'image/png';
            if (imageFile.extension.toLowerCase() === 'jpg' || imageFile.extension.toLowerCase() === 'jpeg') {
                mimeType = 'image/jpeg';
            } else if (imageFile.extension.toLowerCase() === 'webp') {
                mimeType = 'image/webp';
            }
            
            // Convert to base64
            const base64 = arrayBufferToBase64(arrayBuffer);
            const dataUrl = `data:${mimeType};base64,${base64}`;
            imageDataUrls.push(dataUrl);
            
            console.log(`[PDF2MD] Converted ${imageFile.name} (${arrayBuffer.byteLength} bytes) to data URL`);
        }
        
        console.log('[PDF2MD] Step 1 complete: Converted', imageDataUrls.length, 'images');
        
        // Use first image file for naming the output
        const baseFile = imageFiles[0];
        await processImagesWithAI(plugin, imageDataUrls, baseFile);
    } catch (error) {
        console.error('[PDF2MD] Critical error in processImages:', error);
        console.error('[PDF2MD] Error stack:', error.stack);
        new Notice('Failed to process images: ' + error.message);
    }
}

export async function processImagesWithAI(plugin: PDF2MDPlugin, images: string[], sourceFile: TFile) {
    try {
        // Step 2: Initial AI processing with main prompt
        console.log('[PDF2MD] Step 2: Initial AI processing with provider:', plugin.settings.selectedProvider);
        new Notice(`PDF2MD: Step 2 — AI processing with ${plugin.settings.selectedProvider}`);
        reportProgress({ phase: 'status', message: 'Sending images to AI provider' });
        const initialMarkdown = await processWithAI(plugin.settings, images, plugin.settings.currentPrompt);
        if (!initialMarkdown) {
            console.error('[PDF2MD] Failed initial AI processing');
            new Notice('Failed to process images with AI');
            return;
        }
        console.log('[PDF2MD] Step 2 complete: Initial AI processing done, markdown length:', initialMarkdown.length);
        
        let finalMarkdown = initialMarkdown;

        // Optional Multi-pass AI refinement
        if (plugin.settings.enableMultiPass) {
            try {
                console.log('[PDF2MD] Multi-pass: running pass 2 refinement');
                reportProgress({ phase: 'status', message: 'Refinement pass 2' });
                const pass2Prompt = plugin.settings.pass2Prompt || 'Clean and normalize the following Markdown. Only return the improved Markdown.\n\nInput:';
                const pass2Input = `${pass2Prompt}\n\n${finalMarkdown}`;
                const refined = await (await import('./ai')).processWithAI(plugin.settings, [], pass2Input);
                if (refined && refined.trim().length > 0) {
                    finalMarkdown = refined;
                }

                if (plugin.settings.enableThirdPass) {
                    console.log('[PDF2MD] Multi-pass: running pass 3 refinement');
                    reportProgress({ phase: 'status', message: 'Refinement pass 3' });
                    const pass3Prompt = plugin.settings.pass3Prompt || 'Improve structure, headings, and tables. Only return the improved Markdown.\n\nInput:';
                    const pass3Input = `${pass3Prompt}\n\n${finalMarkdown}`;
                    const refined3 = await (await import('./ai')).processWithAI(plugin.settings, [], pass3Input);
                    if (refined3 && refined3.trim().length > 0) {
                        finalMarkdown = refined3;
                    }
                }
            } catch (e) {
                console.warn('[PDF2MD] Multi-pass refinement failed; continuing with current markdown');
            }
        }
        
        // Step 3: Post-processing (if enabled)
        if (plugin.settings.enablePostProcessing) {
            console.log('[PDF2MD] Step 3: Post-processing markdown...');
            new Notice('PDF2MD: Step 3 — Post-processing');
            reportProgress({ phase: 'status', message: 'Post-processing markdown' });
            try {
                const postProcessedMarkdown = await postProcessMarkdown(plugin, finalMarkdown);
                if (postProcessedMarkdown) {
                    finalMarkdown = postProcessedMarkdown;
                    console.log('[PDF2MD] Step 3 complete: Post-processing successful, length:', finalMarkdown.length);
                } else {
                    console.warn('[PDF2MD] Step 3 warning: Post-processing failed, using original markdown');
                }
            } catch (error) {
                console.error('[PDF2MD] Step 3 error:', error);
                console.warn('[PDF2MD] Continuing with original markdown due to post-processing error');
            }
        } else {
            console.log('[PDF2MD] Step 3 skipped: Post-processing disabled');
        }
        
        // Step 3.5: Add PDF embed if enabled
        if (plugin.settings.embedPDF) {
            finalMarkdown += `\n\n![[${sourceFile.name}]]`;
            console.log('[PDF2MD] Added PDF embed to markdown');
        }
        
        // Step 4: Create final markdown file
        console.log('[PDF2MD] Step 4: Creating final markdown file...');
        new Notice('PDF2MD: Step 4 — Writing output');
        reportProgress({ phase: 'status', message: 'Writing output file' });
        const generatedFilename = generateFilename(plugin.settings.filenamePattern, sourceFile.basename);
        const sanitizedBasename = sanitizeFileName(generatedFilename);
        const mdFilePath = getOutputPath(plugin.settings, sourceFile, sanitizedBasename);
        console.log('[PDF2MD] Output file path:', mdFilePath);
        
        const existingFile = plugin.app.vault.getAbstractFileByPath(mdFilePath);
        if (existingFile) {
            console.log('[PDF2MD] File already exists:', mdFilePath);
            new ConfirmModal(
                plugin.app,
                'File already exists',
                `${sanitizedBasename}.md already exists. Do you want to overwrite it?`,
                async () => {
                    console.log('[PDF2MD] Step 4: Overwriting existing file...');
                    await plugin.app.vault.modify(existingFile as TFile, finalMarkdown);
                    new Notice('Markdown file updated successfully');
                    console.log('[PDF2MD] Step 4 complete: File updated successfully');
                    
                    // Step 5: Move processed PDF if enabled
                    if (plugin.settings.moveProcessedPDFs && plugin.settings.processedPDFFolder) {
                        await moveProcessedPDF(plugin, sourceFile);
                    }
                }
            ).open();
        } else {
            console.log('[PDF2MD] Step 4: Creating new file...');
            
            // Check if file exists and add number suffix if needed
            let finalPath = mdFilePath;
            let counter = 1;
            
            while (await plugin.app.vault.adapter.exists(finalPath)) {
                const pathParts = mdFilePath.split('.');
                const incrementedFilename = generateFilename(plugin.settings.filenamePattern, `${sourceFile.basename} ${counter}`);
                const sanitizedIncrementedName = sanitizeFileName(incrementedFilename);
                pathParts[pathParts.length - 2] = sanitizedIncrementedName;
                finalPath = pathParts.join('.');
                counter++;
                console.log(`[PDF2MD] File exists, trying: ${finalPath}`);
            }
            
            await plugin.app.vault.create(finalPath, finalMarkdown);
            new Notice('Markdown file created successfully');
            console.log(`[PDF2MD] Step 4 complete: File created at ${finalPath}`);
        }
        
        // Step 5: Move processed PDF if enabled
        if (plugin.settings.moveProcessedPDFs && plugin.settings.processedPDFFolder) {
            await moveProcessedPDF(plugin, sourceFile);
        }
        
        console.log('[PDF2MD] Processing workflow completed successfully');
        reportProgress({ phase: 'status', message: 'Done' });
    } catch (error) {
        console.error('[PDF2MD] Critical error in processPDF:', error);
        console.error('[PDF2MD] Error stack:', error.stack);
        new Notice('Failed to process PDF: ' + error.message);
    }
}

export async function postProcessMarkdown(plugin: PDF2MDPlugin, markdown: string): Promise<string | null> {
    console.log('[PDF2MD] Starting post-processing with template');
    try {
        // Get current date in YYYY-MM-DD format
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const datetime = now.toISOString();
        
        // Replace placeholders in the template
        let processedContent = plugin.settings.postProcessingTemplate
            .replace(/\{\{content\}\}/g, markdown)
            .replace(/\{\{date\}\}/g, date)
            .replace(/\{\{datetime\}\}/g, datetime)
            .replace(/\{\{time\}\}/g, now.toTimeString().split(' ')[0]);
            
        return processedContent;
    } catch (error) {
        console.error('[PDF2MD] Post-processing error:', error);
        throw error;
    }
}

async function moveProcessedPDF(plugin: PDF2MDPlugin, sourceFile: TFile) {
    try {
        console.log('[PDF2MD] Step 5: Moving processed PDF...');
        
        const processedFolder = plugin.settings.processedPDFFolder;
        
        // Ensure the processed PDF folder exists
        const folderExists = await plugin.app.vault.adapter.exists(processedFolder);
        if (!folderExists) {
            await plugin.app.vault.createFolder(processedFolder);
            console.log(`[PDF2MD] Created folder: ${processedFolder}`);
        }
        
        // Generate the new path for the PDF
        const newPath = `${processedFolder}/${sourceFile.name}`;
        
        // Check if a file with the same name already exists in the destination
        let finalPath = newPath;
        let counter = 1;
        
        while (await plugin.app.vault.adapter.exists(finalPath)) {
            const nameWithoutExt = sourceFile.basename;
            const extension = sourceFile.extension;
            finalPath = `${processedFolder}/${nameWithoutExt} ${counter}.${extension}`;
            counter++;
            console.log(`[PDF2MD] File exists, trying: ${finalPath}`);
        }
        
        // Move the file
        await plugin.app.fileManager.renameFile(sourceFile, finalPath);
        
        console.log(`[PDF2MD] Step 5 complete: PDF moved to ${finalPath}`);
        new Notice(`PDF moved to ${processedFolder}`);
        
    } catch (error) {
        console.error('[PDF2MD] Error moving processed PDF:', error);
        new Notice('Warning: Failed to move processed PDF to designated folder');
    }
}