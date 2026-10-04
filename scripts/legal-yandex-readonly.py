import os, json, re, urllib.parse, requests

def token(name):
    value=os.environ.get(name) or os.environ.get('YANDEX_OAUTH_TOKEN','')
    value=re.sub(r'^(OAuth|Bearer)\s+', '', value.strip())
    match=re.search(r'(?:^|[#?&])access_token=([^&#\s]+)',value)
    return urllib.parse.unquote(match[1]) if match else value

def out(label,value):
    print('CHECK '+label+' '+json.dumps(value,ensure_ascii=False),flush=True)

def get(url,t,params=None):
    r=requests.get(url,headers={'Authorization':'OAuth '+t},params=params,timeout=40)
    r.raise_for_status()
    return r.json()

yw=None;uid=None
for source in ['YW_TOKEN','YANDEX_OAUTH_TOKEN','YD_TOKEN','YM_TOKEN']:
    candidate=token(source)
    if not candidate:continue
    r=requests.get('https://api.webmaster.yandex.net/v4/user',headers={'Authorization':'OAuth '+candidate},timeout=30)
    out('WEBMASTER_ACCESS',{'source':source,'http':r.status_code})
    if r.ok:yw=candidate;uid=r.json()['user_id'];break
assert uid is not None,'No authorized Webmaster token available'
root=f'https://api.webmaster.yandex.net/v4/user/{uid}/hosts'
hosts=get(root,yw)['hosts']
h=next(h for h in hosts if h.get('ascii_host_url','').rstrip('/')=='https://www.steelprodukt.ru')
base=root+'/'+urllib.parse.quote(h['host_id'],safe='')
out('HOST',{k:h.get(k) for k in ['ascii_host_url','verified','host_data_status','main_mirror']})
for label,path in [('SUMMARY','summary'),('DIAGNOSTICS','diagnostics'),('SITEMAPS','sitemaps?limit=100'),('EXCLUDED','search-urls/events/samples?limit=100')]:
    d=get(base+'/'+path,yw)
    if label=='EXCLUDED':
        d={'count':d.get('count'),'samples':[{'path':urllib.parse.urlparse(x.get('url','')).path,'event':x.get('event'),'reason':x.get('excluded_url_status'),'date':x.get('event_date')} for x in d.get('samples',[])]}
    out(label,d)
params=[('query_indicator',k) for k in ['TOTAL_SHOWS','TOTAL_CLICKS','AVG_SHOW_POSITION']]+[('date_from','2026-09-15'),('date_to','2026-10-03')]
out('SEARCH_HISTORY',get(base+'/search-queries/all/history',yw,params))
groups={};seen=set();count=None;dates=None
for offset in range(0,3000,500):
    params=[('order_by','TOTAL_SHOWS'),('limit','500'),('offset',str(offset))]+[('query_indicator',k) for k in ['TOTAL_SHOWS','TOTAL_CLICKS','AVG_SHOW_POSITION']]
    d=get(base+'/search-queries/popular',yw,params);count=d.get('count');dates=[d.get('date_from'),d.get('date_to')]
    rows=d.get('queries',[])
    for q in rows:
        if q['query_id'] in seen:continue
        seen.add(q['query_id']);text=q.get('query_text','').lower();v=q.get('indicators',{})
        group='cassettes' if re.search('металлокассет|металокассет',text) else 'baskets' if re.search('корзин|кондиционер',text) else 'manufacturing' if re.search('резк|гибк|сварк|чертеж|чертёж|металлоиздел|корпус|окраск',text) else 'brand' if re.search('сталь продукт|steelprodukt',text) else 'exhibitions' if re.search('выставк|expo|китай',text) else 'other'
        g=groups.setdefault(group,{'queries':0,'shows':0,'clicks':0});g['queries']+=1;g['shows']+=v.get('TOTAL_SHOWS',0);g['clicks']+=v.get('TOTAL_CLICKS',0)
    if len(rows)<500 or len(seen)>=int(count or 3000):break
out('INTENT_GROUPS',{'dates':dates,'totalQueries':count,'returnedQueries':len(seen),'groups':groups})
ym=token('YM_TOKEN');counter='112542227'
c=get('https://api-metrika.yandex.net/management/v1/counter/'+counter,ym,{'field':'counter_flags'})['counter']
out('COUNTER',{k:c.get(k) for k in ['id','site','status','counter_flags','code_options']})
for a,b in [('2026-09-20','2026-09-26'),('2026-09-27','2026-10-03')]:
    d=get('https://api-metrika.yandex.net/stat/v1/data',ym,{'ids':counter,'date1':a,'date2':b,'dimensions':'ym:s:trafficSource','metrics':'ym:s:visits,ym:s:users,ym:s:goal612680821reaches','accuracy':'full','limit':20})
    out('METRIKA_PERIOD',{'from':a,'to':b,'totals':d.get('totals'),'sampled':d.get('sampled'),'data':d.get('data')})
d=get('https://api-metrika.yandex.net/stat/v1/data',ym,{'ids':counter,'date1':'2026-10-04','date2':'2026-10-04','metrics':'ym:s:visits,ym:s:goal612680821reaches,ym:s:goal612680841reaches','filters':"ym:s:UTMCampaign=='QA20261004-0930'",'accuracy':'full'})
out('EARLIER_OWNER_TEST_GOALS',{'totals':d.get('totals'),'sampled':d.get('sampled'),'data_lag':d.get('data_lag')})
