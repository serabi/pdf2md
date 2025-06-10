import { requestUrl } from 'obsidian';
import { PDF2MDSettings } from './types';

export async function processWithAI(settings: PDF2MDSettings, images: string[], prompt?: string): Promise<string> {
    const usePrompt = prompt || settings.currentPrompt;
    console.log(`[PDF2MD] ===== MAIN AI PROCESSING STEP =====`);
    console.log(`[PDF2MD] Provider: ${settings.selectedProvider}`);
    console.log(`[PDF2MD] Model: ${settings.selectedModel}`);
    console.log(`[PDF2MD] Images: ${images.length}`);
    console.log(`[PDF2MD] Prompt source: ${prompt ? 'provided parameter' : 'current settings'}`);
    console.log(`[PDF2MD] Using prompt: "${usePrompt.substring(0, 150)}${usePrompt.length > 150 ? '...' : ''}"`);
    
    const startTime = Date.now();
    try {
        let result: string;
        if (settings.selectedProvider === 'anthropic') {
            console.log(`[PDF2MD] Delegating to Anthropic processing...`);
            result = await processWithAnthropic(settings, images, usePrompt);
        } else {
            console.log(`[PDF2MD] Delegating to Ollama processing...`);
            result = await processWithOllama(settings, images, usePrompt);
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`[PDF2MD] ===== MAIN AI PROCESSING COMPLETE =====`);
        console.log(`[PDF2MD] Total processing time: ${processingTime}ms`);
        console.log(`[PDF2MD] Result length: ${result.length} characters`);
        
        return result;
    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[PDF2MD] ===== MAIN AI PROCESSING FAILED =====`);
        console.error(`[PDF2MD] Failed after: ${processingTime}ms`);
        console.error(`[PDF2MD] Error:`, error.message);
        throw error;
    }
}

export async function processWithAnthropic(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    console.log(`[PDF2MD] ===== ANTHROPIC AI PROCESSING START =====`);
    console.log(`[PDF2MD] Model from settings: ${settings.selectedModel}`);
    
    // EMERGENCY FIX: Force a valid model regardless of settings
    const validModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620', 
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
    ];
    const modelToUse = validModels.includes(settings.selectedModel) ? 
        settings.selectedModel : validModels[0];
    
    console.log(`[PDF2MD] Model being used: ${modelToUse}`);
    console.log(`[PDF2MD] Number of images: ${images.length}`);
    console.log(`[PDF2MD] Prompt length: ${prompt.length} characters`);
    console.log(`[PDF2MD] API key present: ${settings.anthropicApiKey ? 'YES' : 'NO'}`);
    console.log(`[PDF2MD] Prompt preview (first 200 chars): "${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}"`);
    
    try {
        // Build content array with prompt text and all images
        const content: any[] = [
            { type: 'text', text: prompt }
        ];
        
        // Add each image to the content
        images.forEach((imageDataUrl, index) => {
            // Detect image format from data URL
            let mediaType = 'image/png';
            let imageData = imageDataUrl;
            
            if (imageDataUrl.startsWith('data:image/jpeg;base64,')) {
                mediaType = 'image/jpeg';
                imageData = imageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
            } else if (imageDataUrl.startsWith('data:image/webp;base64,')) {
                mediaType = 'image/webp';
                imageData = imageDataUrl.replace(/^data:image\/webp;base64,/, '');
            } else if (imageDataUrl.startsWith('data:image/png;base64,')) {
                mediaType = 'image/png';
                imageData = imageDataUrl.replace(/^data:image\/png;base64,/, '');
            } else {
                console.warn(`[PDF2MD] Unknown image format for image ${index + 1}, assuming PNG`);
                imageData = imageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');
            }
            
            content.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: imageData
                }
            });
            
            console.log(`[PDF2MD] Image ${index + 1}: format=${mediaType}, base64_length=${imageData.length} chars`);
            
            // Add a separator between pages if there are multiple images
            if (index < images.length - 1) {
                content.push({
                    type: 'text',
                    text: `\n\n--- Page ${index + 2} ---\n\n`
                });
            }
        });

        const requestBody = {
            model: modelToUse,
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: content
                }
            ]
        };

        console.log(`[PDF2MD] Request body structure:`);
        console.log(`[PDF2MD]   - model: ${requestBody.model}`);
        console.log(`[PDF2MD]   - max_tokens: ${requestBody.max_tokens}`);
        console.log(`[PDF2MD]   - messages[0].role: ${requestBody.messages[0].role}`);
        console.log(`[PDF2MD]   - messages[0].content length: ${requestBody.messages[0].content.length} items`);
        requestBody.messages[0].content.forEach((item, index) => {
            if (item.type === 'text') {
                console.log(`[PDF2MD]     content[${index}]: type=text, length=${item.text.length} chars`);
            } else if (item.type === 'image') {
                console.log(`[PDF2MD]     content[${index}]: type=image, media_type=${item.source.media_type}, data_length=${item.source.data.length} chars`);
            }
        });

        const requestBodyString = JSON.stringify(requestBody);
        console.log(`[PDF2MD] Total request body size: ${requestBodyString.length} characters`);

        console.log('[PDF2MD] Sending request to Anthropic API...');
        const startTime = Date.now();
        
        const response = await requestUrl({
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': settings.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: requestBodyString
        });

        const responseTime = Date.now() - startTime;
        console.log(`[PDF2MD] Response received after ${responseTime}ms`);
        console.log(`[PDF2MD] Response status: ${response.status}`);
        console.log(`[PDF2MD] Response headers:`, response.headers);

        if (response.status === 200) {
            console.log(`[PDF2MD] Response body structure:`, Object.keys(response.json));
            if (response.json.content) {
                console.log(`[PDF2MD] Response content array length: ${response.json.content.length}`);
                response.json.content.forEach((item: any, index: number) => {
                    console.log(`[PDF2MD]   content[${index}]: type=${item.type}, text_length=${item.text ? item.text.length : 'N/A'}`);
                });
                
                const responseText = response.json.content[0].text;
                console.log(`[PDF2MD] ===== ANTHROPIC AI PROCESSING SUCCESS =====`);
                console.log(`[PDF2MD] Final response text length: ${responseText.length} characters`);
                console.log(`[PDF2MD] Response preview (first 200 chars): "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"`);
                return responseText;
            } else {
                console.error('[PDF2MD] ===== ANTHROPIC API ERROR: NO CONTENT =====');
                console.error('[PDF2MD] Full response:', JSON.stringify(response.json, null, 2));
                throw new Error('No content in Anthropic API response');
            }
        } else {
            console.error('[PDF2MD] ===== ANTHROPIC API ERROR =====');
            console.error('[PDF2MD] Status:', response.status);
            console.error('[PDF2MD] Response body:', JSON.stringify(response.json, null, 2));
            console.error('[PDF2MD] Request was:', {
                url: 'https://api.anthropic.com/v1/messages',
                model: settings.selectedModel,
                promptLength: prompt.length,
                imageCount: images.length
            });
            throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(response.json)}`);
        }
    } catch (error) {
        console.error('[PDF2MD] ===== ANTHROPIC API CRITICAL ERROR =====');
        console.error('[PDF2MD] Error type:', error.constructor.name);
        console.error('[PDF2MD] Error message:', error.message);
        console.error('[PDF2MD] Error stack:', error.stack);
        if (error.response) {
            console.error('[PDF2MD] Error response status:', error.response.status);
            console.error('[PDF2MD] Error response data:', error.response.data);
        }
        throw error;
    }
}

