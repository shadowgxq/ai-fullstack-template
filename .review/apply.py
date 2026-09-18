"""Apply the reviewed patch only when the original source matches."""
import hashlib
import json
import lzma
from pathlib import Path
import subprocess
import tempfile

root = Path.cwd().resolve()
parts = sorted((root / '.review/parts').glob('[0-9][0-9]'))
assert len(parts) == 10, 'Incomplete reviewed patch'
payload = json.loads(lzma.decompress(b''.join(p.read_bytes() for p in parts)))
product = root / 'docs/product/team-site.md'
product_hash = hashlib.sha256(product.read_bytes()).hexdigest()
deletions = []
for name, digest in payload['delete'].items():
    path = root / name
    assert not Path(name).is_absolute() and '..' not in Path(name).parts
    assert path.resolve().is_relative_to(root) and not path.is_symlink()
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, name
    deletions.append(path)
with tempfile.NamedTemporaryFile('w', encoding='utf-8', suffix='.patch') as patch:
    patch.write(payload['patch'])
    patch.flush()
    subprocess.run(['git', 'apply', '--check', patch.name], check=True)
    subprocess.run(['git', 'apply', patch.name], check=True)
for path in deletions:
    path.unlink()
    parent = path.parent
    while parent != root:
        try:
            parent.rmdir()
        except OSError:
            break
        parent = parent.parent
assert hashlib.sha256(product.read_bytes()).hexdigest() == product_hash
print(f'Applied reviewed modifications; deleted {len(deletions)} obsolete files; team-site requirement unchanged.')
