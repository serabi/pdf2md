# PDF2MD - PDF to Markdown Converter for Obsidian

Convert PDF documents to structured Markdown using either local or cloud AI. Extract text from PDFs and transform them into clean, well-organized Markdown notes for your vault.

This plugin is currently in active development. You may run into issues whil erunning it 

## Features

### **AI-Powered Conversion**
- **Anthropic Claude**: Current Claude models including Sonnet 4
- **OpenAI**: Use GPT-4o family and other chat/vision models via the official API
- **Ollama (Local)**: Run vision-capable local models like LLaVA
- **LM Studio (Local)**: Connect to LM Studio over your network and use its models

#### **For All Models**
- **Vision Processing**: Converts PDF pages to images and uses AI vision for accurate text extraction
- **Post AI Processing**: Optional post-processing and multi-pass refinement to further clean the Markdown

### **Multiple Conversion Methods**
- **Ribbon Icon**: Quick access via the PDF2MD icon in Obsidian's ribbon
- **Command Palette**: "Convert PDF to Markdown" and "Process current PDF file" commands
- **Context Menu**: Right-click any PDF in the file explorer to convert
- **Automatic Watching**: Monitor folders for new PDFs and convert them automatically (event-driven, not polling)

### **Customizable Processing**
- **Custom Prompts**: Create, edit, and manage conversion prompts for different document types
- **Post-Processing Template**: Apply templates with frontmatter, tags, and custom formatting
- **AI Multi-pass Refinement**: Optional 2nd and 3rd passes to normalize structure, headings, and tables
- **Output Control**: Choose where converted files are saved

### **Security & Privacy**
- **Secure API Key Storage**: API keys are stored securely in Obsidian's encrypted storage
- **Path Validation**: Protection against directory traversal and command injection
- **No Data Logging**: Sensitive information is never logged or exposed

## Installation

### Via BRAT Plugin (Recommended)
1. Open Obsidian Settings
2. Go to **Community plugins** and disable **Safe mode**
3. Click **Browse** and search for "BRAT" (note: stands for Beta Reviewers Auto-update Tester)
4. Install and enable the BRAT plugin
5. Go to the BRAT plugin settings and click `Add beta plugin`
6. Paste the URL for this repository (`https://github.com/serabi/pdf2md`) and then follow the prompts to select the latest version and enable it 
7. Once the plugin is added and enabled via the BRAT plugin, you'll be able to find the plugin settings in Obsidian 


### Manual Installation
1. Download the latest release from [GitHub](https://github.com/serabi/pdf2md/releases)
2. Extract the files to `{VaultFolder}/.obsidian/plugins/pdf2md-plugin/`
3. Reload Obsidian and enable the plugin in settings

## Usage

### Quick Convert
1. **From Ribbon**: Click the PDF2MD icon and select a PDF file
2. **From File Explorer**: Right-click any PDF → "Convert to Markdown"
3. **From Command Palette**: `Ctrl/Cmd+P` → "Convert PDF to Markdown"
4. **Current PDF**: When viewing a PDF, use "Process current PDF file"

### Automatic Processing
1. Go to **Settings** → **PDF2MD** → **General** tab
2. Enable **Folder Watching**
3. Set **Watch Folder** (e.g., "PDF Inbox")
4. Optionally set **Output Folder** for converted files
5. Drop PDFs into the watch folder for automatic conversion
Notes:
- The watcher is event-driven. It reacts to new PDFs created or moved into the folder.
- Use a vault-relative folder path (e.g., `PDF Inbox`).

### Custom Prompts
1. Go to **Settings** → **PDF2MD** → **Prompts** tab
2. **Built-in Prompts**: Edit default prompts for different document types
3. **Custom Prompts**: Create new prompts for specific needs
4. **Use Prompts**: Select any prompt from the General tab dropdown

### Post-Processing Templates
1. Enable **Post-processing Template** in General settings
2. Use placeholders in your template:
   - `{{content}}` - The generated markdown
   - `{{date}}` - Current date (YYYY-MM-DD)
   - `{{datetime}}` - Current datetime (ISO format)
   - `{{time}}` - Current time (HH:MM:SS)

**Example Template:**
```markdown
---
tags: [pdf2md, converted]
date: {{date}}
source: PDF
---

# Converted Document

{{content}}
```

## Configuration Options

### General Settings
- **AI Provider**: Anthropic, OpenAI, Ollama (Local), LM Studio (Local)
- **API Keys**: Securely stored and password-masked (Anthropic/OpenAI; LM Studio optional)
- **Model Selection**:
  - Anthropic: pick a Claude model
  - OpenAI: enter model (e.g., `gpt-4o`)
  - Ollama: refresh and select from local models; vision models labeled; test connection
  - LM Studio: set base URL (e.g., `http://10.0.0.97:1234`), refresh models; vision models labeled; test connection
- **Current Prompt**: Edit active conversion prompt
- **Output Folder**: Where to save converted files

### Prompt Management
- **Default Prompts**: Built-in templates you can customize
- **Custom Prompts**: Create your own conversion instructions
- **Prompt Library**: Save and organize multiple prompts

### Advanced Options
- **AI Multi-pass Refinement**: Optional Pass 2 and Pass 3 prompts to improve Markdown after initial extraction
- **Post-processing Template**: Wrap output with your template and placeholders
- **PDF Image Extraction**: Control DPI, max width, format (PNG/JPEG + quality); Poppler path test; automatic PDF.js fallback if Poppler is missing
- **OCR Fallback (Tesseract)**: If image processing fails or model lacks vision, an OCR cleanup path can be used
- **Folder Watching**: Automatic PDF monitoring
- **Security Features**: Path validation and secure storage

### Providers Overview
- **Anthropic**: Requires API key. Choose a Claude model.
- **OpenAI**: Requires API key. Enter the model name (e.g., `gpt-4o`).
- **Ollama**: Provide base URL (default `http://localhost:11434`). Refresh models; vision models labeled. Test connection available.
- **LM Studio**: Provide base URL (default `http://localhost:1234` or your LAN IP). Refresh models; vision models labeled. Test connection available.

### Diagnostics
- Run Diagnostics from the Ollama tab to check connectivity, model listing, and environment (Poppler/Tesseract) status.


## Troubleshooting

### Common Issues

**"No models found" for Ollama**
- Ensure Ollama is running: `ollama serve`
- Install a vision model: `ollama pull llava`
- Check Ollama URL in settings and click "Refresh Models"

**"No models found" for LM Studio**
- Ensure LM Studio server is running and accessible (try opening `http://localhost:1234` or your LAN URL)
- Verify Base URL in settings and click "Refresh Models"

**API Key errors**
- Verify your Anthropic/OpenAI API key is correct
- Check your API usage limits and permissions

**PDF conversion fails**
- Large PDFs may take several minutes
- Try with a smaller PDF first
- Check console for detailed error messages
- If Poppler is missing, the plugin will fallback to PDF.js rendering automatically

### Performance Tips
- **Large PDFs**: May take 2-5 minutes for complex documents
- **Vision models**: Prefer vision-capable models (labeled) for image-based PDFs
- **Multiple languages**: Specify languages in your prompt
- **Tables**: Use prompts that emphasize table structure preservation

## Contributing

We welcome contributions! 

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Run `npm run dev` for development mode
4. Run `npm run build` for production build

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/serabi/pdf2md/issues)
- **Discussions**: [Community support and discussions](https://github.com/serabi/pdf2md/discussions)

---

**Made for the Obsidian community**