export async function processWithOllama(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    console.log(`[PDF2MD] ===== OLLAMA AI PROCESSING START =====`);
    console.log(`[PDF2MD] Model: ${settings.selectedModel}`);
    console.log(`[PDF2MD] Number of images: ${images.length}`);
    console.log(`[PDF2MD] Prompt length: ${prompt.length} characters`);
    console.log(`[PDF2MD] Ollama URL: ${settings.ollamaUrl}`);
    console.log(`[PDF2MD] Prompt preview (first 200 chars): "${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}"`);
    
    try {
        // Note: Ollama vision support varies by model (llava, bakllava, etc.)
        // For models without vision support, this will fail
        
        // For now, try to send the first image with vision-capable models
        // Future enhancement: detect if model supports vision
        if (images.length === 0) {
            console.error('[PDF2MD] ===== OLLAMA ERROR: NO IMAGES =====');
            throw new Error('No images to process');
        }
        
        // Use the first image for Ollama (most vision models process one at a time)
        let firstImageData = images[0];
        console.log(`[PDF2MD] First image data URL prefix: ${firstImageData.substring(0, 50)}...`);
        
        // Strip the data URL prefix to get just the base64 data
        if (firstImageData.startsWith('data:image/jpeg;base64,')) {
            firstImageData = firstImageData.replace(/^data:image\/jpeg;base64,/, '');
            console.log(`[PDF2MD] Detected JPEG image format`);
        } else if (firstImageData.startsWith('data:image/webp;base64,')) {
            firstImageData = firstImageData.replace(/^data:image\/webp;base64,/, '');
            console.log(`[PDF2MD] Detected WebP image format`);
        } else if (firstImageData.startsWith('data:image/png;base64,')) {
            firstImageData = firstImageData.replace(/^data:image\/png;base64,/, '');
            console.log(`[PDF2MD] Detected PNG image format`);
        } else {
            console.warn(`[PDF2MD] Unknown image format, attempting to strip generic prefix`);
            firstImageData = firstImageData.replace(/^data:image\/[^;]+;base64,/, '');
        }
        
        console.log(`[PDF2MD] Base64 image data length: ${firstImageData.length} characters`);
        
        // Ensure URL has protocol
        let ollamaUrl = settings.ollamaUrl;
        if (!ollamaUrl.startsWith('http://') && !ollamaUrl.startsWith('https://')) {
            ollamaUrl = 'http://' + ollamaUrl;
        }
        console.log('[PDF2MD] Final Ollama URL:', ollamaUrl);

        const requestBody = {
            model: settings.selectedModel,
            prompt: prompt,
            images: [firstImageData],
            stream: false
        };

        console.log(`[PDF2MD] Request body structure:`);
        console.log(`[PDF2MD]   - model: ${requestBody.model}`);
        console.log(`[PDF2MD]   - prompt length: ${requestBody.prompt.length} chars`);
        console.log(`[PDF2MD]   - images array length: ${requestBody.images.length}`);
        console.log(`[PDF2MD]   - first image data length: ${requestBody.images[0].length} chars`);
        console.log(`[PDF2MD]   - stream: ${requestBody.stream}`);

        const requestBodyString = JSON.stringify(requestBody);
        console.log(`[PDF2MD] Total request body size: ${requestBodyString.length} characters`);
        
        console.log('[PDF2MD] Sending request to Ollama API...');
        const startTime = Date.now();
        
        const response = await requestUrl({
            url: `${ollamaUrl}/api/generate`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBodyString
        });

        const responseTime = Date.now() - startTime;
        console.log(`[PDF2MD] Response received after ${responseTime}ms`);
        console.log(`[PDF2MD] Response status: ${response.status}`);
        console.log(`[PDF2MD] Response headers:`, response.headers);

        if (response.status === 200) {
            console.log(`[PDF2MD] Response body structure:`, Object.keys(response.json));
            if (response.json.response) {
                const responseText = response.json.response;
                console.log(`[PDF2MD] ===== OLLAMA AI PROCESSING SUCCESS =====`);
                console.log(`[PDF2MD] Final response text length: ${responseText.length} characters`);
                console.log(`[PDF2MD] Response preview (first 200 chars): "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"`);
                
                // Log additional response fields if present
                if (response.json.model) console.log(`[PDF2MD] Response model: ${response.json.model}`);
                if (response.json.created_at) console.log(`[PDF2MD] Response created_at: ${response.json.created_at}`);
                if (response.json.done !== undefined) console.log(`[PDF2MD] Response done: ${response.json.done}`);
                
                return responseText;
            } else {
                console.error('[PDF2MD] ===== OLLAMA API ERROR: NO RESPONSE FIELD =====');
                console.error('[PDF2MD] Full response:', JSON.stringify(response.json, null, 2));
                throw new Error('No response field in Ollama API response');
            }
        } else {
            console.error('[PDF2MD] ===== OLLAMA API ERROR =====');
            console.error('[PDF2MD] Status:', response.status);
            console.error('[PDF2MD] Response body:', JSON.stringify(response.json, null, 2));
            console.error('[PDF2MD] Request was:', {
                url: `${ollamaUrl}/api/generate`,
                model: settings.selectedModel,
                promptLength: prompt.length,
                imageCount: images.length
            });
            throw new Error(`Ollama API error: ${response.status} - ${JSON.stringify(response.json)}`);
        }
    } catch (error) {
        console.error('[PDF2MD] ===== OLLAMA API CRITICAL ERROR =====');
        console.error('[PDF2MD] Error type:', error.constructor.name);
        console.error('[PDF2MD] Error message:', error.message);
        console.error('[PDF2MD] Error stack:', error.stack);
        if (error.response) {
            console.error('[PDF2MD] Error response status:', error.response.status);
            console.error('[PDF2MD] Error response data:', error.response.data);
        }
        throw new Error(`Ollama processing failed: ${error.message}. Note: Vision support requires compatible models like llava or bakllava.`);
    }
}

