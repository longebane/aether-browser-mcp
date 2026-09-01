import { DOMSerializerOptions, DOMSnapshot, InteractiveElementInfo } from '../types/index.js';

export class DOMSerializer {
  private elementMap: Map<number, HTMLElement> = new Map();
  private nextId = 1;
  private options: Required<DOMSerializerOptions>;

  constructor(options?: DOMSerializerOptions) {
    this.options = {
      maxDepth: options?.maxDepth ?? 32,
      viewportOnly: options?.viewportOnly ?? false,
      maxTextLength: options?.maxTextLength ?? 400,
      filterHidden: options?.filterHidden ?? true,
      compactLists: options?.compactLists ?? true
    };
  }

  /**
   * Updates serializer options dynamically
   */
  public setOptions(options?: DOMSerializerOptions): void {
    if (!options) return;
    if (options.maxDepth !== undefined) this.options.maxDepth = options.maxDepth;
    if (options.viewportOnly !== undefined) this.options.viewportOnly = options.viewportOnly;
    if (options.maxTextLength !== undefined) this.options.maxTextLength = options.maxTextLength;
    if (options.filterHidden !== undefined) this.options.filterHidden = options.filterHidden;
    if (options.compactLists !== undefined) this.options.compactLists = options.compactLists;
  }

  /**
   * Clears existing element mappings and resets counter
   */
  public reset(): void {
    this.elementMap.clear();
    this.nextId = 1;
  }

  /**
   * Retrieves an element by its assigned sequential ID
   */
  public getElementById(id: number): HTMLElement | undefined {
    return this.elementMap.get(id);
  }

  /**
   * Returns all active interactive element mappings
   */
  public getInteractiveElements(): Map<number, HTMLElement> {
    return this.elementMap;
  }

  /**
   * Serializes a document or root element to a token-pruned Markdown snapshot
   */
  public serialize(root: Document | HTMLElement = document): DOMSnapshot {
    this.reset();

    const targetElement = root instanceof Document ? root.body : root;
    if (!targetElement) {
      return {
        url: typeof window !== 'undefined' ? window.location?.href || '' : '',
        title: typeof document !== 'undefined' ? document.title || '' : '',
        markdown: '# Empty Document\n\nNo body content found.',
        elementCount: 0,
        interactiveCount: 0,
        estimatedTokens: 0,
        timestamp: Date.now()
      };
    }

    const rawMarkdown = this.traverseNode(targetElement, 0);
    const cleanedMarkdown = this.cleanMarkdown(rawMarkdown);

    const title = typeof document !== 'undefined' ? document.title : '';
    const url = typeof window !== 'undefined' ? window.location?.href || '' : '';

    const header = [
      url ? `**URL**: ${url}` : '',
      title ? `**Title**: ${title}` : '',
      '---',
      ''
    ].filter(Boolean).join('\n');

    const fullMarkdown = header ? `${header}\n${cleanedMarkdown}` : cleanedMarkdown;

    // Approximate token estimation: ~4 chars per token for English/code
    const estimatedTokens = Math.ceil(fullMarkdown.length / 4);

    return {
      url,
      title,
      markdown: fullMarkdown,
      elementCount: targetElement.getElementsByTagName('*').length,
      interactiveCount: this.elementMap.size,
      estimatedTokens,
      timestamp: Date.now()
    };
  }

  /**
   * Recursively traverses a DOM node to build markdown
   */
  private traverseNode(node: Node, depth: number): string {
    if (depth > this.options.maxDepth) {
      return '';
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, ' ') || '';
      return text.trim() ? `${text} ` : '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // 1. Filter non-semantic or invisible tags
    if (this.shouldIgnoreTag(tagName)) {
      return '';
    }

    // 2. Filter hidden elements
    if (this.options.filterHidden && this.isElementHidden(el)) {
      return '';
    }

    // 3. Check viewport filter if enabled
    if (this.options.viewportOnly && !this.isElementInViewport(el)) {
      return '';
    }

    // 4. Handle interactive and specialized elements
    const isInteractive = this.isInteractiveElement(el);
    let assignedId: number | null = null;

    if (isInteractive) {
      assignedId = this.nextId++;
      this.elementMap.set(assignedId, el);
      try {
        el.setAttribute('data-ag-id', String(assignedId));
      } catch {
        // Ignore if read-only attribute
      }
    }

    // 5. Render specific tag structures
    return this.renderElement(el, tagName, assignedId, depth);
  }

