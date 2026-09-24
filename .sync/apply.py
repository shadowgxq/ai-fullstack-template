"""One-time reviewed source mirror plus exact, guarded integration edits."""
from pathlib import Path, PurePosixPath
import base64
import hashlib
import io
import json
import lzma
import shutil
import sys
import tarfile
import zipfile

root = Path.cwd().resolve()

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def safe(base, name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts or '.git' in relative.parts:
        raise ValueError('Unsafe source path: ' + name)
    result = base.joinpath(*relative.parts)
    if not result.resolve().is_relative_to(base.resolve()):
        raise ValueError('Path escapes target')
    return result

packed = base64.b64decode(''.join((root / f'.sync/payload-{i:02}.b64').read_text() for i in range(5)), validate=True)
assert digest(packed) == '983d827847c93680007b393699fdd0540c08a01a24b5a4aa66530ad2caedb6d1'
rows = json.loads(lzma.decompress(packed))
manifest = {row['path']: json.loads(row['content']) for row in rows if row['path'] in ('scripts/frontend-source.json', 'scripts/manager/upstream.json')}

def read_archive(zip_path, tar_name):
    with zipfile.ZipFile(zip_path) as archive:
        assert archive.namelist() == [tar_name], archive.namelist()
        raw = archive.read(tar_name)
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        result = {}
        for member in archive.getmembers():
            if not member.isfile() or member.name in result:
                raise ValueError('Unexpected archive entry')
            safe(root, member.name)
            result[member.name] = archive.extractfile(member).read()
        return result

frontend = read_archive(sys.argv[1], 'frontend-selected.tar.gz')
manager = read_archive(sys.argv[2], 'manager-selected.tar.gz')
front_manifest = manifest['scripts/frontend-source.json']['files']
manager_manifest = manifest['scripts/manager/upstream.json']['files']
assert set(frontend) == set(front_manifest), 'Frontend export scope mismatch'
assert set(manager) == {row['source'] for row in manager_manifest}, 'Manager export scope mismatch'
for name, expected in front_manifest.items():
    assert digest(frontend[name]) == expected, name
for row in manager_manifest:
    assert digest(manager[row['source']]) == row['sha256'], row['source']

shutil.rmtree(root / 'frontend')
for name, raw in frontend.items():
    path = safe(root / 'frontend', name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
for row in manager_manifest:
    path = safe(root, row['path'])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(manager[row['source']])
for path in (root / '.agents/skills').glob('openspec-*'):
    if path.is_dir():
        shutil.rmtree(path)
source = Path(sys.argv[3]) / '.agents/skills'
for path in source.iterdir():
    target = root / '.agents/skills' / path.name
    if path.is_dir():
        shutil.copytree(path, target)
    else:
        shutil.copyfile(path, target)

for row in rows:
    assert not row['path'].startswith(('.github/workflows/', '.sync/'))
    path = safe(root, row['path'])
    before = path.read_bytes() if path.is_file() else None
    assert (digest(before) if before is not None else None) == row['before'], row['path']
    if 'edits' in row:
        lines = before.decode('utf-8').splitlines(keepends=True)
        for start, end, text in reversed(row['edits']):
            lines[start:end] = [text]
        after = ''.join(lines)
    else:
        after = row['content']
    if after is None:
        path.unlink()
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(after, encoding='utf-8')
        path.chmod(0o755 if row['mode'] == '100755' else 0o644)
print(f'Mirrored {len(frontend)} frontend files and {len(manager)} Manager files; applied {len(rows)} reviewed integration edits.')
