import { chromium } from '@playwright/test';

const baseUrl = process.env.PERFORMANCE_BASE_URL?.trim() || 'http://127.0.0.1:3201';
const sampleCount = Math.min(Math.max(Number.parseInt(process.env.PERFORMANCE_SAMPLES || '3', 10) || 3, 1), 10);
const routes = ['/', '/features', '/how-it-works', '/security', '/docs', '/pricing', '/faq', '/contact', '/status'] as const;

interface NavigationSample {
  domContentLoadedMs: number;
  loadMs: number;
  responseMs: number;
  transferBytes: number;
  encodedBytes: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function medianSample(samples: NavigationSample[]): NavigationSample;
function medianSample(samples: NavigationSample | NavigationSample[]): NavigationSample {
  const values = Array.isArray(samples) ? samples : [samples];
  return {
    domContentLoadedMs: median(values.map((sample) => sample.domContentLoadedMs)),
    loadMs: median(values.map((sample) => sample.loadMs)),
    responseMs: median(values.map((sample) => sample.responseMs)),
    transferBytes: median(values.map((sample) => sample.transferBytes)),
    encodedBytes: median(values.map((sample) => sample.encodedBytes)),
  };
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'load' });
    const results = [];
    for (const route of routes) {
      const samples: NavigationSample[] = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'load' });
        if (response?.status() !== 200) throw new Error(`PUBLIC_PERFORMANCE_ROUTE_FAILED:${route}:${response?.status() ?? 'unavailable'}`);
        const sample = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          if (!navigation) throw new Error('PUBLIC_PERFORMANCE_NAVIGATION_TIMING_MISSING');
          return {
            domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd - navigation.startTime),
            loadMs: Math.round(navigation.loadEventEnd - navigation.startTime),
            responseMs: Math.round(navigation.responseEnd - navigation.startTime),
            transferBytes: navigation.transferSize,
            encodedBytes: navigation.encodedBodySize,
          } satisfies NavigationSample;
        });
        samples.push(sample);
      }
      results.push({ route, samples: sampleCount, median: medianSample(samples) });
    }
    console.log(JSON.stringify({ baseUrl, samples: sampleCount, routes: results }, null, 2));
  } finally {
    await browser.close();
  }
}

await main();