export async function processTextWithAnthropic(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    console.log(`[PDF2MD] ===== ANTHROPIC TEXT PROCESSING START =====`);
    console.log(`[PDF2MD] Model: ${settings.selectedModel}`);
    console.log(`[PDF2MD] Input text length: ${text.length} characters`);
    console.log(`[PDF2MD] Processing prompt length: ${prompt.length} characters`);
    console.log(`[PDF2MD] API key present: ${settings.anthropicApiKey ? 'YES' : 'NO'}`);
    console.log(`[PDF2MD] Processing prompt preview: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
    console.log(`[PDF2MD] Input text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    try {
        const content = `${prompt}\n\n${text}`;
        console.log(`[PDF2MD] Combined content length: ${content.length} characters`);

        const requestBody = {
            model: settings.selectedModel,
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: content
                }
            ]
        };

        const requestBodyString = JSON.stringify(requestBody);
        console.log(`[PDF2MD] Request body size: ${requestBodyString.length} characters`);
        
        console.log('[PDF2MD] Sending text processing request to Anthropic API...');
        const startTime = Date.now();
        
        const response = await requestUrl({
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': settings.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: requestBodyString
        });

        const responseTime = Date.now() - startTime;
        console.log(`[PDF2MD] Text processing response received after ${responseTime}ms`);
        console.log(`[PDF2MD] Response status: ${response.status}`);
        
        if (response.status === 200 && response.json.content) {
            const responseText = response.json.content[0].text;
            console.log(`[PDF2MD] ===== ANTHROPIC TEXT PROCESSING SUCCESS =====`);
            console.log(`[PDF2MD] Response text length: ${responseText.length} characters`);
            console.log(`[PDF2MD] Response preview: "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"`);
            return responseText;
        } else {
            console.error('[PDF2MD] ===== ANTHROPIC TEXT PROCESSING ERROR =====');
            console.error('[PDF2MD] Status:', response.status);
            console.error('[PDF2MD] Response:', JSON.stringify(response.json, null, 2));
            throw new Error('Invalid response from Anthropic API');
        }
    } catch (error) {
        console.error('[PDF2MD] ===== ANTHROPIC TEXT PROCESSING CRITICAL ERROR =====');
        console.error('[PDF2MD] Error type:', error.constructor.name);
        console.error('[PDF2MD] Error message:', error.message);
        console.error('[PDF2MD] Error stack:', error.stack);
        throw error;
    }
}

