import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { loadModalBody } from '../features/modals/loadModalBody';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

await loadModalBody();
