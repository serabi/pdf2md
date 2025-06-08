import { Notice } from 'obsidian';
import { PDFDocumentProxy } from './types';
import { sanitizePath } from './utils';

declare global {
	interface Window {
		PDFJS?: any;
	}
	var PDFJS: any;
}

export function configurePDFJS() {
    // Create a minimal worker for PDF.js in Electron environment
    // This approach is more reliable than trying to disable workers completely
    console.log('[PDF2MD] Configuring PDF.js for Electron environment...');
    
    try {
        // Create a minimal worker blob that satisfies PDF.js requirements
        const workerCode = `
            // Minimal PDF.js worker for Electron/Obsidian environment
            self.addEventListener('message', function(e) {
                // Minimal worker that does nothing
                // PDF.js will fall back to main thread execution
                console.log('[PDF2MD Worker] Message received, ignoring in main thread mode');
            });
        `;
        
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        
        // Set up GlobalWorkerOptions on all possible contexts
        const contexts = [window, globalThis, self].filter(ctx => typeof ctx !== 'undefined');
        
        contexts.forEach(ctx => {
            if (ctx) {
                (ctx as any).GlobalWorkerOptions = (ctx as any).GlobalWorkerOptions || {};
                (ctx as any).GlobalWorkerOptions.workerSrc = workerUrl;
                console.log('[PDF2MD] Set GlobalWorkerOptions.workerSrc on context');
            }
        });
        
        // Also set on global if available (Node.js context)
        if (typeof global !== 'undefined') {
            (global as any).GlobalWorkerOptions = (global as any).GlobalWorkerOptions || {};
            (global as any).GlobalWorkerOptions.workerSrc = workerUrl;
        }
        
        console.log('[PDF2MD] PDF.js configured successfully with minimal worker');
    } catch (error) {
        console.error('[PDF2MD] Error configuring PDF.js:', error);
    }
}

export function configurePDFJSWorker(pdfjsLib: any) {
    // Configure worker for a specific PDF.js instance
    try {
        // Create a minimal worker blob that satisfies PDF.js requirements
        const workerCode = `
            // Minimal PDF.js worker for Electron/Obsidian environment
            self.addEventListener('message', function(e) {
                // Minimal worker that does nothing
                console.log('[PDF2MD Worker] Message received, ignoring in main thread mode');
            });
        `;
        
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        
        // Set GlobalWorkerOptions safely
        if (pdfjsLib.GlobalWorkerOptions) {
            // Try to set workerSrc if it's writable
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                console.log('[PDF2MD] Successfully set GlobalWorkerOptions.workerSrc');
            } catch (error) {
                console.log('[PDF2MD] GlobalWorkerOptions.workerSrc is read-only, trying alternative approach');
                // If it's read-only, try to set it on the global object
                if (typeof window !== 'undefined') {
                    (window as any).GlobalWorkerOptions = (window as any).GlobalWorkerOptions || {};
                    (window as any).GlobalWorkerOptions.workerSrc = workerUrl;
                    console.log('[PDF2MD] Set GlobalWorkerOptions on window object');
                }
            }
        } else {
            // Create GlobalWorkerOptions if it doesn't exist
            pdfjsLib.GlobalWorkerOptions = { workerSrc: workerUrl };
            console.log('[PDF2MD] Created new GlobalWorkerOptions');
        }
        
    } catch (error) {
        console.log('[PDF2MD] Could not configure PDF.js worker:', error.message);
    }
}

