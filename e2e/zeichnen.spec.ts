import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

async function clipOeffnen(page: Page) {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await page.getByRole('tab', { name: 'Clips' }).click();
  for (const [zeit, taste] of [
    [2, 'i'],
    [8, 'o'],
  ] as const) {
    await video.evaluate((v: HTMLVideoElement, z: number) => {
      v.currentTime = z;
    }, zeit);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    await page.keyboard.press(taste);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('clipliste').locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
  await expect(page.getByTestId('zeichenebene')).toBeVisible();
}

/** Zeigerereignis auf der Zeichenebene (normierte Position 0–1), auch als Stift oder Touch. */
async function zeiger(
  page: Page,
  typ: 'pointerdown' | 'pointermove' | 'pointerup',
  art: 'pen' | 'touch' | 'mouse',
  x: number,
  y: number,
  id = 7,
) {
  await page.getByTestId('zeichenebene').evaluate(
    (el, a) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent(a.typ, {
          bubbles: true,
          cancelable: true,
          pointerId: a.id,
          pointerType: a.art,
          clientX: r.left + r.width * a.x,
          clientY: r.top + r.height * a.y,
          pressure: a.art === 'pen' ? 0.6 : 0.5,
          isPrimary: true,
          buttons: a.typ === 'pointerup' ? 0 : 1,
          button: 0,
        }),
      );
    },
    { typ, art, x, y, id },
  );
}

/** Anzahl nicht transparenter Pixel im Rechteck (normiert) des Overlay-Canvas. */
const pixel = (page: Page, x0: number, y0: number, x1: number, y1: number) =>
  page.getByTestId('overlay').evaluate(
    (c: HTMLCanvasElement, r) => {
      const ctx = c.getContext('2d')!;
      const x = Math.floor(r.x0 * c.width);
      const y = Math.floor(r.y0 * c.height);
      const w = Math.max(1, Math.floor((r.x1 - r.x0) * c.width));
      const h = Math.max(1, Math.floor((r.y1 - r.y0) * c.height));
      const d = ctx.getImageData(x, y, w, h).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 20) n++;
      return n;
    },
    { x0, y0, x1, y1 },
  );

const springeClipZeit = async (page: Page, anteil: number) => {
  const b = (await page.getByTestId('programm-timeline').boundingBox())!;
  await page.mouse.click(b.x + b.width * anteil, b.y + 60);
};

test('Stift: gestrichelter, animierter Pfeil erscheint und verschwindet zur richtigen Zeit', async ({
  page,
}) => {
  await clipOeffnen(page);
  await page.getByTestId('werkzeug-pfeil').click();
  await page.getByTestId('gestrichelt').check();
  await page.getByTestId('animation').selectOption('zeichnen');

  // Handballen: Stift schwebt, danach kommt eine Berührung → wird ignoriert
  await zeiger(page, 'pointermove', 'pen', 0.1, 0.1, 1);
  await zeiger(page, 'pointerdown', 'touch', 0.3, 0.3, 5);
  await zeiger(page, 'pointermove', 'touch', 0.5, 0.5, 5);
  await zeiger(page, 'pointerup', 'touch', 0.5, 0.5, 5);
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(0);

  // Laufweg mit dem Stift: von links nach rechts in der Bildmitte
  await zeiger(page, 'pointerdown', 'pen', 0.2, 0.5, 1);
  await zeiger(page, 'pointermove', 'pen', 0.45, 0.5, 1);
  await zeiger(page, 'pointermove', 'pen', 0.7, 0.5, 1);
  await zeiger(page, 'pointerup', 'pen', 0.7, 0.5, 1);
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('zeichnungs-balken')).toHaveCount(1);

  const linie = [0.2, 0.46, 0.8, 0.54] as const;
  // am Anfang (zeichnet sich) noch wenig, mittendrin vollständig, nach dem Ende weg
  await springeClipZeit(page, 0.0);
  await expect.poll(() => pixel(page, ...linie)).toBe(0);
  await springeClipZeit(page, 0.05); // 0.3 s von 6 s → ca. 37 % aufgebaut
  const teil = await pixel(page, ...linie);
  await springeClipZeit(page, 0.3); // 1.8 s
  const voll = await pixel(page, ...linie);
  expect(teil).toBeGreaterThan(0);
  expect(voll).toBeGreaterThan(teil);
  await springeClipZeit(page, 0.7); // 4.2 s, nach Ende bei 3 s
  await expect.poll(() => pixel(page, ...linie)).toBe(0);

  // Gestrichelt: in der Mitte der vollen Linie gibt es Lücken (weniger Pixel als bei durchgezogen)
  await springeClipZeit(page, 0.3);
  const gestrichelt = await pixel(page, 0.3, 0.495, 0.65, 0.505);
  expect(gestrichelt).toBeGreaterThan(0);
  const volleFlaeche = 0.35 * 640 * (0.01 * 360);
  expect(gestrichelt).toBeLessThan(volleFlaeche * 0.8);

  // Zeitspanne per Ziehen am Rand der Zeichnungsspur verlängern
  const vorher = await page.getByTestId('zeichnungs-balken').getAttribute('aria-label');
  const kante = (await page.getByTestId('zeit-rechts').boundingBox())!;
  await page.mouse.move(kante.x + kante.width / 2, kante.y + kante.height / 2);
  await page.mouse.down();
  await page.mouse.move(kante.x + 120, kante.y + kante.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await page.getByTestId('zeichnungs-balken').getAttribute('aria-label')).not.toBe(vorher);
  await springeClipZeit(page, 0.55);
  expect(await pixel(page, ...linie)).toBeGreaterThan(0);

  // Auswahl, Löschen, Rückgängig
  await page.getByTestId('werkzeug-auswahl').click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(1);
});

