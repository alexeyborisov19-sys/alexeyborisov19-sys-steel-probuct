#!/usr/bin/env python3
"""Apply a source-backed operation-rate patch; never replace supplier prices."""
import argparse, json, math, os, shutil, tempfile
from pathlib import Path
from datetime import datetime, timezone


def apply(basis_path, patch_path, dry_run=False):
    basis_path, patch_path = Path(basis_path), Path(patch_path)
    raw = basis_path.read_bytes()
    basis, patch = json.loads(raw), json.loads(patch_path.read_bytes())
    allowed = {'weldRubPerM', 'countersinkRubEach', 'bendRubEach', 'powderRubPerM2', 'laserRubPerM'}
    if not isinstance(patch, dict) or not patch or set(patch) - allowed:
        raise ValueError('Invalid rate patch keys')
    def validate(row):
        value = row.get('rateRub')
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError('Invalid operation rate')
        source = row.get('source', {})
        if any(not isinstance(source.get(k), str) or not source[k].strip() for k in ('id', 'label', 'confirmedAt', 'note')):
            raise ValueError('Missing rate provenance')
        datetime.fromisoformat(source['confirmedAt'].replace('Z', '+00:00'))
    for key, value in patch.items():
        if key == 'laserRubPerM':
            if not isinstance(value, list) or not value: raise ValueError('Empty laser patch')
            seen = set()
            for row in value:
                validate(row)
                identity = (row['materialId'], row['thicknessMm'])
                if identity in seen: raise ValueError('Duplicate laser patch')
                seen.add(identity)
                matches = [r for r in basis['rateBook'][key] if (r['materialId'], r['thicknessMm']) == identity]
                if len(matches) != 1: raise ValueError('Laser patch must match one existing tariff')
                # Change only the documented base rate and its provenance.
                matches[0].update(rateRub=row['rateRub'], source=row['source'])
        else:
            validate(value)
            basis['rateBook'][key] = value
    if dry_run: return
    if basis_path.read_bytes() != raw: raise RuntimeError('Basis changed; retry against latest prices')
    backup = basis_path.with_name(basis_path.name + '.before-rates-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f'))
    shutil.copy2(basis_path, backup); os.chmod(backup, 0o600)
    fd, name = tempfile.mkstemp(dir=basis_path.parent, prefix='.rate-patch-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            json.dump(basis, output, ensure_ascii=False, indent=2); output.write('\n'); output.flush(); os.fsync(output.fileno())
        os.chmod(name, 0o600)
        os.replace(name, basis_path)
    finally:
        if os.path.exists(name): os.unlink(name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('basis'); parser.add_argument('patch'); parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    apply(args.basis, args.patch, args.dry_run)
    print('Private rate patch validated.' if args.dry_run else 'Private rates updated; supplier snapshots preserved.')