  /**
   * Renders element according to its semantic role and HTML tag
   */
  private renderElement(
    el: HTMLElement,
    tagName: string,
    id: number | null,
    depth: number
  ): string {
    const idPrefix = id !== null ? `[${id}] ` : '';

    switch (tagName) {
      case 'h1':
        return `\n\n# ${idPrefix}${this.getTextContent(el).trim()}\n\n`;
      case 'h2':
        return `\n\n## ${idPrefix}${this.getTextContent(el).trim()}\n\n`;
      case 'h3':
        return `\n\n### ${idPrefix}${this.getTextContent(el).trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${idPrefix}${this.getTextContent(el).trim()}\n\n`;
      case 'h5':
        return `\n\n##### ${idPrefix}${this.getTextContent(el).trim()}\n\n`;
      case 'h6':
        return `\n\n###### ${idPrefix}${this.getTextContent(el).trim()}\n\n`;

      case 'p':
        return `\n\n${this.renderChildren(el, depth + 1).trim()}\n\n`;

      case 'a': {
        const href = el.getAttribute('href') || '';
        const linkText = this.getTextContent(el).trim() || el.getAttribute('title') || el.getAttribute('aria-label') || href;
        if (!href && !linkText) return '';
        const cleanHref = href.startsWith('javascript:') ? '' : href;
        return `${idPrefix}[${this.sanitizeText(linkText)}](${cleanHref}) `;
      }

      case 'button': {
        const btnText = this.getInteractiveLabel(el, 'Button');
        return `${idPrefix}[Button: ${btnText}] `;
      }

      case 'input': {
        const inputEl = el as HTMLInputElement;
        const type = (inputEl.getAttribute('type') || 'text').toLowerCase();

        if (type === 'hidden') return '';

        if (type === 'checkbox') {
          const checked = inputEl.checked ? 'x' : ' ';
          const label = this.getAssociatedLabel(inputEl);
          return `${idPrefix}[${checked}] ${label} `;
        }

        if (type === 'radio') {
          const checked = inputEl.checked ? '*' : ' ';
          const label = this.getAssociatedLabel(inputEl);
          return `${idPrefix}(${checked}) ${label} `;
        }

        if (type === 'submit' || type === 'button' || type === 'reset') {
          const val = inputEl.value || inputEl.getAttribute('aria-label') || 'Submit';
          return `${idPrefix}[Button: ${val}] `;
        }

        const value = inputEl.value ? ` value="${this.sanitizeText(inputEl.value)}"` : '';
        const placeholder = inputEl.placeholder ? ` placeholder="${this.sanitizeText(inputEl.placeholder)}"` : '';
        const name = inputEl.name ? ` name="${inputEl.name}"` : '';
        return `${idPrefix}[Input (${type}${name}${placeholder}${value})] `;
      }

      case 'textarea': {
        const textEl = el as HTMLTextAreaElement;
        const val = textEl.value ? ` value="${this.sanitizeText(textEl.value)}"` : '';
        const ph = textEl.placeholder ? ` placeholder="${this.sanitizeText(textEl.placeholder)}"` : '';
        return `${idPrefix}[Textarea${ph}${val}] `;
      }

      case 'select': {
        const selectEl = el as HTMLSelectElement;
        const selectedOption = selectEl.options?.[selectEl.selectedIndex]?.text || '';
        const optionsList = Array.from(selectEl.options || [])
          .slice(0, 8)
          .map((opt) => opt.text.trim())
          .filter(Boolean)
          .join(', ');
        return `${idPrefix}[Select: "${selectedOption}" (options: ${optionsList})] `;
      }

      case 'ul':
      case 'ol':
        return `\n${this.renderChildren(el, depth + 1)}\n`;

      case 'li': {
        const content = this.renderChildren(el, depth + 1).trim();
        return content ? `\n- ${idPrefix}${content}` : '';
      }

      case 'table':
        return `\n\n${this.renderTable(el as HTMLTableElement, depth + 1)}\n\n`;

      case 'img': {
        const alt = el.getAttribute('alt') || el.getAttribute('aria-label') || '';
        const src = el.getAttribute('src') || '';
        if (!alt && !src) return '';
        // Skip tracking pixels or data URIs with no alt
        if (src.startsWith('data:') && !alt) return '';
        return alt ? `![${this.sanitizeText(alt)}] ` : '';
      }

      case 'blockquote':
        return `\n\n> ${this.renderChildren(el, depth + 1).trim()}\n\n`;

      case 'code':
      case 'pre': {
        const text = this.getTextContent(el).trim();
        if (tagName === 'pre' || text.includes('\n')) {
          return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
        }
        return ` \`${text}\` `;
      }

      case 'hr':
        return '\n\n---\n\n';

      case 'br':
        return '\n';

      default: {
        // Generic container or ARIA role
        const role = el.getAttribute('role')?.toLowerCase();
        if (role === 'button' && id !== null) {
          const btnText = this.getInteractiveLabel(el, 'Button');
          return `${idPrefix}[Button: ${btnText}] `;
        }
        if (role === 'tab' && id !== null) {
          const tabText = this.getInteractiveLabel(el, 'Tab');
          return `${idPrefix}[Tab: ${tabText}] `;
        }
        if (role === 'link' && id !== null) {
          const linkText = this.getInteractiveLabel(el, 'Link');
          return `${idPrefix}[${linkText}] `;
        }
        if (role === 'checkbox' && id !== null) {
          const checked = el.getAttribute('aria-checked') === 'true' ? 'x' : ' ';
          const label = this.getInteractiveLabel(el, 'Checkbox');
          return `${idPrefix}[${checked}] ${label} `;
        }

        const childContent = this.renderChildren(el, depth + 1);
        if (this.isBlockElement(tagName)) {
          return `\n${childContent}\n`;
        }
        return childContent;
      }
    }
  }