test('Auto-Pause, Text, Marker, Zone, Verschieben, Kopieren, Favorit, Playlist', async ({
  page,
}) => {
  await clipOeffnen(page);
  // Wiedergabe läuft; Zeichnen hält sie an
  await page.keyboard.press('Space');
  await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Pause');
  await page.getByTestId('werkzeug-marker').click();
  await zeiger(page, 'pointerdown', 'mouse', 0.3, 0.3);
  await zeiger(page, 'pointerup', 'mouse', 0.3, 0.3);
  await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Abspielen');
  await expect(page.getByTestId('zeichnungsliste')).toContainText('Nummer');
  // Feste Zeit für die weiteren Zeichnungen (Wiedergabe-Start/-Pause laufen asynchron)
  await springeClipZeit(page, 0.2);
  await page.waitForTimeout(300);

  // Text
  await page.getByTestId('werkzeug-text').click();
  await zeiger(page, 'pointerdown', 'mouse', 0.5, 0.2);
  await zeiger(page, 'pointerup', 'mouse', 0.5, 0.2);
  await page.getByTestId('text-eingabe').fill('Pressing hoch');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zeichnungsliste')).toContainText('Pressing hoch');

  // Zone: drei Ecken, Enter
  await page.getByTestId('werkzeug-zone').click();
  for (const [x, y] of [
    [0.55, 0.55],
    [0.85, 0.55],
    [0.7, 0.85],
  ] as const) {
    await zeiger(page, 'pointerdown', 'mouse', x, y);
    await zeiger(page, 'pointerup', 'mouse', x, y);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(3);

  // Auswählen und Verschieben der Zone
  await page.getByTestId('werkzeug-auswahl').click();
  const vorher = await pixel(page, 0.55, 0.55, 0.9, 0.9);
  await zeiger(page, 'pointerdown', 'mouse', 0.7, 0.65);
  await zeiger(page, 'pointermove', 'mouse', 0.5, 0.45);
  await zeiger(page, 'pointerup', 'mouse', 0.5, 0.45);
  const nachher = await pixel(page, 0.55, 0.55, 0.9, 0.9);
  expect(nachher).toBeLessThan(vorher);
  await expect(page.getByTestId('zeichengriff')).toHaveCount(3);

  // Kopieren / Einfügen, Ebene, Favorit
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(4);
  await page.getByRole('button', { name: 'Nach hinten' }).click();
  page.once('dialog', (d) => void d.accept('Mein Raum'));
  await page.getByRole('button', { name: 'Als Favorit speichern' }).click();
  await expect(page.getByText('Favorit gespeichert.')).toBeVisible();
  await page.getByLabel('Favoriten').selectOption({ label: 'Mein Raum' });
  await expect(page.getByTestId('zeichnungsliste').locator('li')).toHaveCount(5);

  // Playlist zeigt die Zeichnungen des Clips
  await page.getByRole('button', { name: 'Editor schliessen' }).click();
  await page.getByRole('button', { name: 'In Playlist' }).click();
  await page.getByRole('button', { name: 'Ab hier abspielen' }).count();
  await page.getByTestId('playlist-eintrag').first().getByRole('button').first().click();
  await page.getByRole('button', { name: 'Ab hier abspielen' }).click();
  await expect(page.getByTestId('modus')).toContainText('Playlist');
  await expect.poll(() => pixel(page, 0.2, 0.2, 0.45, 0.4), { timeout: 8000 }).toBeGreaterThan(0); // Marker bei (0.3, 0.3)
});

test('Zeichnen-Knopf im Player öffnet die Werkzeuge, auch ohne vorhandenen Clip', async ({
  page,
}) => {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  const video = page.getByTestId('video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 6;
  });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
  await page.getByTestId('zeichnen-starten').click();
  await expect(page.getByTestId('werkzeugleiste')).toBeVisible();
  await expect(page.getByTestId('zeichenebene')).toBeVisible();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
});
