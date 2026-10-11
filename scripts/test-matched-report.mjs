import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
const yaml = readFileSync(new URL('../.github/workflows/yandex-readonly-audit.yml',import.meta.url),'utf8');
const code = yaml.split("          cat > /tmp/matched-report.mjs <<'NODE'\n")[1].split('\n          NODE')[0].split('\n').map(l=>l.slice(10)).join('\n');
delete process.env.RUN_MATCHED_REPORT;
const m = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('seven completed Moscow days, not today or UTC midnight',()=>{
  assert.deepEqual(m.completedWindow(new Date('2026-10-11T06:00:00Z')),{date1:'2026-10-04',date2:'2026-10-10'});
  assert.deepEqual(m.completedWindow(new Date('2026-10-10T21:01:00Z')),{date1:'2026-10-04',date2:'2026-10-10'});
  assert.deepEqual(m.completedWindow(new Date('2026-10-10T20:59:00Z')),{date1:'2026-10-03',date2:'2026-10-09'});
  assert.deepEqual(m.completedWindow(new Date('2027-01-01T00:00:00Z')),{date1:'2026-12-25',date2:'2026-12-31'});
  assert.deepEqual(m.completedWindow(new Date('2028-03-01T00:00:00Z')),{date1:'2028-02-23',date2:'2028-02-29'});
});
test('Direct and Metrika have identical bounded dates and selected goal',()=>{
  const d=m.directSpec().params,p=m.metrikaParams('summary');
  assert.equal(d.SelectionCriteria.DateFrom,p.date1);assert.equal(d.SelectionCriteria.DateTo,p.date2);
  assert.equal(p.timezone,'+03:00');assert.equal(p.attribution,'last');
  assert.deepEqual(d.Goals,['612680821']);assert.deepEqual(d.AttributionModels,['LC']);
  assert.ok(d.ReportName.includes(p.date1));assert.ok(d.ReportName.includes(p.date2));
});
test('missing, queued and empty API evidence is not a numeric zero',()=>{
  assert.equal(m.evidenceStatus({status:204,totals:null}),'unavailable');
  assert.equal(m.evidenceStatus({status:201,totals:null}),'pending');
  assert.equal(m.evidenceStatus({status:202,totals:null}),'pending');
  assert.equal(m.evidenceStatus({status:403,totals:null}),'unavailable');
  assert.equal(m.evidenceStatus({status:200,totals:{clicks:0}}),'available');
});
test('Metrika must return three finite nonnegative metric totals',()=>{
  for(const totals of [[],[null,null,null],[1,2],[1,2,3,4],[1,-1,0],[1,NaN,0],['1',0,0]]) {
    const r=m.summarizeMetrika({status:200,body:{totals}},m.metrikaParams('summary'));
    assert.equal(r.totals,null);assert.equal(m.evidenceStatus(r),'unavailable');
  }
  const valid=m.summarizeMetrika({status:200,body:{totals:[0,0,0]}},m.metrikaParams('summary'));
  assert.deepEqual(valid.totals,[0,0,0]);assert.equal(m.evidenceStatus(valid),'available');
});
test('Direct unknown goal stays null and wrong interval is rejected',()=>{
  const h='Date\tCampaignId\tClicks\tConversions_612680821_LC\n';
  const r=m.parseDirect(h+m.config.date1+'\t714391927\t7\t--');
  assert.equal(r.totals.clicks,7);assert.equal(r.totals.selected_goal_converted_visits,null);
  assert.equal(m.parseDirect(h+'2000-01-01\t714391927\t7\t0').totals,null);
});
test('dedicated branch only, omitted denied ad-metrics request, no direct-only mode',()=>{
  assert.ok(yaml.includes('branches: [report/completed-analytics-20261011]'));
  assert.ok(!yaml.includes("MATCHED_DIRECT_ONLY: '1'"));
  assert.ok(code.includes("for(const kind of ['summary'])"));
  assert.ok(!/method:\s*['\"](?:add|update|delete|set)['\"]/.test(code));
});

// Run the real workflow entry point in an isolated child. All responses and
// credentials are synthetic; no network access or report-file writes occur.
const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL_729';
function reportFixture({directStatuses=[200],metrikaStatus=200,metrikaTotals=[3,2,1]}={}) {
  const fileImport = "import { writeFileSync } from 'node:fs';";
  assert.ok(code.includes(fileImport));
  const isolatedCode = code.replace(fileImport,
    'const writeFileSync = (path, content) => { globalThis.savedReport = {path,content}; };');
  const harness = `
    import assert from 'node:assert/strict';
    const sentinel = ${JSON.stringify(sentinel)};
    const fixture = ${JSON.stringify({directStatuses,metrikaStatus,metrikaTotals})};
    const calls = [];
    let directAttempt = 0;
    globalThis.setTimeout = (fn) => { fn(); return 0; };
    globalThis.fetch = async (url, options) => {
      calls.push({url,method:options.method,body:options.body});
      let status, body;
      if(url.startsWith('https://api-metrika.yandex.net/management/v1/counter/')) {
        status = 200;
        body = {counter:{id:112542227,time_zone_name:'Europe/Moscow',
          token:sentinel,filters:[{id:1,value:sentinel,start_ip:sentinel,end_ip:sentinel}],
          goals:[{id:612680821,name:'Synthetic lead',type:'action',
            conditions:[{type:'exact',url:'synthetic_lead',private:sentinel}]}]}};
      } else if(url.startsWith('https://api-metrika.yandex.net/stat/v1/data?')) {
        status = fixture.metrikaStatus;
        body = status === 200 ? {totals:fixture.metrikaTotals,data:[],private:sentinel}
          : {errors:[{message:sentinel}],token:sentinel};
      } else if(url === 'https://api.direct.yandex.com/json/v501/reports') {
        status = fixture.directStatuses[Math.min(directAttempt++,fixture.directStatuses.length-1)];
        // A header-only ready report represents a genuine zero-row result.
        body = status === 200 ? 'Date\\tCampaignId\\tClicks\\tConversions_612680821_LC\\n'
          : {error:{error_code:99,error_detail:sentinel},token:sentinel};
      } else {
        throw new Error('Unexpected endpoint');
      }
      return {status,headers:new Headers({requestId:'synthetic-request',retryIn:'0'}),
        text:async()=>status===204?'':typeof body==='string'?body:JSON.stringify(body)};
    };
    await import('data:text/javascript;base64,${Buffer.from(isolatedCode).toString('base64')}');
    process.stderr.write(JSON.stringify({calls,savedReport:globalThis.savedReport}));
  `;
  const child = spawnSync(process.execPath,['--input-type=module','-'],{
    input:harness,encoding:'utf8',timeout:10000,
    env:{PATH:process.env.PATH,RUN_MATCHED_REPORT:'1',
      YM_TOKEN:'YM_'+sentinel,YD_TOKEN:'YD_'+sentinel,YD_CLIENT_LOGIN:'LOGIN_'+sentinel},
  });
  assert.equal(child.error,undefined);
  assert.equal(child.signal,null);
  assert.ok(!child.stdout.includes(sentinel),'Report must omit tokens, client login and private API fields');
  const match = child.stdout.match(/^MATCHED_REPORT_BEGIN\n([\s\S]*)\nMATCHED_REPORT_END\n$/);
  assert.ok(match,'Expected only the allowlisted report in stdout');
  const report = JSON.parse(match[1]);
  const {calls,savedReport} = JSON.parse(child.stderr);
  assert.equal(savedReport.path,'/tmp/matched-report.json');
  assert.deepEqual(JSON.parse(savedReport.content),report);
  assert.equal(calls.filter(c=>c.url.includes('/management/')).length,1);
  const metrikaCalls = calls.filter(c=>c.url.includes('/stat/'));
  assert.equal(metrikaCalls.length,1);
  assert.ok(!decodeURIComponent(metrikaCalls[0].url).includes('ym:ad:'));
  assert.equal(metrikaCalls[0].method,'GET');
  const params = new URL(metrikaCalls[0].url).searchParams;
  assert.equal(params.get('ids'),'112542227');
  assert.equal(params.get('timezone'),'+03:00');
  assert.equal(params.get('metrics'),'ym:s:visits,ym:s:goal612680821reaches,ym:s:goal612680821visits');
  const directCalls = calls.filter(c=>c.url.includes('/reports'));
  for(const call of directCalls) {
    assert.equal(call.method,'POST');
    const spec = JSON.parse(call.body).params;
    assert.equal(spec.SelectionCriteria.DateFrom,params.get('date1'));
    assert.equal(spec.SelectionCriteria.DateTo,params.get('date2'));
    assert.deepEqual(spec.SelectionCriteria.Filter,[{Field:'CampaignId',Operator:'EQUALS',Values:['714391927']}]);
    assert.deepEqual(spec.Goals,['612680821']);
  }
  assert.equal(report.metrika_ad_clicks.evidence_status,'not_requested');
  return {report,directCalls,exitCode:child.status};
}

test('main rejects unavailable and pending Direct evidence with bounded retries and exit 2',()=>{
  for(const status of [204,403,201,202]) {
    const {report,directCalls,exitCode} = reportFixture({directStatuses:[status]});
    assert.equal(report.direct.totals,null);
    assert.equal(report.direct.evidence_status,[201,202].includes(status)?'pending':'unavailable');
    assert.equal(report.evidence_status,'incomplete');
    assert.equal(directCalls.length,[201,202].includes(status)?12:1);
    assert.equal(exitCode,2);
  }
});

test('main rejects unavailable or pending Metrika evidence with exit 2',()=>{
  for(const status of [204,403,201,202]) {
    const {report,exitCode} = reportFixture({metrikaStatus:status});
    assert.equal(report.metrika_summary.totals,null);
    assert.equal(report.metrika_summary.evidence_status,[201,202].includes(status)?'pending':'unavailable');
    assert.equal(report.evidence_status,'incomplete');
    assert.equal(exitCode,2);
  }
});

test('main rejects missing or malformed Metrika totals even with HTTP 200',()=>{
  for(const metrikaTotals of [[],[null,null,null],[1,2],[1,2,3,4],[1,-1,0],['1',0,0]]) {
    const {report,exitCode} = reportFixture({metrikaTotals});
    assert.equal(report.metrika_summary.totals,null);
    assert.equal(report.evidence_status,'incomplete');
    assert.equal(exitCode,2);
  }
});

test('main accepts a ready queued report and genuine zero metrics',()=>{
  const {report,directCalls,exitCode} = reportFixture({directStatuses:[201,202,200],metrikaTotals:[0,0,0]});
  assert.equal(directCalls.length,3);
  assert.equal(report.direct.totals.clicks,0);
  assert.deepEqual(report.metrika_summary.totals,[0,0,0]);
  assert.equal(report.evidence_status,'available');
  assert.equal(exitCode,0);
});
