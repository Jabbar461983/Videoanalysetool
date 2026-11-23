import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

async function playlistVorbereiten(page: Page) {
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
  for (const [z, k] of [
    [1, 'i'],
    [4, 'o'],
  ] as const) {
    await video.evaluate((v: HTMLVideoElement, zz: number) => {
      v.currentTime = zz;
    }, z);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    await page.keyboard.press(k);
  }
  await page.keyboard.press('Enter');
  // Playlist: Titelfolie, Clip, Clip
  await page.getByRole('button', { name: 'In Playlist' }).click();
  await page.getByRole('tab', { name: 'Clips' }).click();
  await page.getByRole('button', { name: 'In Playlist' }).click();
  await page.getByTestId('titelfolie-neu').click();
  await page.getByLabel('Nach oben').nth(2).click();
  await page.getByLabel('Nach oben').nth(1).click();
  await expect(page.getByTestId('playlist-eintrag')).toHaveCount(3);
}

test('Präsentation: Vollbild-Bühne, Navigation per Tasten, Pause, Live-Stift, Steuerleiste blendet aus, Esc beendet', async ({
  page,
}) => {
  await playlistVorbereiten(page);
  await page.getByTestId('praesentation-start').click();

  // Nur die Bühne ist sichtbar
  await expect(page.locator('[data-praesentation="true"]')).toBeVisible();
  await expect(page.getByLabel('Projektname')).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Clips' })).toBeHidden();
  await expect(page.getByTestId('tagleiste')).toBeHidden();
  await expect(page.getByTestId('play')).toBeHidden(); // normale Player-Leiste ist weg
  const eintrag = page.getByTestId('praesentation-eintrag');
  await expect(eintrag).toContainText('1 / 3');

  // Navigation: Pfeile und Bild auf/ab (Presenter-Fernbedienung)
  await page.keyboard.press('ArrowRight');
  await expect(eintrag).toContainText('2 / 3');
  await page.keyboard.press('PageDown');
  await expect(eintrag).toContainText('3 / 3');
  await page.keyboard.press('PageUp');
  await expect(eintrag).toContainText('2 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(eintrag).toContainText('1 / 3');

  // Pause mit Leertaste
  const spielt = () =>
    page
      .getByRole('button', { name: /^(Pause|Abspielen)$/ })
      .first()
      .getAttribute('aria-label');
  expect(await spielt()).toBe('Pause'); // läuft
  await page.keyboard.press(' ');
  await expect.poll(spielt).toBe('Abspielen');

  // Live-Stift: Stift zeichnet immer; wird nicht gespeichert; C löscht
  const live = page.getByTestId('live-stift');
  const pixel = () =>
    live.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 20) n++;
      return n;
    });
  expect(await pixel()).toBe(0);
  const stift = async (typ: string, x: number, y: number) =>
    live.evaluate(
      (el, a) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent(a.typ, {
            bubbles: true,
            pointerId: 3,
            pointerType: 'pen',
            clientX: r.left + r.width * a.x,
            clientY: r.top + r.height * a.y,
            pressure: 0.5,
            isPrimary: true,
            buttons: a.typ === 'pointerup' ? 0 : 1,
            button: 0,
          }),
        );
      },
      { typ, x, y },
    );
  await stift('pointerdown', 0.2, 0.3);
  await stift('pointermove', 0.5, 0.5);
  await stift('pointermove', 0.7, 0.4);
  await stift('pointerup', 0.7, 0.4);
  expect(await pixel()).toBeGreaterThan(100);
  await page.keyboard.press('c');
  await expect.poll(pixel).toBe(0);
  // Maus zeichnet nur mit eingeschaltetem Schalter
  const mausZeichnen = async () => {
    const b = (await live.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.6, { steps: 4 });
    await page.mouse.up();
  };
  await mausZeichnen();
  expect(await pixel()).toBe(0);
  await page.getByTestId('live-stift-schalter').click();
  await mausZeichnen();
  expect(await pixel()).toBeGreaterThan(100);
  await page.getByTestId('live-loeschen').click();
  await expect.poll(pixel).toBe(0);

  // Steuerleiste blendet sich nach einigen Sekunden aus und kommt bei Bewegung wieder
  const leiste = page.getByTestId('praesentationsleiste');
  await expect(leiste).toHaveAttribute('data-sichtbar', 'false', { timeout: 6000 });
  await page.mouse.move(300, 300);
  await page.mouse.move(320, 320);
  await expect(leiste).toHaveAttribute('data-sichtbar', 'true');

  // Esc beendet: normale Oberfläche ist zurück
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await expect(page.locator('[data-praesentation="true"]')).toHaveCount(0);
});
