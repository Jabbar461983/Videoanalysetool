import { expect, test, type Page } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

async function clipOeffnen(page: Page) {
  await page.addInitScript(() => localStorage.setItem('bdva-test', '1'));
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
    [6, 'o'],
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
}

const springe = (page: Page, t: number) =>
  page.evaluate(
    (z) =>
      (
        window as unknown as { __bdvaTest: { springe(t: number): Promise<void> } }
      ).__bdvaTest.springe(z),
    t,
  );

/** Klick auf die Tafel (normiert 0–1 des Canvas) als Zeigerereignisse. */
async function tafelZeiger(
  page: Page,
  typ: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
) {
  await page.getByTestId('tafel-canvas').evaluate(
    (el, a) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent(a.typ, {
          bubbles: true,
          cancelable: true,
          pointerId: 5,
          pointerType: 'mouse',
          clientX: r.left + r.width * a.x,
          clientY: r.top + r.height * a.y,
          isPrimary: true,
          buttons: a.typ === 'pointerup' ? 0 : 1,
          button: 0,
        }),
      );
    },
    { typ, x, y },
  );
}

const alphaBei = (page: Page, x: number, y: number) =>
  page
    .getByTestId('overlay')
    .evaluate(
      (c: HTMLCanvasElement, p) =>
        c
          .getContext('2d')!
          .getImageData(Math.round(p.x * c.width), Math.round(p.y * c.height), 1, 1).data[3]!,
      { x, y },
    );

function psnrDb(a: string, b: string): number {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'],
    {
      encoding: 'utf8',
    },
  );
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : NaN;
}

test('Taktiktafel: Situation zeichnen, per T einblenden, im Export enthalten', async ({ page }) => {
  test.setTimeout(120_000);
  await clipOeffnen(page);
  await page.getByRole('tab', { name: 'Taktik' }).click();
  await expect(page.getByTestId('feld-platzhalter')).toBeVisible();

  // Neue Situation: zwei Spieler und ein Pass
  await page.getByTestId('neue-situation').click();
  await expect(page.getByTestId('tafel-editor')).toBeVisible();
  await page.getByTestId('tafel-w-team1').click();
  await tafelZeiger(page, 'pointerdown', 0.4, 0.45);
  await tafelZeiger(page, 'pointerup', 0.4, 0.45);
  await page.getByTestId('tafel-nummer').fill('7');
  await page.getByTestId('tafel-w-team2').click();
  await tafelZeiger(page, 'pointerdown', 0.65, 0.6);
  await tafelZeiger(page, 'pointerup', 0.65, 0.6);
  await page.getByTestId('tafel-w-pass').click();
  await tafelZeiger(page, 'pointerdown', 0.4, 0.45);
  await tafelZeiger(page, 'pointermove', 0.55, 0.5);
  await tafelZeiger(page, 'pointermove', 0.65, 0.6);
  await tafelZeiger(page, 'pointerup', 0.65, 0.6);
  await expect(page.getByTestId('situationsliste')).toContainText('2 Marker, 1 Pfeile');
  await page.getByTestId('tafel-schliessen').click();
  await expect(page.getByTestId('tafel-editor')).toBeHidden();

  // Ohne Einblenden ist unten rechts nichts gezeichnet; mit T erscheint die Tafel
  await springe(page, 1.0);
  expect(await alphaBei(page, 0.9, 0.9)).toBe(0);
  await page
    .getByTestId('video')
    .click({ position: { x: 5, y: 5 }, force: true })
    .catch(() => undefined);
  await page.keyboard.press('t');
  await expect.poll(() => alphaBei(page, 0.9, 0.9)).toBeGreaterThan(200);
  await expect(page.getByTestId('taktik-balken')).toHaveCount(1);

  // Export und Vorschau stimmen überein (Tafel im Bild)
  await springe(page, 1.5);
  const url = await page.evaluate(() =>
    (
      window as unknown as { __bdvaTest: { vorschauBild(b: number, h: number): string } }
    ).__bdvaTest.vorschauBild(640, 360),
  );
  await page.getByRole('tab', { name: 'Export' }).click();
  await page.getByTestId('export-clip').check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-start').click(),
  ]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdva-tk-'));
  const mp4 = path.join(dir, 'export.mp4');
  await download.saveAs(mp4);
  const erwartet = path.join(dir, 'vorschau.png');
  fs.writeFileSync(erwartet, Buffer.from(url.split(',')[1]!, 'base64'));
  const exportiert = path.join(dir, 'export.png');
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    mp4,
    '-vf',
    'select=eq(n\\,37)',
    '-vsync',
    '0',
    '-frames:v',
    '1',
    exportiert,
  ]);
  expect(psnrDb(exportiert, erwartet)).toBeGreaterThan(24);
  // Tafelbereich unten rechts (192×96 bei 640×360) stimmt besonders genau
  const crop = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      exportiert,
      '-i',
      erwartet,
      '-lavfi',
      '[0:v]crop=200:110:428:238[a];[1:v]crop=200:110:428:238[b];[a][b]psnr',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  const m = /average:(inf|[\d.]+)/.exec(crop.stderr);
  expect(m && (m[1] === 'inf' ? 99 : Number(m[1]))).toBeGreaterThan(24);

  // T entfernt die Tafel wieder
  await page.getByRole('tab', { name: 'Clips' }).click();
  await springe(page, 1.0);
  await page.keyboard.press('t');
  await expect.poll(() => alphaBei(page, 0.9, 0.9)).toBe(0);
});

