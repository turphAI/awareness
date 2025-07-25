const fs = require('fs').promises;
const path = require('path');

/**
 * Export Manager
 * Handles exporting content in various formats with citation styles
 */
class ExportManager {
  constructor() {
    this.supportedFormats = ['json', 'csv', 'bibtex', 'ris', 'markdown', 'html'];
    this.citationStyles = ['apa', 'mla', 'chicago', 'ieee', 'harvard'];
  }

  /**
   * Export content in specified format
   * @param {Array} content - Array of content items
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Export result with data and metadata
   */
  async exportContent(content, options = {}) {
    const {
      format = 'json',
      citationStyle = 'apa',
      includeMetadata = true,
      includeFullText = false,
      includeReferences = true,
      filename = null
    } = options;

    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    if (!this.citationStyles.includes(citationStyle)) {
      throw new Error(`Unsupported citation style: ${citationStyle}`);
    }

    // Prepare content data
    const exportData = await this.prepareContentData(content, {
      includeMetadata,
      includeFullText,
      includeReferences,
      citationStyle
    });

    // Generate export based on format
    let exportResult;
    switch (format) {
      case 'json':
        exportResult = await this.exportToJSON(exportData, options);
        break;
      case 'csv':
        exportResult = await this.exportToCSV(exportData, options);
        break;
      case 'bibtex':
        exportResult = await this.exportToBibTeX(exportData, options);
        break;
      case 'ris':
        exportResult = await this.exportToRIS(exportData, options);
        break;
      case 'markdown':
        exportResult = await this.exportToMarkdown(exportData, options);
        break;
      case 'html':
        exportResult = await this.exportToHTML(exportData, options);
        break;
      default:
        throw new Error(`Export format ${format} not implemented`);
    }

    return {
      ...exportResult,
      metadata: {
        format,
        citationStyle,
        exportedAt: new Date().toISOString(),
        itemCount: content.length,
        options
      }
    };
  }

  /**
   * Prepare content data for export
   * @param {Array} content - Raw content array
   * @param {Object} options - Preparation options
   * @returns {Promise<Array>} - Prepared content data
   */
  async prepareContentData(content, options) {
    const {
      includeMetadata,
      includeFullText,
      includeReferences,
      citationStyle
    } = options;

    return content.map(item => {
      const exportItem = {
        id: item._id || item.id,
        title: item.title,
        author: item.author || (item.authors && item.authors.map(a => a.name).join(', ')),
        url: item.url,
        publishDate: item.publishDate,
        discoveryDate: item.discoveryDate,
        type: item.type,
        categories: item.categories || [],
        topics: item.topics || [],
        summary: item.summary,
        keyInsights: item.keyInsights || [],
        citation: this.generateCitation(item, citationStyle)
      };

      if (includeFullText && item.fullText) {
        exportItem.fullText = item.fullText;
      }

      if (includeReferences && item.references) {
        exportItem.references = item.references;
      }

      if (includeMetadata) {
        exportItem.metadata = {
          relevanceScore: item.relevanceScore,
          qualityScore: item.qualityScore,
          readingTime: item.readingTime,
          wordCount: item.wordCount,
          language: item.language,
          processed: item.processed,
          outdated: item.outdated,
          readCount: item.readCount,
          saveCount: item.saveCount,
          shareCount: item.shareCount
        };

        // Add type-specific metadata
        if (item.type === 'paper') {
          exportItem.metadata.paperSpecific = {
            abstract: item.paperAbstract,
            doi: item.paperDOI,
            citations: item.paperCitations,
            authors: item.paperAuthors
          };
        } else if (item.type === 'podcast') {
          exportItem.metadata.podcastSpecific = {
            episodeNumber: item.podcastEpisodeNumber,
            duration: item.podcastDuration
          };
        } else if (item.type === 'video') {
          exportItem.metadata.videoSpecific = {
            duration: item.videoDuration
          };
        }
      }

      return exportItem;
    });
  }

