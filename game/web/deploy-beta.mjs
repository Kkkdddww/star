// 베타: 빌드 결과를 저장소 맨 위 beta/ 폴더로 복사한다 (malttuk.com/beta). 실행: npm run deploy:beta (game 폴더에서)
// 지금 사이트(맨 위 index.html)는 건드리지 않는다. 검색 노출 · 방문 통계 · 광고는 끈다. 서버(Supabase)는 실제 서버를 같이 쓴다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync('dist/index.html', 'utf8');
html = html
  .replace('<meta name="ga-id" content="G-ZNK1Y11H3B">', '<meta name="ga-id" content="">')
  .replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^>]*><\/script>/, '')
  .replace('<meta name="adsense-client" content="ca-pub-5510087854953837">', '<meta name="adsense-client" content="">')
  .replace('<title>말뚝 - 장교 커리어 시뮬레이션</title>', '<title>말뚝 베타</title>\n<meta name="robots" content="noindex,nofollow">')
  .replace('</style>', '.lobbyhd .t::after{content:" 베타";font-size:13px;color:var(--red);font-weight:700;margin-left:4px}</style>');
if (!html.includes('noindex')) throw new Error('베타 표시를 넣지 못했어요 (template 확인)');
mkdirSync('../beta', { recursive: true });
writeFileSync('../beta/index.html', html);
console.log('베타 복사 완료 → beta/index.html (malttuk.com/beta)');
