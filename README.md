# PDF2MD - PDF to Markdown Converter for Obsidian

Convert PDF documents to structured Markdown using AI (Anthropic Claude or Ollama). Extract text from PDFs and transform them into clean, well-organized Markdown notes for your vault.

## Features

### **AI-Powered Conversion**
- **Anthropic Claude Integration**: Support for Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models
- **Local Ollama Support**: Use vision-capable models like LLaVa for completely local processing
- **Advanced OCR**: Handles handwritten text, complex layouts, and multi-column documents
- **Vision Processing**: Converts PDF pages to images and uses AI vision capabilities for accurate text extraction

### **Multiple Conversion Methods**
- **Ribbon Icon**: Quick access via the PDF2MD icon in Obsidian's ribbon
- **Command Palette**: "Convert PDF to Markdown" and "Process current PDF file" commands
- **Context Menu**: Right-click any PDF in the file explorer to convert
- **Automatic Watching**: Monitor folders for new PDFs and convert them automatically

### **Customizable Processing**
- **Custom Prompts**: Create, edit, and manage conversion prompts for different document types
- **Built-in Templates**: Pre-configured prompts for academic papers, handwritten notes, and general documents
- **Post-Processing**: Apply templates with frontmatter, tags, and custom formatting
- **Output Control**: Choose where converted files are saved

### **Security & Privacy**
- **Secure API Key Storage**: API keys are stored securely in Obsidian's encrypted storage
- **Path Validation**: Protection against directory traversal and command injection
- **No Data Logging**: Sensitive information is never logged or exposed

## Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to **Community plugins** and disable **Safe mode**
3. Click **Browse** and search for "PDF2MD"
4. Install and enable the plugin

### Manual Installation
1. Download the latest release from [GitHub](https://github.com/serabi/pdf2md/releases)
2. Extract the files to `{VaultFolder}/.obsidian/plugins/pdf2md-plugin/`
3. Reload Obsidian and enable the plugin in settings

## Setup

### AI Provider Configuration

#### Option 1: Anthropic Claude (Recommended)
1. Go to **Settings** → **PDF2MD** → **General** tab
2. Select **Anthropic Claude** as your AI Provider
3. Enter your [Anthropic API key](https://console.anthropic.com/)
4. Choose your preferred Claude model (Claude 3.5 Sonnet recommended)

#### Option 2: Ollama (Local Processing)
1. Install [Ollama](https://ollama.ai/) on your computer
2. Install a vision-capable model: `ollama pull llava`
3. In plugin settings, select **Ollama (Local)** as your AI Provider
4. Set Ollama URL (default: `http://localhost:11434`)
5. Click **Refresh Models** to load available models

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
- **AI Provider**: Choose between Anthropic Claude or Ollama
- **API Keys**: Securely stored and password-masked
- **Model Selection**: Automatic refresh for Ollama models
- **Current Prompt**: Edit active conversion prompt
- **Output Folder**: Where to save converted files

### Prompt Management
- **Default Prompts**: Built-in templates you can customize
- **Custom Prompts**: Create your own conversion instructions
- **Prompt Library**: Save and organize multiple prompts

### Advanced Options
- **Post-processing**: Apply templates to generated content
- **Folder Watching**: Automatic PDF monitoring
- **Security Features**: Path validation and secure storage

## Supported Document Types

- **Academic Papers**: Research articles, journals, conference papers
- **Handwritten Notes**: Scanned notebooks, handwritten documents
- **Technical Documents**: Manuals, specifications, reports
- **Books & Articles**: Text-heavy documents with complex layouts
- **Forms & Tables**: Structured data and tabular content
- **Multi-language**: Documents in various languages

## Troubleshooting

### Common Issues

**"No models found" for Ollama**
- Ensure Ollama is running: `ollama serve`
- Install a vision model: `ollama pull llava`
- Check Ollama URL in settings

**API Key errors**
- Verify your Anthropic API key is correct
- Check your API usage limits
- Ensure the key has proper permissions

**PDF conversion fails**
- Large PDFs may take several minutes
- Try with a smaller PDF first
- Check console for detailed error messages

**Poor conversion quality**
- Try different prompts for your document type
- Use Claude 3.5 Sonnet for best results
- Consider adjusting your custom prompts

### Performance Tips
- **Large PDFs**: May take 2-5 minutes for complex documents
- **Handwritten text**: Use specific prompts mentioning handwriting
- **Multiple languages**: Specify languages in your prompt
- **Tables**: Use prompts that emphasize table structure preservation

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

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