  /**
   * Renders child nodes
   */
  private renderChildren(el: HTMLElement, depth: number): string {
    let result = '';
    const childNodes = Array.from(el.childNodes);
    for (const child of childNodes) {
      result += this.traverseNode(child, depth);
    }
    return result;
  }

  /**
   * Renders HTML Table into clean Markdown Table
   */
  private renderTable(table: HTMLTableElement, depth: number): string {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    const lines: string[] = [];
    let hasHeader = false;

    rows.forEach((row, index) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (cells.length === 0) return;

      const rowText = cells
        .map((c) => this.getTextContent(c as HTMLElement).replace(/\|/g, '\\|').trim())
        .join(' | ');

      lines.push(`| ${rowText} |`);

      if (index === 0) {
        hasHeader = cells[0].tagName.toLowerCase() === 'th' || rows.length > 1;
        const separator = cells.map(() => '---').join(' | ');
        lines.push(`| ${separator} |`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Determines whether a tag is purely technical/noise
   */
  private shouldIgnoreTag(tagName: string): boolean {
    const ignored = [
      'script',
      'style',
      'noscript',
      'template',
      'meta',
      'link',
      'head',
      'svg', // Handled via aria-label or parent button
      'path',
      'canvas',
      'iframe'
    ];
    return ignored.includes(tagName);
  }

  /**
   * Checks if an element is hidden via CSS or HTML attributes
   */
  private isElementHidden(el: HTMLElement): boolean {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') {
      // If it contains an interactive element, we might still want to check
      return true;
    }

    if (typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        ) {
          return true;
        }
      } catch {
        // getComputedStyle may fail in non-browser/detached environments
      }
    }

    // Inline style fallback
    const styleAttr = el.getAttribute('style') || '';
    if (
      /display\s*:\s*none/i.test(styleAttr) ||
      /visibility\s*:\s*hidden/i.test(styleAttr) ||
      /opacity\s*:\s*0(\.0*)?(;|$)/i.test(styleAttr)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Checks if an element is within current viewport boundaries
   */
  private isElementInViewport(el: HTMLElement): boolean {
    if (typeof window === 'undefined' || !el.getBoundingClientRect) {
      return true;
    }
    try {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;

      return (
        rect.top < windowHeight &&
        rect.bottom > 0 &&
        rect.left < windowWidth &&
        rect.right > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    } catch {
      return true;
    }
  }

  /**
   * Determines if a node is an interactive target
   */
  private isInteractiveElement(el: HTMLElement): boolean {
    const tagName = el.tagName.toLowerCase();

    if (tagName === 'a' && (el.hasAttribute('href') || el.hasAttribute('tabindex'))) {
      return true;
    }

    if (['button', 'select', 'textarea'].includes(tagName)) {
      return true;
    }

    if (tagName === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return type !== 'hidden';
    }

    const role = el.getAttribute('role')?.toLowerCase();
    if (['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch', 'combobox', 'option'].includes(role || '')) {
      return true;
    }

    if (el.hasAttribute('onclick') || el.getAttribute('contenteditable') === 'true') {
      return true;
    }

    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && parseInt(tabindex, 10) >= 0) {
      return true;
    }

    return false;
  }

  /**
   * Extracts clean text content with truncation
   */
  private getTextContent(el: HTMLElement): string {
    let text = el.innerText || el.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > this.options.maxTextLength) {
      return text.slice(0, this.options.maxTextLength) + '...';
    }
    return text;
  }

  /**
   * Retrieves an accessible label or fallback text for an interactive element
   */
  private getInteractiveLabel(el: HTMLElement, defaultFallback: string): string {
    const text = this.getTextContent(el).trim();
    if (text) return this.sanitizeText(text);

    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
    if (ariaLabel) return this.sanitizeText(ariaLabel);

    const img = el.querySelector('img');
    if (img && img.getAttribute('alt')) {
      return this.sanitizeText(img.getAttribute('alt')!);
    }

    return defaultFallback;
  }

  /**
   * Finds label associated with an input element
   */
  private getAssociatedLabel(input: HTMLInputElement): string {
    if (input.id && typeof document !== 'undefined') {
      try {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return this.getTextContent(label as HTMLElement).trim();
      } catch {
        // Query selector failed
      }
    }

    const parentLabel = input.closest('label');
    if (parentLabel) {
      return this.getTextContent(parentLabel).trim();
    }

    const ariaLabel = input.getAttribute('aria-label') || input.getAttribute('title');
    if (ariaLabel) return ariaLabel.trim();

    return input.name || input.value || '';
  }

  /**
   * Sanitizes markdown special characters inside titles / labels
   */
  private sanitizeText(str: string): string {
    return str
      .replace(/[\r\n]+/g, ' ')
      .replace(/\[/g, '(')
      .replace(/\]/g, ')')
      .trim();
  }

  /**
   * Determines block-level elements for spacing
   */
  private isBlockElement(tagName: string): boolean {
    const blockTags = [
      'div', 'section', 'article', 'main', 'header', 'footer', 'nav',
      'aside', 'form', 'fieldset', 'details', 'summary'
    ];
    return blockTags.includes(tagName);
  }

  /**
   * Cleans excessive whitespace, empty lines, and redundant separators
   */
  private cleanMarkdown(md: string): string {
    return md
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
