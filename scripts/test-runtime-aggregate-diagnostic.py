import contextlib
import io
from unittest.mock import patch
import importlib.util
import json
import pathlib
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('runtime_diagnostic', pathlib.Path(__file__).with_name('runtime-aggregate-diagnostic.py'))
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)

class AggregateTests(unittest.TestCase):
    def test_cohort_and_consent_evidence_do_not_disclose_records(self):
        secret = 'PRIVATE_NAME_EMAIL_TOKEN_SENTINEL'
        base = {'createdAt':'2026-08-03T10:00:00Z','name':secret,'consent':{'event':'quote_request_consent','personalData':True,'recordedAt':'2026-08-03T10:00:00Z','clientTimestamp':'2026-08-03T09:59:59Z','personalDataConsentVersion':secret,'privacyVersion':secret,'ipHash':secret}}
        leads = [dict(base, requestId='SP-20260803-12345678'),dict(base,requestId='SP-20260803-87654321',consentAudit='deferred'),dict(base,requestId='SP-20261010-12345678',createdAt='2026-10-10T10:00:00Z',consentAudit=secret)]
        report=M.consent_summary(leads,[{'requestId':'SP-20260803-87654321'}])
        self.assertEqual(report['missing'],2)
        self.assertEqual(report['missing_historical_bucket'],1)
        self.assertEqual(report['missing_other_dates'],1)
        self.assertEqual(report['missing_state']['other'],1)
        self.assertEqual(report['missing_embedded_complete'],2)
        output=json.dumps(report)
        self.assertNotIn(secret,output)
        self.assertNotIn('SP-',output)
    def test_dates_and_missing_fields_are_not_assumed(self):
        r=M.consent_summary([{'requestId':'a','createdAt':'not-a-date'}],[])
        self.assertEqual(r['missing_unknown_date'],1)
        self.assertEqual(r['missing_embedded_complete'],0)
    def test_nginx_reports_only_allowlisted_options_and_source_classes(self):
        raw='# configuration file /etc/nginx/sites-enabled/default:\nserver {\n listen 443 ssl;\n}\n# configuration file /etc/nginx/sites-enabled/steelprodukt:\nserver {\n listen 443 ssl http2;\n}\nserver {\n listen 443 ssl http2;\n}\n# configuration file /private/SECRET_TOKEN.conf:\nserver {\n listen 10.0.0.2:443 ssl proxy_protocol SECRET_TOKEN;\n ssl_certificate_key /private/SECRET_TOKEN.key;\n}\n'
        r=M.nginx_summary(raw)
        self.assertEqual(r['ipv4_any_443_protocol_variants'],2)
        self.assertEqual(len(r['listeners']),4)
        self.assertEqual(r['listeners'][0]['source_kind'],'default_site')
        self.assertEqual(r['listeners'][0]['line'],2)
        self.assertEqual(r['listeners'][1]['source_kind'],'steelprodukt_site')
        output=json.dumps(r)
        self.assertNotIn('SECRET',output)
        self.assertNotIn('10.0.0.2',output)
        self.assertNotIn('/etc/',output)
    def test_nginx_identical_protocols_do_not_report_mismatch(self):
        r=M.nginx_summary('# configuration file /etc/nginx/sites-enabled/steelprodukt:\nlisten 443 ssl http2;\nlisten 443 ssl http2;\nlisten [::]:443 ssl http2;\n')
        self.assertEqual(r['ipv4_any_443_protocol_variants'],1)
    def test_reader_rejects_symlink_invalid_json_and_identity_mismatch(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d); secret=p/'secret.txt';secret.write_text('PRIVATE_SENTINEL')
            (p/'SP-20260803-12345678.json').symlink_to(secret)
            (p/'SP-20260803-87654321.json').write_text('{invalid')
            (p/'SP-20260803-11111111.json').write_text(json.dumps({'requestId':'wrong','source':'quote-form'}))
            rows,stats=M.read_records(p,'quote')
            self.assertEqual(rows,[])
            self.assertEqual(stats['symlinks'],1)
            self.assertEqual(stats['invalid'],2)
            self.assertNotIn('PRIVATE_SENTINEL',json.dumps(stats))
    def test_reader_skips_fifo_without_blocking(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'SP-20260803-12345678.json'
            M.os.mkfifo(p)
            rows,stats=M.read_records(d,'quote')
            self.assertEqual(rows,[])
            self.assertEqual(stats['invalid'],1)
    def test_main_exceptions_do_not_print_sensitive_error_or_stderr(self):
        output=io.StringIO()
        with patch.object(M.pathlib.Path,'read_text',side_effect=ValueError('PRIVATE_SENTINEL')), patch.object(M.subprocess,'run',side_effect=OSError('PRIVATE_SENTINEL')), contextlib.redirect_stdout(output):
            self.assertEqual(M.main('/nonexistent'),2)
        self.assertNotIn('PRIVATE_SENTINEL',output.getvalue())
        data=json.loads(output.getvalue())
        self.assertEqual(data['consent']['error'],'CONSENT_READ_FAILED')
        self.assertEqual(data['nginx']['error'],'NGINX_READ_FAILED')
    def test_nginx_failed_configuration_never_exposes_raw_output(self):
        output=io.StringIO()
        version=M.subprocess.CompletedProcess([],0,'','nginx/1.24.0 PRIVATE_SENTINEL')
        config=M.subprocess.CompletedProcess([],1,'PRIVATE_SENTINEL','PRIVATE_SENTINEL')
        with patch.object(M.pathlib.Path,'read_text',side_effect=OSError('PRIVATE_SENTINEL')), patch.object(M.subprocess,'run',side_effect=[version,config]), contextlib.redirect_stdout(output):
            self.assertEqual(M.main('/nonexistent'),2)
        self.assertNotIn('PRIVATE_SENTINEL',output.getvalue())
        self.assertEqual(json.loads(output.getvalue())['nginx']['status'],'unavailable')
    def test_public_schema_rejects_raw_values_and_unknown_keys(self):
        for value in [{'diagnostic':'runtime_cohorts_v1','secret':'PRIVATE_SENTINEL'},{'diagnostic':'runtime_cohorts_v1','nginx':{'source_kind':'PRIVATE_SENTINEL'}},{'diagnostic':'runtime_cohorts_v1','nginx':{'version':'PRIVATE_SENTINEL'}}]:
            with self.assertRaises(ValueError):
                M.validate_public_report(value)
        M.validate_public_report({'diagnostic':'runtime_cohorts_v1','read_only':True,'nginx':{'version':'1.24.0','status':'complete'}})

if __name__=='__main__':
    unittest.main()
