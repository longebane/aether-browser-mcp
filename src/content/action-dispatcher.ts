import { ActionResult, BrowserAction } from '../types/index.js';
import { DOMSerializer } from './dom-serializer.js';

export class ActionDispatcher {
  private currentPos: { x: number; y: number } | null = null;
  private cursorElement: HTMLElement | null = null;

  constructor(private serializer: DOMSerializer) {}

  /**
   * Dispatches a browser automation action with human-like mouse glide
   */
  public async execute(action: BrowserAction): Promise<ActionResult> {
    try {
      switch (action.action) {
        case 'click':
          return await this.handleClick(action.elementId);
        case 'type':
          return await this.handleType(
            action.elementId,
            action.text ?? action.value ?? '',
            action.clearExisting ?? true,
            action.pressEnter ?? false
          );
        case 'select':
          return await this.handleSelect(action.elementId, action.value ?? action.text ?? '');
        case 'scroll':
          return await this.handleScroll(action);
        case 'hover':
          return await this.handleHover(action.elementId);
        case 'press_key':
          return await this.handlePressKey(action.elementId, action.key || 'Enter');
        case 'focus':
          return await this.handleFocus(action.elementId);
        case 'clear':
          return await this.handleClear(action.elementId);
        default:
          return {
            success: false,
            action: action.action,
            error: `Unsupported action: ${(action as any).action}`
          };
      }
    } catch (err: any) {
      return {
        success: false,
        action: action.action,
        elementId: action.elementId,
        error: err?.message || String(err)
      };
    }
  }

  private getElement(elementId?: number): HTMLElement {
    if (elementId === undefined || elementId === null) {
      throw new Error('Element ID is required for this action.');
    }
    let el = this.serializer.getElementById(elementId);
    if (!el && typeof document !== 'undefined') {
      el = document.querySelector(`[data-ag-id="${elementId}"]`) as HTMLElement;
    }
    if (!el) {
      throw new Error(`Element with ID [${elementId}] not found or is no longer in the DOM.`);
    }
    return el;
  }

