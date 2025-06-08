# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build Commands
- `npm run dev` - Start development mode with watch (compiles TypeScript continuously)
- `npm run build` - Production build with type checking

### Version Management
- `npm version patch/minor/major` - Bump version after updating `minAppVersion` in manifest.json

### Installation
- `npm i` - Install all dependencies (includes pdfjs-dist for PDF-to-image conversion)

## Architecture Overview

This is a PDF to Markdown converter plugin for Obsidian that uses AI (Anthropic Claude or Ollama) to transform PDF content into well-structured Markdown documents.

### Core Components

1. **PDF2MDPlugin** (main.ts:42-256) - Main plugin class
   - Manages AI provider settings (Anthropic/Ollama)
   - Handles PDF file processing workflow
   - Processes text with selected AI model
   - Creates markdown files in vault

2. **PDF2MDSettings** (main.ts:3-12) - Settings interface
   - API keys for Anthropic
   - Ollama server configuration
   - Model selection for both providers
   - Custom prompt management
   - Saved prompts storage

3. **PDFProcessModal** (main.ts:258-333) - Main interaction modal
   - File selection from vault or upload
   - Conversion trigger interface

4. **PDF2MDSettingTab** (main.ts:375-540) - Comprehensive settings UI
   - Provider selection (Anthropic/Ollama)
   - API key management (secure password input)
   - Model selection with auto-refresh for Ollama
   - Prompt editing and saving system

5. **SavePromptModal** (main.ts:542-597) - Prompt management
   - Save custom prompts with names
   - Load and delete saved prompts

### Key Features

#### PDF Processing
- Uses pdfjs-dist to convert PDF pages to images
- Leverages AI vision capabilities for text extraction and understanding
- Handles multi-page PDFs by sending multiple images to AI
- Canvas-based image rendering using Electron's DOM API
- Error handling for corrupted or problematic PDFs
- Dynamic imports for optimal performance

#### AI Integration
- **Anthropic Claude**: Direct API integration with vision-capable models for image processing
- **Ollama**: Local AI server support with vision models (llava, bakllava, etc.)
- Configurable prompts with intelligent defaults optimized for vision tasks
- Prompt library for reusable conversion templates including handwriting extraction

#### Security & Best Practices
- API keys stored securely in Obsidian's data storage
- Password-masked input fields
- No sensitive data in logs or console output
- Local processing with external AI calls only

### File Structure
- `main.ts` - All plugin logic and UI components
- `styles.css` - Modern, theme-aware styling
- `manifest.json` - Plugin metadata and permissions
- `package.json` - Dependencies including pdfjs-dist

### Integration Points
- **Ribbon Icon**: Quick access to conversion modal
- **Command Palette**: "Convert PDF to Markdown" and "Process current PDF"
- **File Context Menu**: Right-click PDF files to convert
- **Settings Tab**: Comprehensive configuration interface

### Dependencies
- `pdfjs-dist@^3.11.174` - PDF-to-image conversion library
- Standard Obsidian API for file operations and UI
- Electron's built-in Canvas API for image rendering

### Development Workflow
- Plugin files must be copied to vault's `.obsidian/plugins/pdf2md-plugin/` folder for testing
- Reload Obsidian after rebuilding to see changes
- Enable plugin in Obsidian settings after installation

### Release Process
- Update `minAppVersion` in manifest.json first
- Use `npm version patch/minor/major` to bump versions
- Creates GitHub release with manifest.json, main.js, and styles.css files