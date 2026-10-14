#!/usr/bin/env python3
"""Install only the approved public IFC release; never publish source STEP files."""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'data/bim/cassette-library-release.json'
MAX_EXPANDED_BYTES = 64 * 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def expected_files() -> set[str]:
    models = json.loads((ROOT / 'data/bim/cassette-library.json').read_text())
    ids = {model['id'] for model in models}
    if len(ids) != 15:
        raise ValueError('The approved catalog must contain 15 unique models')
    names = {'index.html', 'viewer.js', 'viewer.css', 'README_RU.md', 'QA_REPORT_RU.md', 'catalog.json',
             'SHA256SUMS.txt', 'SteelProdukt_BIM_IFC_Public.zip',
             'SteelProdukt_Catalog_IFC4.ifc', 'SteelProdukt_Catalog_IFC4_Exact.ifc'}
    for model_id in ids:
        names.update({f'preview/{model_id}.json',
                      f'IFC4_coordination/{model_id}.ifc',
                      f'IFC4_exact_geometry/{model_id}.ifc'})
    return names


def validate(directory: Path, release: dict) -> None:
    names = expected_files()
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    if actual != names:
        raise ValueError(f'Unexpected/missing files: {sorted(actual ^ names)}')
    checksums = (directory / 'SHA256SUMS.txt').read_bytes()
    if digest(checksums) != release['manifestSha256']:
        raise ValueError('The release checksum manifest has changed')
    records = {}
    for line in checksums.decode('utf-8').splitlines():
        expected, name = line.split('  ', 1)
        if name in records:
            raise ValueError('Duplicate entry in checksum manifest')
        records[name] = expected
    if set(records) != names - {'SHA256SUMS.txt'}:
        raise ValueError('Incomplete checksum manifest')
    for name, expected in records.items():
        target = directory / name
        if target.is_symlink() or digest(target.read_bytes()) != expected:
            raise ValueError(f'Integrity check failed: {name}')
    catalog = json.loads((directory / 'catalog.json').read_text())
    if catalog['modelCount'] != 15 or len(catalog['models']) != 15:
        raise ValueError('Incorrect public model count')
    for name in names:
        if name.endswith('.ifc'):
            content = (directory / name).read_text('ascii')
            if not content.startswith('ISO-10303-21;') or "FILE_SCHEMA(('IFC4'));" not in content:
                raise ValueError(f'Invalid IFC header: {name}')
            if not content.rstrip().endswith('END-ISO-10303-21;'):
                raise ValueError(f'Truncated IFC: {name}')
    print(f'PASS: {len(names)} approved files; 15 models; 32 IFC files; SHA-256 verified.')
    print('This is package validation, not EXPRESS/MVD or Revit/Archicad certification.')


def install(archive: Path, release: dict) -> None:
    if not archive.is_file():
        raise FileNotFoundError(f'Approved archive is missing: {archive}')
    data = archive.read_bytes()
    if len(data) != release['archiveBytes'] or digest(data) != release['archiveSha256']:
        raise ValueError('Archive differs from the approved release; no files were installed')
    destination = ROOT / release['destination']
    if destination.exists():
        validate(destination, release)
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.bim-library-', dir=destination.parent) as temporary:
        staging = Path(temporary) / 'release'
        staging.mkdir()
        with zipfile.ZipFile(archive) as z:
            infos = z.infolist()
            if len(infos) != release['fileCount'] or sum(i.file_size for i in infos) > MAX_EXPANDED_BYTES:
                raise ValueError('Unexpected archive size or file count')
            if {i.filename for i in infos} != expected_files():
                raise ValueError('The archive contains unapproved paths')
            for info in infos:
                path = PurePosixPath(info.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in info.filename:
                    raise ValueError('Unsafe archive path')
                if stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
                    raise ValueError('Symlink or encrypted ZIP entry is not allowed')
                target = staging / info.filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(info))
        validate(staging, release)
        shutil.move(str(staging), str(destination))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check already installed assets')
    args = parser.parse_args()
    release = json.loads(RELEASE.read_text())
    if release['destination'] != 'public/bim/metallokassety':
        raise ValueError('Unexpected publication destination')
    if args.check:
        validate(ROOT / release['destination'], release)
    else:
        install(ROOT / release['archive'], release)


if __name__ == '__main__':
    main()
