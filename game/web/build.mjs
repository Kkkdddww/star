// 엔진 + UI를 한 파일(dist/index.html)로 묶는다. 실행: node web/build.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const esbuild = process.env.ESBUILD ?? 'node_modules/.bin/esbuild';
const js = execFileSync(esbuild, ['src/ui/main.ts', '--bundle', '--format=iife', '--minify', '--target=es2019'], { encoding: 'utf8' });
const html = readFileSync('web/template.html', 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} KB`);
