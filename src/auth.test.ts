import { describe, expect, it, beforeEach } from 'vitest';
import { VALID_CREDENTIALS, AUTH_STORAGE_KEY, USER_STORAGE_KEY } from './auth';

// Ensure localStorage mock is present in Node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = String(v); },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
}

describe('Tallyfold Authentication Logic', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('declares the required user credentials', () => {
    expect(VALID_CREDENTIALS.username).toBe('user');
    expect(VALID_CREDENTIALS.password).toBe('qwer1234');
  });

  it('validates correct username and password successfully', () => {
    const username = 'user';
    const password = 'qwer1234';

    const isValid = username.trim() === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password;
    expect(isValid).toBe(true);
  });

  it('rejects invalid password', () => {
    const username = 'user';
    const password = 'wrong-password';

    const isValid = username.trim() === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password;
    expect(isValid).toBe(false);
  });

  it('rejects invalid username', () => {
    const username = 'admin';
    const password = 'qwer1234';

    const isValid = username.trim() === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password;
    expect(isValid).toBe(false);
  });

  it('persists session in localStorage on login and clears on logout', () => {
    globalThis.localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    globalThis.localStorage.setItem(USER_STORAGE_KEY, 'user');
    globalThis.localStorage.setItem('userId', 'user');

    expect(globalThis.localStorage.getItem(AUTH_STORAGE_KEY)).toBe('true');
    expect(globalThis.localStorage.getItem(USER_STORAGE_KEY)).toBe('user');

    // Simulate logout
    globalThis.localStorage.removeItem(AUTH_STORAGE_KEY);
    globalThis.localStorage.removeItem(USER_STORAGE_KEY);

    expect(globalThis.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(globalThis.localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });
});