  /**
   * Generate citation in specified style
   * @param {Object} item - Content item
   * @param {string} style - Citation style
   * @returns {string} - Formatted citation
   */
  generateCitation(item, style) {
    const author = item.author || (item.paperAuthors && item.paperAuthors.map(a => a.name).join(', ')) || 'Unknown Author';
    const title = item.title || 'Untitled';
    const year = item.publishDate ? new Date(item.publishDate).getFullYear() : 'n.d.';
    const url = item.url;

    switch (style) {
      case 'apa':
        return this.generateAPACitation(author, title, year, url, item);
      case 'mla':
        return this.generateMLACitation(author, title, year, url, item);
      case 'chicago':
        return this.generateChicagoCitation(author, title, year, url, item);
      case 'ieee':
        return this.generateIEEECitation(author, title, year, url, item);
      case 'harvard':
        return this.generateHarvardCitation(author, title, year, url, item);
      default:
        return `${author} (${year}). ${title}. Retrieved from ${url}`;
    }
  }

  /**
   * Generate APA style citation
   */
  generateAPACitation(author, title, year, url, item) {
    let citation = `${author} (${year}). ${title}.`;
    
    if (item.type === 'paper' && item.paperDOI) {
      citation += ` https://doi.org/${item.paperDOI}`;
    } else {
      citation += ` Retrieved from ${url}`;
    }
    
    return citation;
  }

  /**
   * Generate MLA style citation
   */
  generateMLACitation(author, title, year, url, item) {
    const accessDate = new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    return `${author}. "${title}." Web. ${accessDate}. <${url}>.`;
  }