export async function processTextWithOllama(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    console.log(`[PDF2MD] ===== OLLAMA TEXT PROCESSING START =====`);
    console.log(`[PDF2MD] Model: ${settings.selectedModel}`);
    console.log(`[PDF2MD] Input text length: ${text.length} characters`);
    console.log(`[PDF2MD] Processing prompt length: ${prompt.length} characters`);
    console.log(`[PDF2MD] Ollama URL: ${settings.ollamaUrl}`);
    console.log(`[PDF2MD] Processing prompt preview: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
    console.log(`[PDF2MD] Input text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    try {
        const fullPrompt = `${prompt}\n\n${text}`;
        console.log(`[PDF2MD] Combined prompt length: ${fullPrompt.length} characters`);
        
        // Ensure URL has protocol
        let ollamaUrl = settings.ollamaUrl;
        if (!ollamaUrl.startsWith('http://') && !ollamaUrl.startsWith('https://')) {
            ollamaUrl = 'http://' + ollamaUrl;
        }
        console.log('[PDF2MD] Final Ollama URL for text processing:', ollamaUrl);

        const requestBody = {
            model: settings.selectedModel,
            prompt: fullPrompt,
            stream: false
        };

        const requestBodyString = JSON.stringify(requestBody);
        console.log(`[PDF2MD] Request body size: ${requestBodyString.length} characters`);
        
        console.log('[PDF2MD] Sending text processing request to Ollama API...');
        const startTime = Date.now();
        
        const response = await requestUrl({
            url: `${ollamaUrl}/api/generate`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBodyString
        });

        const responseTime = Date.now() - startTime;
        console.log(`[PDF2MD] Text processing response received after ${responseTime}ms`);
        console.log(`[PDF2MD] Response status: ${response.status}`);

        if (response.status === 200) {
            console.log(`[PDF2MD] Response body structure:`, Object.keys(response.json));
            if (response.json.response) {
                const responseText = response.json.response;
                console.log(`[PDF2MD] ===== OLLAMA TEXT PROCESSING SUCCESS =====`);
                console.log(`[PDF2MD] Response text length: ${responseText.length} characters`);
                console.log(`[PDF2MD] Response preview: "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"`);
                
                // Log additional response fields if present
                if (response.json.model) console.log(`[PDF2MD] Response model: ${response.json.model}`);
                if (response.json.created_at) console.log(`[PDF2MD] Response created_at: ${response.json.created_at}`);
                if (response.json.done !== undefined) console.log(`[PDF2MD] Response done: ${response.json.done}`);
                
                return responseText;
            } else {
                console.error('[PDF2MD] ===== OLLAMA TEXT PROCESSING ERROR: NO RESPONSE FIELD =====');
                console.error('[PDF2MD] Full response:', JSON.stringify(response.json, null, 2));
                throw new Error('No response field in Ollama API response');
            }
        } else {
            console.error('[PDF2MD] ===== OLLAMA TEXT PROCESSING ERROR =====');
            console.error('[PDF2MD] Status:', response.status);
            console.error('[PDF2MD] Response body:', JSON.stringify(response.json, null, 2));
            throw new Error(`Ollama API error: ${response.status} - ${JSON.stringify(response.json)}`);
        }
    } catch (error) {
        console.error('[PDF2MD] ===== OLLAMA TEXT PROCESSING CRITICAL ERROR =====');
        console.error('[PDF2MD] Error type:', error.constructor.name);
        console.error('[PDF2MD] Error message:', error.message);
        console.error('[PDF2MD] Error stack:', error.stack);
        throw new Error(`Ollama text processing failed: ${error.message}`);
    }
}
import PDF2MDPlugin from 'main';

export async function loadOllamaModels(plugin: PDF2MDPlugin) {
	console.log('[PDF2MD] Loading Ollama models...');
	try {
		// Ensure URL has protocol
		let ollamaUrl = plugin.settings.ollamaUrl;
		if (!ollamaUrl.startsWith('http://') && !ollamaUrl.startsWith('https://')) {
			ollamaUrl = 'http://' + ollamaUrl;
		}
		
		const response = await requestUrl({
			url: `${ollamaUrl}/api/tags`,
			method: 'GET'
		});
		
		if (response.status === 200 && response.json.models) {
			plugin.settings.ollamaModels = response.json.models.map((m: any) => m.name);
			console.log(`[PDF2MD] Loaded ${plugin.settings.ollamaModels.length} Ollama models:`, plugin.settings.ollamaModels);
			await plugin.saveSettings();
			return true;
		}
	} catch (error) {
		// Only log if it's not a connection refused error (common when Ollama is not running)
		if (!error.message?.includes('ERR_CONNECTION_REFUSED')) {
			console.warn('[PDF2MD] Failed to load Ollama models:', error.message);
		} else {
			console.log('[PDF2MD] Ollama connection refused (likely not running)');
		}
		// Clear models if connection failed
		plugin.settings.ollamaModels = [];
		return false;
	}
}