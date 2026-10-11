"""Read-only, aggregate-only runtime diagnosis. Never prints source records/config."""
import datetime
import json
import os
import pathlib
import re
import shlex
import stat
import subprocess
import sys

REQUEST = re.compile(r'SP-(?:AI-)?\d{8}-[A-F0-9]{8}\Z')
AUDIT = re.compile(r'[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\Z',re.I)
MAX_BYTES = 2*1024*1024

def date_valid(value):
    if not isinstance(value,str):
        return False
    try:
        parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
        return parsed.tzinfo is not None
    except ValueError:
        return False

def consent_summary(leads,audits):
    present={r.get('requestId') for r in audits}
    result={'leads':len(leads),'audit_records':len(audits),'linked':0,'missing':0,
            'historical_bucket_basis':'stored_iso_day_2026_08_03',
            'missing_historical_bucket':0,'missing_other_dates':0,'missing_unknown_date':0,
            'missing_state':dict.fromkeys(['field_absent','pending','recorded','deferred','other'],0),
            'missing_embedded_complete':0,
            'missing_embedded':dict.fromkeys(['event','personal_data_flag','recorded_timestamp','client_timestamp','consent_version','privacy_version','network_hash_present'],0)}
    for record in leads:
        if record.get('requestId') in present:
            result['linked']+=1
            continue
        result['missing']+=1
        created=record.get('createdAt')
        bucket='missing_unknown_date' if not date_valid(created) else 'missing_historical_bucket' if created[:10]=='2026-08-03' else 'missing_other_dates'
        result[bucket]+=1
        state=record.get('consentAudit')
        key='field_absent' if 'consentAudit' not in record else state if state in ('pending','recorded','deferred') else 'other'
        result['missing_state'][key]+=1
        consent=record.get('consent')
        consent=consent if isinstance(consent,dict) else {}
        nonempty=lambda value:isinstance(value,str) and bool(value.strip())
        flags={'event':consent.get('event') in ('quote_request_consent','assistant_lead_consent'),
               'personal_data_flag':consent.get('personalData') is True,
               'recorded_timestamp':date_valid(consent.get('recordedAt')),
               'client_timestamp':date_valid(consent.get('clientTimestamp')),
               'consent_version':nonempty(consent.get('personalDataConsentVersion')),
               'privacy_version':nonempty(consent.get('privacyVersion')),
               'network_hash_present':nonempty(consent.get('ipHash'))}
        for key,value in flags.items():
            result['missing_embedded'][key]+=int(value)
        result['missing_embedded_complete']+=int(all(flags.values()))
    return result

def read_records(root,kind):
    stats={'invalid':0,'symlinks':0,'oversized':0,'skipped_non_records':0}
    root=pathlib.Path(root)
    if root.is_symlink() or root.resolve()!=root.absolute() or not root.is_dir():
        raise ValueError('UNSAFE_OR_MISSING_ROOT')
    records=[]
    entries=list(root.iterdir())
    if len(entries)>10000:
        raise ValueError('TOO_MANY_ENTRIES')
    for path in entries:
        if path.suffix!='.json':
            continue
        pattern=AUDIT if kind=='audit' else REQUEST
        if not pattern.fullmatch(path.stem):
            stats['skipped_non_records']+=1
            continue
        try:
            if path.is_symlink():
                stats['symlinks']+=1
                continue
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
            with os.fdopen(fd,'rb') as stream:
                meta=os.fstat(stream.fileno())
                if not stat.S_ISREG(meta.st_mode):
                    stats['invalid']+=1
                    continue
                raw=stream.read(MAX_BYTES+1)
                if len(raw)>MAX_BYTES:
                    stats['oversized']+=1
                    continue
            record=json.loads(raw)
            if not isinstance(record,dict) or not isinstance(record.get('requestId'),str) or not REQUEST.fullmatch(record['requestId']):
                raise ValueError('INVALID_IDENTITY')
            if kind=='audit':
                if record.get('auditId')!=path.stem:
                    raise ValueError('INVALID_AUDIT_IDENTITY')
            elif record['requestId']!=path.stem or record.get('source')!=('quote-form' if kind=='quote' else 'engineering-assistant'):
                raise ValueError('INVALID_LEAD_IDENTITY')
            records.append(record)
        except (OSError,ValueError,UnicodeError,RecursionError):
            stats['invalid']+=1
    return records,stats

