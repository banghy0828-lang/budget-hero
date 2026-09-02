/**
 * 금융감독원 "금융상품 한눈에" API에서 은행·저축은행의 정기예금·적금 상품을 전부 받아와서
 * data/deposit.json, data/saving.json 으로 저장한다.
 *
 * 브라우저(index.html)는 CORS 때문에 이 API를 직접 호출할 수 없어서, 대신 GitHub Actions가
 * 매일 한 번 이 스크립트를 서버에서 돌려 결과를 저장소에 정적 파일로 커밋해두면,
 * 앱은 그 파일을 index.html과 같은 출처(GitHub Pages)에서 읽기만 하면 되므로 CORS 문제가 없다.
 * 금리 공시 자체가 월 단위(dcls_month)로 갱신되는 정보라, 하루 한 번 갱신이면 충분하다.
 */
const https = require('https');
const fs = require('fs');

const AUTH = process.env.FINLIFE_AUTH_KEY;
if (!AUTH) {
  console.error('FINLIFE_AUTH_KEY 환경변수가 없습니다.');
  process.exit(1);
}

const SECTORS = [
  { code: '020000', name: '은행' },
  { code: '030300', name: '저축은행' },
];
const TYPES = [
  { key: 'deposit', svc: 'depositProductsSearch' },
  { key: 'saving', svc: 'savingProductsSearch' },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fetchAllPages(svc, topFinGrpNo) {
  let page = 1;
  let maxPage = 1;
  const items = [];
  do {
    const url = `https://finlife.fss.or.kr/finlifeapi/${svc}.json?auth=${AUTH}&topFinGrpNo=${topFinGrpNo}&pageNo=${page}`;
    const r = await fetchJson(url);
    if (!r.result || r.result.err_cd !== '000') {
      throw new Error(`API 오류 (${svc}, ${topFinGrpNo}): ${r.result ? r.result.err_msg : '알 수 없는 응답'}`);
    }
    maxPage = r.result.max_page_no || 1;
    const base = r.result.baseList || [];
    const opts = r.result.optionList || [];
    base.forEach((b) => {
      const key = b.fin_co_no + b.fin_prdt_cd;
      const myOpts = opts
        .filter((o) => o.fin_co_no + o.fin_prdt_cd === key)
        .map((o) => ({
          term: o.save_trm, // 가입기간(개월)
          rateType: o.intr_rate_type_nm, // 단리/복리
          rate: o.intr_rate, // 기본금리
          rateMax: o.intr_rate2, // 최고우대금리
          rsrvType: o.rsrv_type_nm || null, // 정액적립식/자유적립식 (적금만 존재)
        }));
      items.push({
        bank: b.kor_co_nm,
        name: b.fin_prdt_nm,
        joinWay: b.join_way,
        spclCnd: b.spcl_cnd, // 우대조건
        joinMember: b.join_member, // 가입대상
        etcNote: b.etc_note,
        maxLimit: b.max_limit,
        dclsMonth: b.dcls_month,
        options: myOpts,
      });
    });
    page += 1;
  } while (page <= maxPage);
  return items;
}

(async () => {
  fs.mkdirSync('data', { recursive: true });
  for (const type of TYPES) {
    let all = [];
    for (const sector of SECTORS) {
      // eslint-disable-next-line no-await-in-loop
      const items = await fetchAllPages(type.svc, sector.code);
      items.forEach((i) => {
        i.sector = sector.name;
      });
      all = all.concat(items);
      console.log(`${type.key} / ${sector.name}: ${items.length}개`);
    }
    const out = { updatedAt: new Date().toISOString(), count: all.length, products: all };
    fs.writeFileSync(`data/${type.key}.json`, JSON.stringify(out));
    console.log(`→ data/${type.key}.json 저장 완료 (총 ${all.length}개)`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
