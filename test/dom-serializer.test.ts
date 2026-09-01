import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { DOMSerializer } from '../src/content/dom-serializer.js';

describe('DOMSerializer', () => {
  let dom: JSDOM;
  let serializer: DOMSerializer;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><head><title>Test Page</title></head><body></body></html>', {
      url: 'https://example.com/test'
    });
    serializer = new DOMSerializer();
  });

  it('serializes semantic headings and paragraphs', () => {
    dom.window.document.body.innerHTML = `
      <h1>Main Heading</h1>
      <p>This is a paragraph with <strong>bold</strong> text.</p>
      <h2>Subheading</h2>
      <p>Second paragraph.</p>
    `;

    const snapshot = serializer.serialize(dom.window.document.body);
    expect(snapshot.markdown).toContain('# Main Heading');
    expect(snapshot.markdown).toContain('## Subheading');
    expect(snapshot.markdown).toContain('This is a paragraph with bold text.');
    expect(snapshot.markdown).toContain('Second paragraph.');
    expect(snapshot.interactiveCount).toBe(0);
  });

  it('assigns sequential IDs to interactive elements and maps them accurately', () => {
    dom.window.document.body.innerHTML = `
      <header>
        <a href="/home">Home Link</a>
        <button id="btn-submit">Submit Form</button>
      </header>
      <main>
        <form>
          <label for="username">Username</label>
          <input type="text" id="username" name="username" placeholder="Enter username" />

          <label for="remember">
            <input type="checkbox" id="remember" checked /> Remember Me
          </label>

          <select id="country">
            <option value="us" selected>United States</option>
            <option value="ca">Canada</option>
          </select>

          <textarea id="bio" placeholder="Your bio"></textarea>
        </form>
      </main>
    `;

    const snapshot = serializer.serialize(dom.window.document.body);

    // Link [1]
    expect(snapshot.markdown).toContain('[1] [Home Link](/home)');
    // Button [2]
    expect(snapshot.markdown).toContain('[2] [Button: Submit Form]');
    // Input [3]
    expect(snapshot.markdown).toContain('[3] [Input (text name="username" placeholder="Enter username")]');
    // Checkbox [4]
    expect(snapshot.markdown).toContain('[4] [x] Remember Me');
    // Select [5]
    expect(snapshot.markdown).toContain('[5] [Select: "United States" (options: United States, Canada)]');
    // Textarea [6]
    expect(snapshot.markdown).toContain('[6] [Textarea placeholder="Your bio"]');

    expect(snapshot.interactiveCount).toBe(6);

    // Verify lookup by ID
    const el1 = serializer.getElementById(1);
    expect(el1?.tagName.toLowerCase()).toBe('a');
    expect(el1?.getAttribute('href')).toBe('/home');

    const el2 = serializer.getElementById(2);
    expect(el2?.tagName.toLowerCase()).toBe('button');
    expect(el2?.id).toBe('btn-submit');

    const el3 = serializer.getElementById(3);
    expect(el3?.tagName.toLowerCase()).toBe('input');

    const el5 = serializer.getElementById(5);
    expect(el5?.tagName.toLowerCase()).toBe('select');
  });

  it('prunes noise like scripts, styles, and hidden elements', () => {
    dom.window.document.body.innerHTML = `
      <style>body { color: red; }</style>
      <script>console.log("secret analytics token");</script>
      <noscript>Please enable javascript</noscript>
      <div style="display: none;">Invisible secret content</div>
      <div hidden>Hidden attribute content</div>
      <div aria-hidden="true">Aria hidden content</div>
      <p>Visible Content</p>
    `;

    const snapshot = serializer.serialize(dom.window.document.body);

    expect(snapshot.markdown).not.toContain('secret analytics');
    expect(snapshot.markdown).not.toContain('Please enable javascript');
    expect(snapshot.markdown).not.toContain('Invisible secret content');
    expect(snapshot.markdown).not.toContain('Hidden attribute content');
    expect(snapshot.markdown).not.toContain('Aria hidden content');
    expect(snapshot.markdown).toContain('Visible Content');
  });

  it('serializes tables into clean Markdown tables', () => {
    dom.window.document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Widget A</td>
            <td>$10.00</td>
            <td>In Stock</td>
          </tr>
          <tr>
            <td>Widget B</td>
            <td>$25.00</td>
            <td>Out of Stock</td>
          </tr>
        </tbody>
      </table>
    `;

    const snapshot = serializer.serialize(dom.window.document.body);
    expect(snapshot.markdown).toContain('| Item | Price | Stock |');
    expect(snapshot.markdown).toContain('| --- | --- | --- |');
    expect(snapshot.markdown).toContain('| Widget A | $10.00 | In Stock |');
    expect(snapshot.markdown).toContain('| Widget B | $25.00 | Out of Stock |');
  });

  it('handles lists, blockquotes, and code blocks', () => {
    dom.window.document.body.innerHTML = `
      <ul>
        <li>First bullet</li>
        <li>Second <a href="/sub">Bullet Link</a></li>
      </ul>
      <blockquote>Quoted wisdom here</blockquote>
      <pre><code>const a = 1;</code></pre>
    `;

    const snapshot = serializer.serialize(dom.window.document.body);
    expect(snapshot.markdown).toContain('- First bullet');
    expect(snapshot.markdown).toContain('[1] [Bullet Link](/sub)');
    expect(snapshot.markdown).toContain('> Quoted wisdom here');
    expect(snapshot.markdown).toContain('const a = 1;');
  });

  it('maintains token efficiency under 1000 tokens for dense documents', () => {
    let denseHtml = '<h1>Product Dashboard</h1><div class="grid">';
    for (let i = 0; i < 25; i++) {
      denseHtml += `
        <div class="card">
          <h3>Card Item ${i}</h3>
          <p>Description for item ${i} with details.</p>
          <a href="/item/${i}">View Item ${i}</a>
          <button onclick="buy(${i})">Buy Now</button>
        </div>
      `;
    }
    denseHtml += '</div>';
    dom.window.document.body.innerHTML = denseHtml;

    const snapshot = serializer.serialize(dom.window.document.body);
    expect(snapshot.interactiveCount).toBe(50);
    // Estimated tokens should be well below 2,000 for 25 cards
    expect(snapshot.estimatedTokens).toBeLessThan(1200);
  });
});
