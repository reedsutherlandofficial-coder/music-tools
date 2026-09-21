// Shared setup for the browser tests: where the page is, which Chrome to drive,
// and a scratch folder for downloads. Nothing here is specific to one machine.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// the page under test, as a file: URL (the tests add their own #hash)
export const INDEX = pathToFileURL(path.resolve(here, '..', 'index.html')).href;

const CANDIDATES = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  linux: ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
};
export function chromePath(){
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = (CANDIDATES[process.platform] || []).find(p => fs.existsSync(p));
  if (!found) throw new Error('Could not find Chrome. Install it, or set CHROME_PATH to its executable.');
  return found;
}
export const launch = () => puppeteer.launch({ executablePath: chromePath(), headless: true });

// an empty temp folder for one suite's downloads, returned with a trailing separator
export function scratch(name){
  const dir = path.join(os.tmpdir(), 'music-tools-tests', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir + path.sep;
}
