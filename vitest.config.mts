import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // 기본 테스트는 내장 샘플 구단(arsenal · ulsan …)으로 고정. 전체 외부 DB는 tests/full-db.test.ts가 따로 검사한다.
    env: { FO_CAR_DB: 'sample' },
  },
});
