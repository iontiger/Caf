import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로로 빌드해 어느 경로에 올려도 열리게 한다
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
