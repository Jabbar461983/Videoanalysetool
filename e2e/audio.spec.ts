import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const VIDEO = path.resolve('tests/fixtures/test-vp9.webm');

interface Plan {
  ereignisse: { start: number; dauer: number; blobId: string }[];
  original: { t: number; gain: number }[];
}

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
    [8, 'o'],
  ] as const) {
    await video.evaluate((v: HTMLVideoElement, z: number) => {
      v.currentTime = z;
    }, zeit);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    await page.keyboard.press(taste);
  }
  await page.keyboard.press('Enter');
  await page.getByTestId('clip-zeichnen').last().click();
  await expect(page.getByTestId('clip-editor')).toBeVisible();
}

const plan = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __bdvaTest: { audioPlan(): Plan } }).__bdvaTest.audioPlan(),
  );

test('Kommentar aufnehmen: Mikrofon, Pegel, Countdown, Standbild, Ducking, Spuren, Mixdown, Neuladen', async ({
  page,
}) => {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await clipOeffnen(page);

  // Standbild bei ca. 2 s Clipzeit (3 s lang) → Clip 9 s
  const b = (await page.getByTestId('programm-timeline').boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.33, b.y + 30);
  await page.getByTestId('standbild-einfuegen').click();
  await expect(page.getByTestId('seg-freeze')).toHaveCount(1);

  // Mikrofon aktivieren: Geräteliste und Pegelanzeige
  await page.getByTestId('mikro-an').click();
  await expect(page.getByTestId('pegel')).toBeVisible();
  await expect(page.getByLabel('Mikrofon', { exact: true }).locator('option')).not.toHaveCount(0);

  // Aufnahme ab Anfang: Countdown 3-2-1, REC, dann Stopp
  await page.mouse.click(b.x + 2, b.y + 30);
  await page.getByTestId('aufnahme-start').click();
  await expect(page.getByTestId('countdown')).toContainText('3');
  await expect(page.getByTestId('countdown-overlay')).toBeVisible();
  await expect(page.getByTestId('rec-anzeige')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(4500); // läuft über das Standbild hinweg
  await page.getByTestId('aufnahme-stopp').click();
  await expect(page.getByTestId('segment')).toHaveCount(1, { timeout: 10000 });
  await expect(page.getByTestId('tonspur')).toHaveCount(1);
  await expect(page.getByTestId('kommentar-balken')).toHaveCount(1);
  await expect(page.getByTestId('kommentar-balken').getByTestId('wellenform')).toBeVisible();
  await expect(page.getByTestId('rec-anzeige')).toBeHidden();

  // Plan: ein Kommentar ab 0, länger als das Videoende vor dem Standbild (Kommentar läuft im Standbild weiter)
  let p = await plan(page);
  expect(p.ereignisse).toHaveLength(1);
  expect(p.ereignisse[0]!.start).toBeLessThan(0.2);
  expect(p.ereignisse[0]!.dauer).toBeGreaterThan(3.5);
  // Ducking: Original sinkt während des Kommentars
  expect(Math.min(...p.original.map((x) => x.gain))).toBeLessThan(0.3);

  // Mixdown mit OfflineAudioContext: Kommentar ist hörbar (RMS > 0), Länge = Clipdauer
  const mix = await page.evaluate(() =>
    (
      window as unknown as {
        __bdvaTest: {
          mixdownKommentare(): Promise<{ dauer: number; rmsProSekunde: number[]; kanaele: number }>;
        };
      }
    ).__bdvaTest.mixdownKommentare(),
  );
  expect(mix.kanaele).toBe(2);
  expect(mix.dauer).toBeGreaterThan(8.5);
  expect(Math.max(...mix.rmsProSekunde)).toBeGreaterThan(0.001);

  // Stumm / Solo
  await page.getByTestId('spur-stumm').check();
  p = await plan(page);
  expect(p.ereignisse).toHaveLength(0);
  expect(Math.min(...p.original.map((x) => x.gain))).toBeGreaterThan(0.99); // kein Ducking ohne hörbaren Kommentar
  await page.getByTestId('spur-stumm').uncheck();
  await page.getByTestId('original-solo').check();
  p = await plan(page);
  expect(p.ereignisse).toHaveLength(0); // nur Original solo
  await page.getByTestId('original-solo').uncheck();
  await page.getByTestId('ducking').uncheck();
  p = await plan(page);
  expect(Math.min(...p.original.map((x) => x.gain))).toBeGreaterThan(0.99);
  await page.getByTestId('ducking').check();
  await page.getByTestId('original-stumm').check();
  p = await plan(page);
  expect(Math.max(...p.original.map((x) => x.gain))).toBe(0);
  await page.getByTestId('original-stumm').uncheck();

  // Kürzen per Zahlenfeld, Verschieben per Zahlenfeld
  const laenge = page.getByLabel(/^Länge \(s\) /);
  await laenge.fill('2');
  await laenge.blur();
  await expect.poll(async () => (await plan(page)).ereignisse[0]?.dauer).toBeCloseTo(2, 1);
  const start = page.getByLabel(/^Start \(s\) /);
  await start.fill('3');
  await start.blur();
  await expect.poll(async () => (await plan(page)).ereignisse[0]?.start).toBeCloseTo(3, 1);

  // Verschieben per Ziehen in der Zeitleiste
  const bal = (await page.getByTestId('kommentar-balken').boundingBox())!;
  await page.mouse.move(bal.x + bal.width / 2, bal.y + bal.height / 2);
  await page.mouse.down();
  await page.mouse.move(bal.x + bal.width / 2 + 80, bal.y + bal.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await plan(page)).ereignisse[0]?.start).toBeGreaterThan(3.2);

  // Löschen und Rückgängig
  await page.getByTestId('segment-loeschen').click();
  await expect(page.getByTestId('segment')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('segment')).toHaveCount(1);

  // Neu aufnehmen ersetzt das Segment (gleiche Spur)
  const alteId = (await plan(page)).ereignisse[0]!.blobId;
  await page.getByTestId('neu-aufnehmen').click();
  await expect(page.getByTestId('rec-anzeige')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1800);
  await page.getByTestId('aufnahme-stopp').click();
  await expect
    .poll(async () => (await plan(page)).ereignisse[0]?.blobId, { timeout: 10000 })
    .not.toBe(alteId);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect(page.getByTestId('tonspur')).toHaveCount(1);

  // Neuladen: Aufnahme ist in IndexedDB gesichert und wieder da
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible({
    timeout: 5000,
  });
  await page.reload();
  // Video erneut verknüpfen (nach dem Neuladen gibt es keine Dateizugriffe mehr)
  await page.getByTestId('datei-input').setInputFiles(VIDEO);
  await page.getByRole('tab', { name: 'Clips' }).click();
  await page.getByTestId('clip-zeichnen').last().click();
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect(page.getByTestId('kommentar-balken').getByTestId('wellenform')).toBeVisible({
    timeout: 5000,
  });
  const mix2 = await page.evaluate(() =>
    (
      window as unknown as {
        __bdvaTest: { mixdownKommentare(): Promise<{ rmsProSekunde: number[] }> };
      }
    ).__bdvaTest.mixdownKommentare(),
  );
  expect(Math.max(...mix2.rmsProSekunde)).toBeGreaterThan(0.001);

  // Abspielen mit Kommentar (Web-Audio-Mixer) läuft ohne Fehler bis zum Ende
  await page.getByTestId('play').click();
  await expect
    .poll(async () => (await page.getByTestId('play').getAttribute('aria-label')) ?? '', {
      timeout: 30000,
    })
    .toBe('Abspielen');
  expect(fehler).toEqual([]);
});
