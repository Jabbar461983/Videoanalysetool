import { describe, expect, it } from 'vitest';
import { istEingabeFeld } from '../src/layout/eingabe';

describe('istEingabeFeld', () => {
  it('erkennt Eingabefelder im eigenen Fenster', () => {
    expect(istEingabeFeld(document.createElement('input'))).toBe(true);
    expect(istEingabeFeld(document.createElement('textarea'))).toBe(true);
    expect(istEingabeFeld(document.createElement('select'))).toBe(true);
    expect(istEingabeFeld(document.createElement('button'))).toBe(false);
    expect(istEingabeFeld(document.body)).toBe(false);
    expect(istEingabeFeld(null)).toBe(false);
    expect(istEingabeFeld(window)).toBe(false);
  });

  it('erkennt auch Eingabefelder aus einem anderen Fenster (z. B. ausgelagertes Fenster)', () => {
    // Ein iframe hat wie ein Popup eigene Klassen: `instanceof HTMLElement` wäre dort falsch
    const rahmen = document.createElement('iframe');
    document.body.appendChild(rahmen);
    const fremd = rahmen.contentDocument!.createElement('input');
    expect(fremd instanceof HTMLElement).toBe(false);
    expect(istEingabeFeld(fremd)).toBe(true);
    expect(istEingabeFeld(rahmen.contentDocument!.createElement('div'))).toBe(false);
    rahmen.remove();
  });

  it('erkennt bearbeitbare Elemente (contenteditable)', () => {
    const d = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget;
    expect(istEingabeFeld(d)).toBe(true);
  });
});