test('Kalibrierung und «Per Klick übernehmen»: Klick im Video landet am richtigen Feldpunkt', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await clipOeffnen(page);
  await springe(page, 1.0);
  await page.getByRole('tab', { name: 'Taktik' }).click();
  await page.getByTestId('neu-kalibrieren').click();
  await expect(page.getByTestId('kalibrier-dialog')).toBeVisible();

  // Die ersten vier Referenzpunkte (Bullypunkte, Rechteck) im Bild anklicken
  const klickBild = async (x: number, y: number) =>
    page.getByTestId('kalibrier-bild').evaluate(
      (el, a) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: r.left + r.width * a.x,
            clientY: r.top + r.height * a.y,
            pointerId: 6,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            isPrimary: true,
          }),
        );
      },
      { x, y },
    );
  await expect(page.getByTestId('kalibrierung-speichern')).toBeDisabled();
  await klickBild(0.3, 0.4); // links oben
  await klickBild(0.7, 0.4); // rechts oben
  await klickBild(0.25, 0.8); // links unten
  await expect(page.getByTestId('kalibrier-guete')).toContainText('Noch 1 Punkt nötig');
  await klickBild(0.75, 0.8); // rechts unten
  await expect(page.getByTestId('kalibrier-guete')).toContainText('4 Punkten');
  await page.getByTestId('kalibrierung-speichern').click();
  await expect(page.getByTestId('kalibrier-dialog')).toBeHidden();
  await expect(page.getByTestId('kalibrierungen')).toContainText('4 Punkte');

  // Klick-Modus: ein Klick genau auf den Punkt «links oben» → Marker bei (10 m, 5 m)
  await page.getByTestId('uebernehmen-klick').click();
  await expect(page.getByTestId('taktik-klickebene')).toBeVisible();
  const klickVideo = (x: number, y: number) =>
    page.getByTestId('taktik-klickebene').evaluate(
      (el, a) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: r.left + r.width * a.x,
            clientY: r.top + r.height * a.y,
            pointerId: 7,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            isPrimary: true,
          }),
        );
      },
      { x, y },
    );
  await klickVideo(0.3, 0.4);
  await page.getByTestId('klick-team2').click();
  await klickVideo(0.75, 0.8); // rechts unten → (30 m, 15 m)
  await page.getByTestId('klick-fertig').click();
  await expect(page.getByTestId('tafel-editor')).toBeVisible();
  const projekt = await page.evaluate(() =>
    (
      window as unknown as {
        __bdvaTest: {
          projekt(): {
            taktik: {
              situationen: { name: string; marker: { art: string; x: number; y: number }[] }[];
            };
          };
        };
      }
    ).__bdvaTest.projekt(),
  );
  const szene = projekt.taktik.situationen.at(-1)!;
  expect(szene.marker).toHaveLength(2);
  expect(szene.marker[0]).toMatchObject({ art: 'team1' });
  expect(szene.marker[0]!.x).toBeCloseTo(10, 1);
  expect(szene.marker[0]!.y).toBeCloseTo(5, 1);
  expect(szene.marker[1]).toMatchObject({ art: 'team2' });
  expect(szene.marker[1]!.x).toBeCloseTo(30, 1);
  expect(szene.marker[1]!.y).toBeCloseTo(15, 1);

  // Teams tauschen
  await page.getByTestId('tafel-tauschen').click();
  const nachher = await page.evaluate(() =>
    (
      window as unknown as {
        __bdvaTest: { projekt(): { taktik: { situationen: { marker: { art: string }[] }[] } } };
      }
    ).__bdvaTest.projekt(),
  );
  expect(nachher.taktik.situationen.at(-1)!.marker.map((m) => m.art)).toEqual(['team2', 'team1']);
});

test('Kalibrierung: über Kreuz vertauschte Punkte ergeben keine Abbildung und lassen sich nicht speichern', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await clipOeffnen(page);
  await springe(page, 1.0);
  await page.getByRole('tab', { name: 'Taktik' }).click();
  await page.getByTestId('neu-kalibrieren').click();
  const klickBild = (x: number, y: number) =>
    page.getByTestId('kalibrier-bild').evaluate(
      (el, a) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: r.left + r.width * a.x,
            clientY: r.top + r.height * a.y,
            pointerId: 11,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            isPrimary: true,
          }),
        );
      },
      { x, y },
    );
  // Reihenfolge der Referenzpunkte: links oben, rechts oben, links unten, rechts unten.
  // Hier werden «rechts oben» und «links unten» über Kreuz im Bild gesetzt: Das Feld erscheint verdreht (Schleife).
  await klickBild(0.3, 0.4);
  await klickBild(0.75, 0.8);
  await klickBild(0.25, 0.8);
  await klickBild(0.7, 0.4);
  // Über Kreuz vertauschte Eckpunkte ergeben keine Abbildung: Meldung, Speichern bleibt gesperrt
  await expect(page.getByTestId('kalibrier-guete')).toContainText('keine eindeutige Abbildung');
  await expect(page.getByTestId('kalibrierung-speichern')).toBeDisabled();
});