export async function loadPDFWithProgressiveTimeout(arrayBuffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    // Determine timeouts based on file size and likely content type
    const fileSize = arrayBuffer.byteLength;
    const isLargeFile = fileSize > 10 * 1024 * 1024; // >10MB likely handwriting/scanned
    const timeouts = isLargeFile 
        ? [120000, 300000, 600000] // 2min, 5min, 10min for large/handwriting PDFs
        : [60000, 180000, 300000]; // 1min, 3min, 5min for regular PDFs
    
    console.log(`[PDF2MD] File size: ${(fileSize / 1024 / 1024).toFixed(1)}MB, using ${isLargeFile ? 'extended' : 'standard'} timeouts`);
    
    if (isLargeFile) {
        new Notice('Large PDF detected (possibly handwritten). This may take several minutes...', 8000);
    }
    
    const pdfjsLib = require('pdfjs-dist');
    
    // Ensure worker configuration is set up properly
    console.log('[PDF2MD] Checking PDF.js worker configuration...');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        console.log('[PDF2MD] Worker not configured, setting up minimal worker...');
        // Create a minimal worker blob to satisfy PDF.js requirements
        const workerCode = `
            // Minimal PDF.js worker for Electron environment
            self.addEventListener('message', function(e) {
                // Do nothing - we're running in main thread
            });
        `;
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        console.log('[PDF2MD] Worker configuration set to blob URL');
    } else {
        console.log('[PDF2MD] Worker already configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
    }
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let attempt = 0; attempt < timeouts.length; attempt++) {
        const timeoutMs = timeouts[attempt];
        const timeoutSeconds = Math.round(timeoutMs / 1000);
        
        try {
            console.log(`[PDF2MD] PDF loading attempt ${attempt + 1}/${timeouts.length} with ${timeoutSeconds}s timeout`);
            
            if (attempt > 0) {
                new Notice(`PDF loading taking longer than expected. Trying with ${timeoutSeconds}s timeout (attempt ${attempt + 1}/${timeouts.length})...`, 5000);
            }
            
            // Create a fresh loading task with aggressive Electron-friendly settings
            const loadingTask = pdfjsLib.getDocument({
                data: uint8Array,
                verbosity: 0,
                // Completely disable workers and network features for Electron
                useWorkerFetch: false,
                isEvalSupported: false,
                disableAutoFetch: true,
                disableStream: true,
                disableFontFace: true,
                useSystemFonts: false,
                // Additional Electron-specific configurations
                cMapUrl: null,
                cMapPacked: false,
                disableRange: true,
                disableCreateObjectURL: true,
                // Force synchronous operation
                stopAtErrors: true
            });
            
            // Aggressively disable worker
            loadingTask.worker = null;
            if (loadingTask._transport && loadingTask._transport.messageHandler) {
                loadingTask._transport.messageHandler.destroy();
            }
            
            const pdfPromise = Promise.race([
                loadingTask.promise,
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error(`PDF loading timeout after ${timeoutSeconds} seconds`)), timeoutMs)
                )
            ]);
            
            const pdf = await pdfPromise as PDFDocumentProxy;
            console.log(`[PDF2MD] PDF loaded successfully on attempt ${attempt + 1}`);
            return pdf;
            
        } catch (error) {
            console.log(`[PDF2MD] Attempt ${attempt + 1} failed:`, error.message);
            
            // If this is the last attempt, throw the error
            if (attempt === timeouts.length - 1) {
                console.error(`[PDF2MD] All ${timeouts.length} loading attempts failed`);
                throw new Error(`PDF loading failed after ${timeouts.length} attempts. Last error: ${error.message}. This may be due to a corrupted PDF, very large file size, or complex content. Try reducing the PDF file size or splitting into smaller documents.`);
            }
            
            // Brief pause before next attempt
            console.log(`[PDF2MD] Waiting 2 seconds before retry attempt ${attempt + 2}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // This should never be reached due to the throw in the last attempt
    throw new Error('Unexpected error in progressive PDF loading');
}

export async function loadPDFWithFallback(arrayBuffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    console.log('[PDF2MD] Trying multiple PDF loading strategies...');
    
    // Strategy 1: Ultra-minimal PDF.js configuration
    try {
        console.log('[PDF2MD] Strategy 1: Ultra-minimal PDF.js configuration');
        return await loadPDFMinimal(arrayBuffer);
    } catch (minimalError) {
        console.log('[PDF2MD] Strategy 1 failed:', minimalError.message);
    }
    
    // Strategy 2: Direct PDF.js with forced synchronous operation
    try {
        console.log('[PDF2MD] Strategy 2: Forced synchronous PDF.js');
        return await loadPDFSynchronous(arrayBuffer);
    } catch (syncError) {
        console.log('[PDF2MD] Strategy 2 failed:', syncError.message);
    }
    
    // Strategy 3: Alternative PDF.js mode with different options
    try {
        console.log('[PDF2MD] Strategy 3: Alternative PDF.js configuration');
        return await loadPDFAlternative(arrayBuffer);
    } catch (altError) {
        console.log('[PDF2MD] Strategy 3 failed:', altError.message);
    }
    
    // Strategy 4: Progressive timeout method (original)
    try {
        console.log('[PDF2MD] Strategy 4: Progressive timeout method');
        return await loadPDFWithProgressiveTimeout(arrayBuffer);
    } catch (progressiveError) {
        console.log('[PDF2MD] Strategy 4 failed:', progressiveError.message);
    }
    
    // All strategies failed
    throw new Error('All PDF loading strategies failed. This PDF may be corrupted, too complex, or incompatible with the Electron environment.');
}

export async function loadPDFMinimal(arrayBuffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    console.log('[PDF2MD] Loading PDF with minimal configuration...');
    
    const pdfjsLib = require('pdfjs-dist');
    
    // Configure worker properly for Electron environment
    configurePDFJSWorker(pdfjsLib);
    console.log('[PDF2MD] Worker configured for minimal loading');
    
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log('[PDF2MD] PDF data size:', uint8Array.length, 'bytes');
    
    // Absolutely minimal configuration
    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        verbosity: 0, // Silence all logging
        // Disable everything possible
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
        disableFontFace: true,
        useSystemFonts: true,
        disableRange: true,
        disableCreateObjectURL: true,
        stopAtErrors: false, // Try to continue even with errors
        maxImageSize: -1, // No image size limit
        cMapUrl: null,
        cMapPacked: false,
        standardFontDataUrl: null
    });
    
    // Aggressively disable worker
    try {
        loadingTask.worker = null;
        if (loadingTask._transport && loadingTask._transport.messageHandler) {
            loadingTask._transport.messageHandler.destroy();
        }
    } catch (error) {
        console.log('[PDF2MD] Could not disable worker, continuing:', error.message);
    }
    
    console.log('[PDF2MD] Attempting minimal PDF load with 15s timeout...');
    const pdf = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Minimal PDF loading timeout')), 15000)
        )
    ]) as PDFDocumentProxy;
    
    console.log('[PDF2MD] Minimal PDF loading successful, pages:', pdf.numPages);
    return pdf;
}

export async function loadPDFSynchronous(arrayBuffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    console.log('[PDF2MD] Loading PDF with synchronous method...');
    
    const pdfjsLib = require('pdfjs-dist');
    
    // Configure worker properly for Electron environment
    configurePDFJSWorker(pdfjsLib);
    console.log('[PDF2MD] Worker configured for synchronous loading');
    
    // Try to force synchronous operation
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Create loading task with sync-friendly settings
    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        verbosity: 0,
        // Force sync operation
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
        disableRange: true,
        stopAtErrors: false,
        disableFontFace: true,
        useSystemFonts: true,
        disableCreateObjectURL: true
    });
    
    // Kill worker immediately but safely
    try {
        if (loadingTask.worker) {
            loadingTask.worker.terminate();
            loadingTask.worker = null;
        }
    } catch (error) {
        console.log('[PDF2MD] Could not terminate worker, continuing:', error.message);
    }
    
    console.log('[PDF2MD] Attempting synchronous PDF load with 10s timeout...');
    const pdf = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Synchronous PDF loading timeout')), 10000)
        )
    ]) as PDFDocumentProxy;
    
    console.log('[PDF2MD] Synchronous PDF loading successful, pages:', pdf.numPages);
    return pdf;
}

export async function loadPDFAlternative(arrayBuffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    console.log('[PDF2MD] Loading PDF with alternative configuration...');
    
    const pdfjsLib = require('pdfjs-dist');
    
    // Configure worker
    configurePDFJSWorker(pdfjsLib);
    console.log('[PDF2MD] Worker configured for alternative loading');
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Try with different PDF.js options that might work better in Electron
    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        verbosity: 0,
        // Different configuration that might be more Electron-friendly
        useWorkerFetch: false,
        isEvalSupported: true, // Try allowing eval
        disableAutoFetch: false, // Try enabling auto-fetch
        disableStream: false, // Try enabling streaming
        disableFontFace: false, // Try enabling font face
        useSystemFonts: false, // Use PDF fonts
        disableRange: false, // Try enabling range requests
        disableCreateObjectURL: false, // Try enabling object URLs
        stopAtErrors: true, // Stop at first error for debugging
        maxImageSize: 16777216, // 16MB max image size
        cMapUrl: null,
        cMapPacked: false,
        standardFontDataUrl: null,
        // Try with password handling
        password: undefined,
        // Enable worker but with our configured worker
        enableXfa: false // Disable XFA forms
    });
    
    // Don't kill the worker for this strategy
    console.log('[PDF2MD] Attempting alternative PDF load with 20s timeout...');
    const pdf = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Alternative PDF loading timeout')), 20000)
        )
    ]) as PDFDocumentProxy;
    
    console.log('[PDF2MD] Alternative PDF loading successful, pages:', pdf.numPages);
    return pdf;
}

export async function extractImagesFromPDF(arrayBuffer: ArrayBuffer): Promise<string[]> {
    console.log('[PDF2MD] Starting PDF image extraction with direct pdftoppm...');
    try {
        // Save PDF to temporary file
        const tempDir = require('os').tmpdir();
        const path = require('path');
        const fs = require('fs').promises;
        const crypto = require('crypto');
        const { spawn } = require('child_process');
        
        // Use cryptographically secure random names for temporary files
        const randomSuffix = crypto.randomBytes(16).toString('hex');
        const tempPdfPath = sanitizePath(path.join(tempDir, `pdf2md-temp-${randomSuffix}.pdf`));
        const outputPrefix = sanitizePath(path.join(tempDir, `pdf2md-output-${randomSuffix}`));
        
        // Validate that paths are within the temp directory for security
        if (!tempPdfPath.startsWith(tempDir) || !outputPrefix.startsWith(tempDir)) {
            throw new Error('Invalid temporary file path - security violation detected');
        }
        
        console.log(`[PDF2MD] Saving PDF to temporary file: ${tempPdfPath}`);
        
        // Write PDF data to temp file
        await fs.writeFile(tempPdfPath, Buffer.from(arrayBuffer));
        console.log(`[PDF2MD] PDF saved to temp file (${arrayBuffer.byteLength} bytes)`);
        
        try {
            console.log('[PDF2MD] Running pdftoppm directly...');
            
            // Run pdftoppm command directly
            const pdftoppmPath = '/opt/homebrew/bin/pdftoppm';
            const args = [
                '-png',              // Output PNG format
                '-r', '200',         // 200 DPI resolution
                '-scale-to', '2048', // Scale to max 2048px
                tempPdfPath,         // Input PDF
                outputPrefix         // Output prefix
            ];
            
            console.log(`[PDF2MD] Executing: ${pdftoppmPath} ${args.join(' ')}`);
            
            // Execute pdftoppm as a promise
            await new Promise<void>((resolve, reject) => {
                const process = spawn(pdftoppmPath, args);
                
                let stdout = '';
                let stderr = '';
                
                process.stdout.on('data', (data: any) => {
                    stdout += data.toString();
                });
                
                process.stderr.on('data', (data: any) => {
                    stderr += data.toString();
                });
                
                process.on('close', (code: any) => {
                    if (code === 0) {
                        console.log(`[PDF2MD] pdftoppm completed successfully`);
                        resolve();
                    } else {
                        console.error(`[PDF2MD] pdftoppm failed with code ${code}`);
                        console.error(`[PDF2MD] stderr: ${stderr}`);
                        reject(new Error(`pdftoppm failed with exit code ${code}: ${stderr}`));
                    }
                });
                
                process.on('error', (err: any) => {
                    console.error(`[PDF2MD] pdftoppm spawn error:`, err);
                    reject(err);
                });
            });
            
            // Find all generated PNG files
            console.log('[PDF2MD] Looking for generated PNG files...');
            const files = await fs.readdir(tempDir);
            const outputFiles = files.filter((f: string) => f.startsWith(path.basename(outputPrefix)) && f.endsWith('.png'));
            outputFiles.sort(); // Ensure correct page order
            
            console.log(`[PDF2MD] Found ${outputFiles.length} PNG files: ${outputFiles.join(', ')}`);
            
            // Read each PNG file and convert to base64
            const images: string[] = [];
            for (let i = 0; i < outputFiles.length; i++) {
                const filename = outputFiles[i];
                const filePath = path.join(tempDir, filename);
                
                try {
                    // Read the image file
                    const imageBuffer = await fs.readFile(filePath);
                    const base64 = imageBuffer.toString('base64');
                    const dataUrl = `data:image/png;base64,${base64}`;
                    images.push(dataUrl);
                    
                    console.log(`[PDF2MD] Page ${i + 1}: ${filename} (${imageBuffer.length} bytes) → ${base64.length} chars base64 → ${dataUrl.length} chars data URL`);
                    
                    // Clean up individual image file
                    await fs.unlink(filePath);
                    
                } catch (imageError) {
                    console.warn(`[PDF2MD] Failed to read image file ${filePath}:`, imageError.message);
                }
            }
            
            if (images.length === 0) {
                throw new Error('No PNG files were generated by pdftoppm');
            }
            
            console.log(`[PDF2MD] Successfully extracted ${images.length} images from PDF using direct pdftoppm`);
            return images;
            
        } finally {
            // Clean up temporary PDF file
            try {
                await fs.unlink(tempPdfPath);
                console.log(`[PDF2MD] Cleaned up temporary PDF file`);
            } catch (cleanupError) {
                console.warn(`[PDF2MD] Could not clean up temporary file: ${cleanupError.message}`);
            }
        }
        
    } catch (error) {
        console.error('[PDF2MD] PDF image extraction error:', error);
        console.error('[PDF2MD] Error details:', error.stack);
        
        // Provide helpful error messages based on the error type
        if (error.message.includes('ENOENT') || error.message.includes('pdftoppm')) {
            throw new Error(`PDF conversion failed: pdftoppm command not found. Please install poppler:\n\nmacOS: brew install poppler\nLinux: apt-get install poppler-utils\nWindows: Download from poppler website\n\nOriginal error: ${error.message}`);
        } else {
            throw new Error(`Failed to extract images from PDF: ${error.message}`);
        }
    }
}