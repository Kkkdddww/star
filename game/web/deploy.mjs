// 빌드 결과를 저장소 맨 위 폴더(GitHub Pages가 서비스하는 곳)로 복사한다. 실행: npm run deploy (game 폴더에서)
import { cpSync, readdirSync } from 'node:fs';
const root = '..';
cpSync('dist/index.html', `${root}/index.html`);
for (const f of readdirSync('dist/site')) cpSync(`dist/site/${f}`, `${root}/${f}`);
console.log('복사 완료: index.html +', readdirSync('dist/site').length, '개 정적 페이지 → 저장소 맨 위');
