import { jest } from '@jest/globals';
import chrome from '../mocks/chrome.js';

global.jest = jest;
global.chrome = chrome;

beforeEach(() => {
  chrome.storage.local.__reset();
  chrome.storage.onChanged.__reset();
});
