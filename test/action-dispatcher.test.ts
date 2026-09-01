import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DOMSerializer } from '../src/content/dom-serializer.js';
import { ActionDispatcher } from '../src/content/action-dispatcher.js';

describe('ActionDispatcher', () => {
  let dom: JSDOM;
  let serializer: DOMSerializer;
  let dispatcher: ActionDispatcher;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com'
    });
    serializer = new DOMSerializer();
    dispatcher = new ActionDispatcher(serializer);
  });

  it('handles click events on buttons', async () => {
    let clicked = false;
    const btn = dom.window.document.createElement('button');
    btn.textContent = 'Click Me';
    btn.addEventListener('click', () => {
      clicked = true;
    });
    dom.window.document.body.appendChild(btn);

    serializer.serialize(dom.window.document.body);
    const result = await dispatcher.execute({
      action: 'click',
      elementId: 1
    });

    expect(result.success).toBe(true);
    expect(clicked).toBe(true);
  });

  it('handles typing into input fields and triggers input & change events', async () => {
    let inputEventFired = false;
    let changeEventFired = false;

    const input = dom.window.document.createElement('input');
    input.type = 'text';
    input.addEventListener('input', () => {
      inputEventFired = true;
    });
    input.addEventListener('change', () => {
      changeEventFired = true;
    });
    dom.window.document.body.appendChild(input);

    serializer.serialize(dom.window.document.body);
    const result = await dispatcher.execute({
      action: 'type',
      elementId: 1,
      text: 'Antigravity rocks'
    });

    expect(result.success).toBe(true);
    expect(input.value).toBe('Antigravity rocks');
    expect(inputEventFired).toBe(true);
    expect(changeEventFired).toBe(true);
  });

  it('handles selecting options from a select dropdown', async () => {
    let changeFired = false;
    const select = dom.window.document.createElement('select');
    select.innerHTML = `
      <option value="opt1">Option 1</option>
      <option value="opt2">Option 2</option>
      <option value="opt3">Option 3</option>
    `;
    select.addEventListener('change', () => {
      changeFired = true;
    });
    dom.window.document.body.appendChild(select);

    serializer.serialize(dom.window.document.body);
    const result = await dispatcher.execute({
      action: 'select',
      elementId: 1,
      value: 'Option 2'
    });

    expect(result.success).toBe(true);
    expect(select.value).toBe('opt2');
    expect(changeFired).toBe(true);
  });

  it('handles clearing an input field', async () => {
    const input = dom.window.document.createElement('input');
    input.value = 'Initial Value';
    dom.window.document.body.appendChild(input);

    serializer.serialize(dom.window.document.body);
    const result = await dispatcher.execute({
      action: 'clear',
      elementId: 1
    });

    expect(result.success).toBe(true);
    expect(input.value).toBe('');
  });

  it('returns structured error when elementId is not found', async () => {
    serializer.serialize(dom.window.document.body);
    const result = await dispatcher.execute({
      action: 'click',
      elementId: 999
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Element with ID [999] not found');
  });
});