  /**
   * Generate Chicago style citation
   */
  generateChicagoCitation(author, title, year, url, item) {
    const accessDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${author}. "${title}." Accessed ${accessDate}. ${url}.`;
  }

  /**
   * Generate IEEE style citation
   */
  generateIEEECitation(author, title, year, url, item) {
    return `${author}, "${title}," ${year}. [Online]. Available: ${url}`;
  }

  /**
   * Generate Harvard style citation
   */
  generateHarvardCitation(author, title, year, url, item) {
    return `${author} ${year}, '${title}', viewed ${new Date().toLocaleDateString('en-GB')}, <${url}>.`;
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(data, options) {
    const jsonData = JSON.stringify(data, null, 2);
    
    return {
      data: jsonData,
      mimeType: 'application/json',
      extension: 'json',
      size: Buffer.byteLength(jsonData, 'utf8')
    };
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(data, options) {
    if (data.length === 0) {
      return {
        data: '',
        mimeType: 'text/csv',
        extension: 'csv',
        size: 0
      };
    }

    // Get all unique keys from all objects
    const allKeys = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'metadata') {
          allKeys.add(key);
        }
      });
      
      // Add metadata keys if present
      if (item.metadata) {
        Object.keys(item.metadata).forEach(key => {
          allKeys.add(`metadata_${key}`);
        });
      }
    });

    const headers = Array.from(allKeys);
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(item => {
      const row = headers.map(header => {
        let value;
        
        if (header.startsWith('metadata_')) {
          const metadataKey = header.replace('metadata_', '');
          value = item.metadata ? item.metadata[metadataKey] : '';
        } else {
          value = item[header];
        }
        
        // Handle arrays and objects
        if (Array.isArray(value)) {
          value = value.join('; ');
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        
        // Escape quotes and wrap in quotes if contains comma or quote
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""');
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value}"`;
          }
        }
        
        return value || '';
      });
      
      csvContent += row.join(',') + '\n';
    });

    return {
      data: csvContent,
      mimeType: 'text/csv',
      extension: 'csv',
      size: Buffer.byteLength(csvContent, 'utf8')
    };
  }

  /**
   * Export to BibTeX format
   */
  async exportToBibTeX(data, options) {
    let bibtexContent = '';
    
    data.forEach((item, index) => {
      const key = `item${index + 1}`;
      const entryType = this.getBibTeXEntryType(item.type);
      
      bibtexContent += `@${entryType}{${key},\n`;
      bibtexContent += `  title={${item.title}},\n`;
      
      if (item.author) {
        bibtexContent += `  author={${item.author}},\n`;
      }
      
      if (item.publishDate) {
        const year = new Date(item.publishDate).getFullYear();
        bibtexContent += `  year={${year}},\n`;
      }
      
      if (item.url) {
        bibtexContent += `  url={${item.url}},\n`;
      }
      
      if (item.type === 'paper' && item.metadata && item.metadata.paperSpecific) {
        const paperData = item.metadata.paperSpecific;
        if (paperData.doi) {
          bibtexContent += `  doi={${paperData.doi}},\n`;
        }
        if (paperData.abstract) {
          bibtexContent += `  abstract={${paperData.abstract}},\n`;
        }
      }
      
      bibtexContent += `  note={Retrieved from AI Information Aggregator}\n`;
      bibtexContent += '}\n\n';
    });

    return {
      data: bibtexContent,
      mimeType: 'application/x-bibtex',
      extension: 'bib',
      size: Buffer.byteLength(bibtexContent, 'utf8')
    };
  }

  /**
   * Get BibTeX entry type based on content type
   */
  getBibTeXEntryType(contentType) {
    const typeMap = {
      'article': 'article',
      'paper': 'article',
      'book': 'book',
      'podcast': 'misc',
      'video': 'misc',
      'social': 'misc',
      'newsletter': 'misc',
      'course': 'misc'
    };
    
    return typeMap[contentType] || 'misc';
  }

  /**
   * Export to RIS format
   */
  async exportToRIS(data, options) {
    let risContent = '';
    
    data.forEach(item => {
      const entryType = this.getRISEntryType(item.type);
      
      risContent += `TY  - ${entryType}\n`;
      risContent += `TI  - ${item.title}\n`;
      
      if (item.author) {
        // Split multiple authors
        const authors = item.author.split(',').map(a => a.trim());
        authors.forEach(author => {
          risContent += `AU  - ${author}\n`;
        });
      }
      
      if (item.publishDate) {
        const date = new Date(item.publishDate);
        risContent += `PY  - ${date.getFullYear()}\n`;
        risContent += `DA  - ${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}\n`;
      }
      
      if (item.url) {
        risContent += `UR  - ${item.url}\n`;
      }
      
      if (item.summary) {
        risContent += `AB  - ${item.summary}\n`;
      }
      
      if (item.categories && item.categories.length > 0) {
        item.categories.forEach(category => {
          risContent += `KW  - ${category}\n`;
        });
      }
      
      if (item.topics && item.topics.length > 0) {
        item.topics.forEach(topic => {
          risContent += `KW  - ${topic}\n`;
        });
      }
      
      risContent += 'ER  - \n\n';
    });

    return {
      data: risContent,
      mimeType: 'application/x-research-info-systems',
      extension: 'ris',
      size: Buffer.byteLength(risContent, 'utf8')
    };
  }

  /**
   * Get RIS entry type based on content type
   */
  getRISEntryType(contentType) {
    const typeMap = {
      'article': 'JOUR',
      'paper': 'JOUR',
      'book': 'BOOK',
      'podcast': 'SOUND',
      'video': 'VIDEO',
      'social': 'ICOMM',
      'newsletter': 'NEWS',
      'course': 'EDBOOK'
    };
    
    return typeMap[contentType] || 'GEN';
  }

  /**
   * Export to Markdown format
   */
  async exportToMarkdown(data, options) {
    let markdownContent = '# Exported Content\n\n';
    markdownContent += `*Exported on ${new Date().toLocaleDateString()}*\n\n`;
    markdownContent += `Total items: ${data.length}\n\n---\n\n`;
    
    data.forEach((item, index) => {
      markdownContent += `## ${index + 1}. ${item.title}\n\n`;
      
      if (item.author) {
        markdownContent += `**Author:** ${item.author}\n\n`;
      }
      
      if (item.publishDate) {
        markdownContent += `**Published:** ${new Date(item.publishDate).toLocaleDateString()}\n\n`;
      }
      
      if (item.type) {
        markdownContent += `**Type:** ${item.type}\n\n`;
      }
      
      if (item.categories && item.categories.length > 0) {
        markdownContent += `**Categories:** ${item.categories.join(', ')}\n\n`;
      }
      
      if (item.topics && item.topics.length > 0) {
        markdownContent += `**Topics:** ${item.topics.join(', ')}\n\n`;
      }
      
      if (item.summary) {
        markdownContent += `**Summary:**\n${item.summary}\n\n`;
      }
      
      if (item.keyInsights && item.keyInsights.length > 0) {
        markdownContent += `**Key Insights:**\n`;
        item.keyInsights.forEach(insight => {
          markdownContent += `- ${insight}\n`;
        });
        markdownContent += '\n';
      }
      
      if (item.url) {
        markdownContent += `**URL:** [${item.url}](${item.url})\n\n`;
      }
      
      if (item.citation) {
        markdownContent += `**Citation:** ${item.citation}\n\n`;
      }
      
      markdownContent += '---\n\n';
    });

    return {
      data: markdownContent,
      mimeType: 'text/markdown',
      extension: 'md',
      size: Buffer.byteLength(markdownContent, 'utf8')
    };
  }

  /**
   * Export to HTML format
   */
  async exportToHTML(data, options) {
    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Content - AI Information Aggregator</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #333; margin-bottom: 30px; padding-bottom: 20px; }
        .item { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .title { color: #333; margin-bottom: 10px; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 15px; }
        .summary { margin: 15px 0; }
        .insights { margin: 15px 0; }
        .insights ul { padding-left: 20px; }
        .citation { background: #f5f5f5; padding: 10px; border-left: 4px solid #007cba; margin: 15px 0; font-style: italic; }
        .tags { margin: 10px 0; }
        .tag { background: #e1f5fe; color: #01579b; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; margin-right: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Exported Content</h1>
        <p><em>Exported on ${new Date().toLocaleDateString()}</em></p>
        <p>Total items: ${data.length}</p>
    </div>
`;

    data.forEach((item, index) => {
      htmlContent += `    <div class="item">
        <h2 class="title">${index + 1}. ${this.escapeHtml(item.title)}</h2>
        <div class="meta">`;
      
      if (item.author) {
        htmlContent += `<strong>Author:</strong> ${this.escapeHtml(item.author)} | `;
      }
      
      if (item.publishDate) {
        htmlContent += `<strong>Published:</strong> ${new Date(item.publishDate).toLocaleDateString()} | `;
      }
      
      htmlContent += `<strong>Type:</strong> ${item.type}`;
      htmlContent += `</div>`;
      
      if (item.categories && item.categories.length > 0) {
        htmlContent += `<div class="tags">`;
        item.categories.forEach(category => {
          htmlContent += `<span class="tag">${this.escapeHtml(category)}</span>`;
        });
        htmlContent += `</div>`;
      }
      
      if (item.summary) {
        htmlContent += `<div class="summary"><strong>Summary:</strong><br>${this.escapeHtml(item.summary)}</div>`;
      }
      
      if (item.keyInsights && item.keyInsights.length > 0) {
        htmlContent += `<div class="insights"><strong>Key Insights:</strong><ul>`;
        item.keyInsights.forEach(insight => {
          htmlContent += `<li>${this.escapeHtml(insight)}</li>`;
        });
        htmlContent += `</ul></div>`;
      }
      
      if (item.url) {
        htmlContent += `<div><strong>URL:</strong> <a href="${item.url}" target="_blank">${this.escapeHtml(item.url)}</a></div>`;
      }
      
      if (item.citation) {
        htmlContent += `<div class="citation">${this.escapeHtml(item.citation)}</div>`;
      }
      
      htmlContent += `    </div>`;
    });

    htmlContent += `</body>
</html>`;

    return {
      data: htmlContent,
      mimeType: 'text/html',
      extension: 'html',
      size: Buffer.byteLength(htmlContent, 'utf8')
    };
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Get supported formats
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * Get supported citation styles
   */
  getSupportedCitationStyles() {
    return [...this.citationStyles];
  }
}

module.exports = ExportManager;