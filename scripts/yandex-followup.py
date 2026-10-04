import os,json,re,urllib.parse,requests
t=re.sub(r'^(OAuth|Bearer)\\s+','',os.environ['YD_TOKEN'].strip())
s=requests.Session();s.headers['Authorization']='OAuth '+t
def get(u,p=None):
 r=s.get(u,params=p,timeout=45);r.raise_for_status();return r.json()
uid=get('https://api.webmaster.yandex.net/v4/user')['user_id']
root=f'https://api.webmaster.yandex.net/v4/user/{uid}/hosts'
h=next(x for x in get(root)['hosts'] if x.get('ascii_host_url','').rstrip('/')=='https://www.steelprodukt.ru')
base=root+'/'+urllib.parse.quote(h['host_id'],safe='')
events=[]
for offset in range(0,1000,100):
 d=get(base+'/search-urls/events/samples',{'offset':offset,'limit':100});events+=d.get('samples',[])
 if offset+100>=d['count']:break
latest={}
for x in sorted(events,key=lambda x:x['event_date'],reverse=True):latest.setdefault(x['url'],x)
print('LATEST_REMOVALS '+json.dumps([x for x in latest.values() if x['event']=='REMOVED_FROM_SEARCH'],ensure_ascii=False))
for offset in [0,500,1000]:
 p=[('date_from','2026-09-26'),('date_to','2026-10-02'),('order_by','TOTAL_SHOWS'),('limit',500),('offset',offset)]+[('query_indicator',k) for k in ['TOTAL_SHOWS','TOTAL_CLICKS']]
 d=get(base+'/search-queries/popular',p)
 print('PAGE '+json.dumps({'offset':offset,'count':d.get('count'),'dates':[d.get('date_from'),d.get('date_to')],'rows':len(d.get('queries',[]))},ensure_ascii=False))
 print('COMMERCIAL '+json.dumps([q for q in d.get('queries',[]) if re.search('металлокассет|гибка|сварка|корзин',q.get('query_text','').lower())],ensure_ascii=False))
 if len(d.get('queries',[]))<500:break