  private async handleClick(elementId?: number): Promise<ActionResult> {
    const el = this.getElement(elementId);

    // Scroll into view & Human mouse glide
    this.scrollIntoViewIfNeeded(el);
    await this.glideMouseTo(el, `[${elementId}] Click`);

    // Focus element
    el.focus?.();

    // High fidelity pointer + mouse sequence with click ripple
    this.triggerClickRipple();
    this.dispatchMouseEvent(el, 'pointerover');
    this.dispatchMouseEvent(el, 'mouseover');
    this.dispatchMouseEvent(el, 'pointerdown');
    this.dispatchMouseEvent(el, 'mousedown');
    
    await this.sleep(40 + Math.random() * 40); // Human click hold duration

    this.dispatchMouseEvent(el, 'pointerup');
    this.dispatchMouseEvent(el, 'mouseup');
    
    // Standard click event
    el.click();

    // Checkbox / Radio state toggle fallback
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input') {
      const type = (el as HTMLInputElement).type?.toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        this.dispatchSyntheticEvent(el, 'input');
        this.dispatchSyntheticEvent(el, 'change');
      }
    }

    return {
      success: true,
      action: 'click',
      elementId,
      details: `Clicked [${elementId}] <${el.tagName.toLowerCase()}>`
    };
  }

  private async handleType(
    elementId?: number,
    text: string = '',
    clearExisting: boolean = true,
    pressEnter: boolean = false
  ): Promise<ActionResult> {
    const el = this.getElement(elementId);
    this.scrollIntoViewIfNeeded(el);
    await this.glideMouseTo(el, `[${elementId}] Type`);

    el.focus?.();
    this.triggerClickRipple();
    this.dispatchMouseEvent(el, 'click');

    const tagName = el.tagName.toLowerCase();
    const defaultView = el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);

    if (tagName === 'input' || tagName === 'textarea') {
      const proto = tagName === 'input'
        ? (defaultView as any)?.HTMLInputElement?.prototype || (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement.prototype : null)
        : (defaultView as any)?.HTMLTextAreaElement?.prototype || (typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement.prototype : null);
      
      const valueSetter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

      let newValue = text;
      if (!clearExisting) {
        newValue = (inputEl.value || '') + text;
      }

      if (valueSetter) {
        valueSetter.call(el, newValue);
      } else {
        inputEl.value = newValue;
      }

      this.dispatchSyntheticEvent(el, 'input');
      this.dispatchSyntheticEvent(el, 'change');
    } else if (el.isContentEditable) {
      if (clearExisting) {
        el.innerText = text;
      } else {
        el.innerText += text;
      }
      this.dispatchSyntheticEvent(el, 'input');
    } else {
      throw new Error(`Element [${elementId}] is not an input, textarea, or editable element.`);
    }

    if (pressEnter) {
      await this.sleep(80);
      await this.handlePressKey(elementId, 'Enter');
    }

    return {
      success: true,
      action: 'type',
      elementId,
      details: `Typed "${text}" into [${elementId}]`
    };
  }

  private async handleSelect(elementId?: number, valueOrText: string = ''): Promise<ActionResult> {
    const el = this.getElement(elementId);
    const tagName = el.tagName.toLowerCase();
    if (tagName !== 'select') {
      throw new Error(`Element [${elementId}] is not a <select> element.`);
    }

    this.scrollIntoViewIfNeeded(el);
    await this.glideMouseTo(el, `[${elementId}] Select`);
    el.focus?.();

    const selectEl = el as HTMLSelectElement;
    let matched = false;
    const target = valueOrText.toLowerCase().trim();

    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      if (
        opt.value.toLowerCase() === target ||
        opt.text.toLowerCase() === target ||
        opt.text.toLowerCase().includes(target)
      ) {
        selectEl.selectedIndex = i;
        opt.selected = true;
        matched = true;
        break;
      }
    }

    if (!matched && selectEl.options.length > 0) {
      const index = parseInt(valueOrText, 10);
      if (!isNaN(index) && index >= 0 && index < selectEl.options.length) {
        selectEl.selectedIndex = index;
        selectEl.options[index].selected = true;
        matched = true;
      }
    }

    if (!matched) {
      throw new Error(`Could not find option "${valueOrText}" in select [${elementId}].`);
    }

    this.dispatchSyntheticEvent(el, 'input');
    this.dispatchSyntheticEvent(el, 'change');

    return {
      success: true,
      action: 'select',
      elementId,
      details: `Selected "${selectEl.options[selectEl.selectedIndex].text}" in [${elementId}]`
    };
  }

  private async handleScroll(action: BrowserAction): Promise<ActionResult> {
    const amount = action.scrollAmount ?? 500;
    const defaultView = typeof window !== 'undefined' ? window : null;
    let targetEl: any = defaultView;

    if (action.elementId) {
      targetEl = this.getElement(action.elementId);
      await this.glideMouseTo(targetEl, 'Scroll');
    }

    if (targetEl && typeof targetEl.scrollBy === 'function') {
      if (action.scrollDelta) {
        targetEl.scrollBy({
          left: action.scrollDelta.x,
          top: action.scrollDelta.y,
          behavior: 'smooth'
        });
        return {
          success: true,
          action: 'scroll',
          details: `Scrolled by delta (${action.scrollDelta.x}, ${action.scrollDelta.y})`
        };
      }

      switch (action.scrollDirection) {
        case 'up':
          targetEl.scrollBy({ top: -amount, behavior: 'smooth' });
          break;
        case 'down':
          targetEl.scrollBy({ top: amount, behavior: 'smooth' });
          break;
        case 'top':
          targetEl.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'bottom':
          targetEl.scrollTo({
            top: targetEl.scrollHeight || 999999,
            behavior: 'smooth'
          });
          break;
        default:
          targetEl.scrollBy({ top: amount, behavior: 'smooth' });
      }
    }

    return {
      success: true,
      action: 'scroll',
      details: `Scrolled ${action.scrollDirection || 'down'} by ${amount}px`
    };
  }

  private async handleHover(elementId?: number): Promise<ActionResult> {
    const el = this.getElement(elementId);
    this.scrollIntoViewIfNeeded(el);
    await this.glideMouseTo(el, `[${elementId}] Hover`);

    this.dispatchMouseEvent(el, 'pointerover');
    this.dispatchMouseEvent(el, 'mouseover');
    this.dispatchMouseEvent(el, 'pointerenter');
    this.dispatchMouseEvent(el, 'mouseenter');

    return {
      success: true,
      action: 'hover',
      elementId,
      details: `Hovered over [${elementId}]`
    };
  }

  private async handlePressKey(elementId?: number, key: string = 'Enter'): Promise<ActionResult> {
    const defaultDoc = typeof document !== 'undefined' ? document : null;
    const target = elementId ? this.getElement(elementId) : (defaultDoc?.activeElement as HTMLElement) || defaultDoc?.body;

    if (!target) {
      throw new Error('No target element available to receive key event.');
    }

    const keyCodeMap: Record<string, number> = {
      Enter: 13,
      Tab: 9,
      Escape: 27,
      Backspace: 8,
      ArrowDown: 40,
      ArrowUp: 38,
      Space: 32
    };

    const keyCode = keyCodeMap[key] || key.charCodeAt(0) || 0;

    const keyEventInit: KeyboardEventInit = {
      key,
      code: key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    };

    const KeyboardEventClass = target.ownerDocument?.defaultView?.KeyboardEvent || (typeof KeyboardEvent !== 'undefined' ? KeyboardEvent : null);
    if (KeyboardEventClass) {
      target.dispatchEvent(new KeyboardEventClass('keydown', keyEventInit));
      target.dispatchEvent(new KeyboardEventClass('keypress', keyEventInit));
      target.dispatchEvent(new KeyboardEventClass('keyup', keyEventInit));
    }

    // Form submit on Enter
    if (key === 'Enter' && target.tagName.toLowerCase() === 'input') {
      const form = (target as HTMLInputElement).form;
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
        if (submitBtn) {
          submitBtn.click();
        } else if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        }
      }
    }

    return {
      success: true,
      action: 'press_key',
      elementId,
      details: `Pressed key "${key}" on [${elementId ?? 'active'}]`
    };
  }

  private async handleFocus(elementId?: number): Promise<ActionResult> {
    const el = this.getElement(elementId);
    this.scrollIntoViewIfNeeded(el);
    await this.glideMouseTo(el, `[${elementId}] Focus`);
    el.focus?.();
    return {
      success: true,
      action: 'focus',
      elementId,
      details: `Focused [${elementId}]`
    };
  }

  private async handleClear(elementId?: number): Promise<ActionResult> {
    const el = this.getElement(elementId);
    await this.glideMouseTo(el, `[${elementId}] Clear`);

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
      inputEl.value = '';
      this.dispatchSyntheticEvent(el, 'input');
      this.dispatchSyntheticEvent(el, 'change');
    } else if (el.isContentEditable) {
      el.innerText = '';
      this.dispatchSyntheticEvent(el, 'input');
    }
    return {
      success: true,
      action: 'clear',
      elementId,
      details: `Cleared content of [${elementId}]`
    };
  }

  // =========================================================================
  // Human-Like Mouse Trajectory & Visual Glide Engine
  // =========================================================================

  private async glideMouseTo(targetEl: HTMLElement, label?: string): Promise<void> {
    try {
      const doc = targetEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
      if (!doc || !doc.body) return;

      const rect = targetEl.getBoundingClientRect();
      const scrollX = doc.defaultView?.scrollX || 0;
      // Safe inner landing boundary (10-12% padding from border so click never misses clickable area)
      const padX = Math.max(3, Math.min(rect.width * 0.12, 14));
      const padY = Math.max(3, Math.min(rect.height * 0.12, 8));

      const availableW = Math.max(2, rect.width - padX * 2);
      const availableH = Math.max(2, rect.height - padY * 2);

      // Natural Gaussian (normal) distribution centered around element's visual center
      const rawOffsetX = this.gaussianRandom() * (availableW * 0.18);
      const rawOffsetY = this.gaussianRandom() * (availableH * 0.18);

      const clampedOffsetX = Math.max(-availableW / 2, Math.min(availableW / 2, rawOffsetX));
      const clampedOffsetY = Math.max(-availableH / 2, Math.min(availableH / 2, rawOffsetY));

      const destX = rect.left + scrollX + rect.width / 2 + clampedOffsetX;
      const destY = rect.top + scrollY + rect.height / 2 + clampedOffsetY;

      // Initialize start point if not set
      if (!this.currentPos) {
        const viewW = doc.defaultView?.innerWidth || 1200;
        const viewH = doc.defaultView?.innerHeight || 800;
        this.currentPos = { x: scrollX + viewW * 0.5, y: scrollY + viewH * 0.4 };
      }

      const startX = this.currentPos.x;
      const startY = this.currentPos.y;
      const dx = destX - startX;
      const dy = destY - startY;
      const distance = Math.hypot(dx, dy);

      // Create / get visual cursor overlay
      this.ensureCursorElement(doc, label);

      // Number of interpolation steps (scaled to distance)
      const steps = Math.max(12, Math.min(28, Math.floor(distance / 35)));
      const curveStrength = (Math.random() - 0.5) * 60; // Natural curved deviation

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Cubic ease-in-out curve
        const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Quadratic Bezier interpolation with slight random micro-jitter
        const cx = startX + dx * 0.5 + curveStrength;
        const cy = startY + dy * 0.5 - curveStrength;
        const currentX = (1 - easeT) * (1 - easeT) * startX + 2 * (1 - easeT) * easeT * cx + easeT * easeT * destX;
        const currentY = (1 - easeT) * (1 - easeT) * startY + 2 * (1 - easeT) * easeT * cy + easeT * easeT * destY;

        this.updateCursorPosition(currentX, currentY);

        // Dispatch intermediate mousemove for anti-bot continuous trajectory heuristics
        const viewportX = currentX - scrollX;
        const viewportY = currentY - scrollY;
        const hoveredNode = doc.elementFromPoint(viewportX, viewportY) as HTMLElement;
        if (hoveredNode) {
          this.dispatchMouseEvent(hoveredNode, 'mousemove', { clientX: viewportX, clientY: viewportY });
        }

        await this.sleep(12 + Math.random() * 8); // 60Hz - 80Hz human sampling
      }

      this.currentPos = { x: destX, y: destY };
      this.updateCursorPosition(destX, destY);

      // Highlight target element with glowing ring
      this.highlightElement(targetEl);

      // Human pre-click hesitation
      await this.sleep(40 + Math.random() * 50);
    } catch {
      // Ignore visual overlay errors in test/mock environments
    }
  }

  private ensureCursorElement(doc: Document, label?: string): HTMLElement {
    if (!this.cursorElement || !doc.body.contains(this.cursorElement)) {
      const el = doc.createElement('div');
      el.id = '__ag_agent_cursor';
      el.style.cssText = `
        position: absolute;
        left: ${this.currentPos?.x || 0}px;
        top: ${this.currentPos?.y || 0}px;
        pointer-events: none;
        z-index: 2147483647;
        transition: transform 0.1s ease;
        display: flex;
        align-items: flex-start;
      `;

      el.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));">
          <path d="M5.5 3.5L11.5 20.5L14.5 13.5L21.5 10.5L5.5 3.5Z" fill="#38bdf8" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
        <div id="__ag_cursor_badge" style="
          margin-left: 4px;
          margin-top: 10px;
          background: #0f172a;
          color: #38bdf8;
          font-family: -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 5px;
          border: 1px solid #38bdf8;
          white-space: nowrap;
          box-shadow: 0 0 10px rgba(56,189,248,0.5);
        ">${label || 'Aether'}</div>
      `;

      doc.body.appendChild(el);
      this.cursorElement = el;
    } else if (label) {
      const badge = this.cursorElement.querySelector('#__ag_cursor_badge');
      if (badge) badge.textContent = label;
    }

    return this.cursorElement;
  }

  private updateCursorPosition(x: number, y: number): void {
    if (this.cursorElement) {
      this.cursorElement.style.left = `${x}px`;
      this.cursorElement.style.top = `${y}px`;
    }
  }

  private triggerClickRipple(): void {
    if (this.cursorElement) {
      this.cursorElement.style.transform = 'scale(0.82)';
      setTimeout(() => {
        if (this.cursorElement) {
          this.cursorElement.style.transform = 'scale(1)';
        }
      }, 120);
    }
  }

  private highlightElement(el: HTMLElement): void {
    const originalOutline = el.style.outline;
    const originalTransition = el.style.transition;
    el.style.transition = 'outline 0.15s ease-in-out';
    el.style.outline = '2px solid #38bdf8';

    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.transition = originalTransition;
    }, 800);
  }

  private scrollIntoViewIfNeeded(el: HTMLElement): void {
    try {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    } catch {
      // Fallback
    }
  }

  private dispatchMouseEvent(el: HTMLElement, eventType: string, coords?: { clientX: number; clientY: number }): void {
    try {
      const MouseEventClass = el.ownerDocument?.defaultView?.MouseEvent || (typeof MouseEvent !== 'undefined' ? MouseEvent : null);
      if (MouseEventClass) {
        const event = new MouseEventClass(eventType, {
          bubbles: true,
          cancelable: true,
          view: el.ownerDocument?.defaultView || undefined,
          clientX: coords?.clientX,
          clientY: coords?.clientY
        });
        el.dispatchEvent(event);
      }
    } catch {
      // Fallback
    }
  }

  private dispatchSyntheticEvent(el: HTMLElement, eventType: string): void {
    try {
      const EventClass = el.ownerDocument?.defaultView?.Event || (typeof Event !== 'undefined' ? Event : null);
      if (EventClass) {
        const event = new EventClass(eventType, {
          bubbles: true,
          cancelable: true
        });
        el.dispatchEvent(event);
      }
    } catch {
      // Fallback
    }
  }

  /**
   * Generates a normal (Gaussian) distributed random float with mean 0 and stdDev 1
   * using the Box-Muller transform.
   */
  private gaussianRandom(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