def nginx_summary(raw):
    sections=re.split(r'^# configuration file ([^\n]+):\n',raw,flags=re.M)
    listeners=[]
    seen=set()
    duplicate_sections=0
    allowed={'ssl','http2','quic','proxy_protocol','default_server','reuseport','bind','ipv6only=on','ipv6only=off'}
    for order in range(1,len(sections),2):
        name,body=sections[order:order+2]
        duplicate_sections+=int(name in seen)
        seen.add(name)
        source='steelprodukt_site' if name in ('/etc/nginx/sites-enabled/steelprodukt','/etc/nginx/sites-available/steelprodukt') else 'default_site' if name in ('/etc/nginx/sites-enabled/default','/etc/nginx/sites-available/default') else 'other_source'
        for match in re.finditer(r'^[ \t]*listen[ \t]+([^;]{1,512});',body,flags=re.M):
            try:
                tokens=shlex.split(match.group(1),comments=True)
            except ValueError:
                continue
            if not tokens:
                continue
            address=tokens[0]
            endpoint='ipv4_any_443' if address in ('443','*:443','0.0.0.0:443') else 'ipv6_any_443' if address=='[::]:443' else 'other_443' if address.endswith(':443') else None
            if endpoint is None:
                continue
            options=sorted({t for t in tokens[1:] if t in allowed})
            listeners.append({'dump_section_order':(order+1)//2,'source_kind':source,'line':body[:match.start()].count('\n')+1,'endpoint':endpoint,'options':options,'unknown_option_count':sum(t not in allowed for t in tokens[1:])})
    protocols=('ssl','http2','quic','proxy_protocol')
    variants={tuple(p for p in protocols if p in row['options']) for row in listeners if row['endpoint']=='ipv4_any_443'}
    return {'source_sections':len(seen),'duplicate_source_sections':duplicate_sections,'listeners':listeners,'ipv4_any_443_protocol_variants':len(variants)}

def validate_public_report(value):
    keys=set('diagnostic read_only consent nginx status error leads audit_records linked missing historical_bucket_basis missing_historical_bucket missing_other_dates missing_unknown_date missing_state field_absent pending recorded deferred other missing_embedded_complete missing_embedded event personal_data_flag recorded_timestamp client_timestamp consent_version privacy_version network_hash_present read_stats quote assistant audit invalid symlinks oversized skipped_non_records version configuration_valid protocol_warning_present source_sections duplicate_source_sections listeners dump_section_order source_kind line endpoint options unknown_option_count ipv4_any_443_protocol_variants'.split())
    strings={'runtime_cohorts_v1','complete','partial','unavailable','CONSENT_READ_FAILED','NGINX_READ_FAILED','DIAGNOSTIC_FAILED','stored_iso_day_2026_08_03','steelprodukt_site','default_site','other_source','ipv4_any_443','ipv6_any_443','other_443','ssl','http2','quic','proxy_protocol','default_server','reuseport','bind','ipv6only=on','ipv6only=off'}
    def check(item,key='',depth=0):
        if depth>8:
            raise ValueError('UNSAFE_OUTPUT')
        if isinstance(item,dict):
            for k,v in item.items():
                if k not in keys:
                    raise ValueError('UNSAFE_OUTPUT')
                check(v,k,depth+1)
        elif isinstance(item,list):
            if len(item)>10000:
                raise ValueError('UNSAFE_OUTPUT')
            for child in item:
                check(child,key,depth+1)
        elif isinstance(item,bool):
            return
        elif isinstance(item,int) and 0<=item<=10000000:
            return
        elif isinstance(item,str) and (item in strings or (key=='version' and re.fullmatch(r'\d+\.\d+\.\d+',item))):
            return
        elif item is None and key=='version':
            return
        else:
            raise ValueError('UNSAFE_OUTPUT')
    if not isinstance(value,dict) or value.get('diagnostic')!='runtime_cohorts_v1':
        raise ValueError('UNSAFE_OUTPUT')
    check(value)
    return value

def main(app_path):
    output={'diagnostic':'runtime_cohorts_v1','read_only':True,'consent':{'status':'unavailable'},'nginx':{'status':'unavailable'}}
    try:
        env={}
        for line in (pathlib.Path(app_path)/'.env.production').read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key,value=line.split('=',1)
                if key.strip() in ('QUOTE_STORAGE_PATH','ASSISTANT_LEAD_STORAGE_PATH','CONSENT_AUDIT_STORAGE_PATH'):
                    env[key.strip()]=value.strip().strip('"').strip("'")
        quote,qstat=read_records(env.get('QUOTE_STORAGE_PATH') or '/var/lib/steelprodukt/quote-leads','quote')
        assistant,astat=read_records(env.get('ASSISTANT_LEAD_STORAGE_PATH') or '/var/lib/steelprodukt/assistant-leads','assistant')
        audits,cstat=read_records(env.get('CONSENT_AUDIT_STORAGE_PATH') or '/var/lib/steelprodukt/consent-audit','audit')
        output['consent']={'status':'complete',**consent_summary(quote+assistant,audits),'read_stats':{'quote':qstat,'assistant':astat,'audit':cstat}}
        if any(v for stats in (qstat,astat,cstat) for v in stats.values()):
            output['consent']['status']='partial'
    except Exception:
        output['consent']={'status':'unavailable','error':'CONSENT_READ_FAILED'}
    try:
        version=subprocess.run(['/usr/sbin/nginx','-v'],capture_output=True,text=True,timeout=15)
        match=re.search(r'nginx/(\d+\.\d+\.\d+)',version.stderr)
        config=subprocess.run(['/usr/sbin/nginx','-T'],capture_output=True,text=True,timeout=30)
        output['nginx']={'status':'complete' if config.returncode==0 else 'unavailable','version':match.group(1) if match else None,'configuration_valid':config.returncode==0,'protocol_warning_present':'protocol options redefined' in config.stderr}
        if config.returncode==0:
            output['nginx'].update(nginx_summary(config.stdout))
    except Exception:
        output['nginx']={'status':'unavailable','error':'NGINX_READ_FAILED'}
    print(json.dumps(validate_public_report(output),sort_keys=True))
    return 0 if all(output[k]['status']=='complete' for k in ('consent','nginx')) else 2

if __name__=='__main__':
    try:
        if len(sys.argv)==3 and sys.argv[1]=='--validate-output':
            raw=pathlib.Path(sys.argv[2]).read_bytes()
            if len(raw)>1024*1024:
                raise ValueError('OVERSIZED_OUTPUT')
            print(json.dumps(validate_public_report(json.loads(raw)),sort_keys=True))
            code=0
        else:
            code=main(sys.argv[1])
    except BaseException:
        print('{"diagnostic":"runtime_cohorts_v1","error":"DIAGNOSTIC_FAILED"}')
        code=2
    raise SystemExit(code)
