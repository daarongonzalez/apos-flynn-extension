// Draws the outlines and labels in a sealed layer on top of the page, so the site's
// styles and Flynn's styles never affect each other.

const CSS = `
.layer { position: fixed; inset: 0; pointer-events: none; font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.box { position: absolute; top: 0; left: 0; box-sizing: border-box; border: 1.5px dashed #fdb515; border-radius: 4px; }
.box.hover { background: rgba(253, 181, 21, 0.14); }
.box.changed { border: 2px solid #fdb515; background: rgba(253, 181, 21, 0.12); }
.box.editing { border: 2px solid #17499f; background: none; box-shadow: 0 0 0 3px rgba(23, 73, 159, 0.2); }
.box.flash { box-shadow: 0 0 0 6px rgba(253, 181, 21, 0.55); transition: box-shadow 0.2s; }
.chip { position: absolute; left: -2px; top: -15px; padding: 2px 4px; border-radius: 3px; background: #fdb515; color: #1b1400; white-space: nowrap; letter-spacing: 0.02em; }
.box.inside .chip { top: 0; left: 0; }
.box.editing .chip { background: #17499f; color: #fff; }
`;

export interface BoxState {
  label: string;
  changed: boolean;
  editing: boolean;
  hover: boolean;
  flash: boolean;
}

const PAD = 4;

export class Overlay {
  readonly host: HTMLElement;
  private layer: HTMLElement;
  private boxes = new Map<Element, HTMLElement>();

  constructor() {
    this.host = document.createElement('flynn-overlay');
    this.host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
    const root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.layer = document.createElement('div');
    this.layer.className = 'layer';
    root.append(style, this.layer);
    document.documentElement.appendChild(this.host);
  }

  setVisible(on: boolean): void {
    this.layer.style.display = on ? '' : 'none';
  }

  draw(elements: Element[], stateOf: (el: Element) => BoxState): void {
    const seen = new Set<Element>();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;
      seen.add(el);
      let box = this.boxes.get(el);
      if (!box) {
        box = document.createElement('div');
        box.appendChild(document.createElement('span')).className = 'chip';
        this.layer.appendChild(box);
        this.boxes.set(el, box);
      }
      const state = stateOf(el);
      box.style.transform = `translate(${rect.left - PAD}px, ${rect.top - PAD}px)`;
      box.style.width = `${rect.width + PAD * 2}px`;
      box.style.height = `${rect.height + PAD * 2}px`;
      box.className =
        'box' +
        (state.changed ? ' changed' : '') +
        (state.editing ? ' editing' : '') +
        (state.hover ? ' hover' : '') +
        (state.flash ? ' flash' : '') +
        (rect.top < 20 ? ' inside' : '');
      const chip = box.firstElementChild as HTMLElement;
      if (chip.textContent !== state.label) chip.textContent = state.label;
    }
    for (const [el, box] of this.boxes) {
      if (!seen.has(el)) {
        box.remove();
        this.boxes.delete(el);
      }
    }
  }
}
