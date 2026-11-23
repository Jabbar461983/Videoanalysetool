import { expect, test } from '@playwright/test';
import fs from 'node:fs';

// Optionaler Leistungstest: nur wenn BDVA_GROSS auf eine grosse Videodatei zeigt.
const GROSS = process.env.BDVA_GROSS;
test.skip(!GROSS || !fs.existsSync(GROSS), 'BDVA_GROSS nicht gesetzt');

test('Grosse Datei: Import und Wiedergabe in < 5 s', async ({ page }) => {
  await page.goto('./');
  const ok = page.getByRole('button', { name: 'Verstanden' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  const t0 = Date.now();
  await page.getByTestId('datei-input').setInputFiles(GROSS!);
  await expect(page.getByText(/1920×1080/)).toBeVisible({ timeout: 30000 });
  const dauerMeta = Date.now() - t0;
  console.log(`Metadaten sichtbar nach ${dauerMeta} ms`);
  expect(dauerMeta).toBeLessThan(5000);
  const heap0 = await page.evaluate(
    () =>
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
      0,
  );
  // Scrubbing: mehrfach springen
  for (const x of [0.1, 0.5, 0.9, 0.3, 0.7]) {
    const box = (await page.getByTestId('timeline').boundingBox())!;
    await page.mouse.click(box.x + box.width * x, box.y + 40);
  }
  const heap1 = await page.evaluate(
    () =>
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
      0,
  );
  console.log(
    `JS-Heap vorher ${(heap0 / 1e6).toFixed(0)} MB, nachher ${(heap1 / 1e6).toFixed(0)} MB`,
  );
  expect(heap1 - heap0).toBeLessThan(150e6);
});
