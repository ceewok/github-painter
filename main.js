/* Buildless, browser-local contribution painter. */
'use strict';
const counts = [0, 1, 5, 10, 20];
const today = new Date().toISOString().slice(0, 10);
let year = new Date().getUTCFullYear() - 1, level = 4, erasing = false, drawing = false, strokeLevel = 4;
let paintings = {}, history = [], strokeBefore = null;
try { paintings = JSON.parse(localStorage.getItem('github-painter') || '{}'); } catch { paintings = {}; }
if (!paintings || typeof paintings !== 'object' || Array.isArray(paintings)) paintings = {};
const $ = id => document.getElementById(id);
function values() { return paintings[year] || (paintings[year] = {}); }
function entries() { return Object.entries(values()).filter(([date, value]) => date.startsWith(`${year}-`) && date <= today && Number.isInteger(value) && value > 0 && value <= 4).sort(); }
function persist() { try { localStorage.setItem('github-painter', JSON.stringify(paintings)); } catch {} }
function stats() { const data = entries(); $('days-count').textContent = data.length; $('commits-count').textContent = data.reduce((sum, [,v]) => sum + counts[v], 0).toLocaleString(); }
function setTool(erase) { erasing = erase; $('paint').classList.toggle('active', !erase); $('erase').classList.toggle('active', erase); $('paint').setAttribute('aria-pressed', !erase); $('erase').setAttribute('aria-pressed', erase); }
function render() {
  $('graph').replaceChildren(); $('months').replaceChildren();
  const start = new Date(Date.UTC(year, 0, 1)), offset = start.getUTCDay();
  const total = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  const weeks = Math.ceil((offset + total) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(Date.UTC(year, 0, i - offset + 1));
    if (i < offset || i >= offset + total) { const blank = document.createElement('span'); blank.className = 'blank'; $('graph').append(blank); continue; }
    const key = date.toISOString().slice(0, 10), button = document.createElement('button');
    button.dataset.date = key; button.dataset.level = values()[key] || 0; button.disabled = key > today;
    describe(button); button.tabIndex = i === offset ? 0 : -1;
    $('graph').append(button);
    if (date.getUTCDate() === 1) { const month = document.createElement('span'); month.textContent = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }); month.style.left = `${Math.floor(i / 7) / weeks * 100}%`; $('months').append(month); }
  }
  stats();
}
function describe(button) { const text = `${button.dataset.date}: ${counts[Number(button.dataset.level)] || 0} commits${button.disabled ? ' (future date)' : ''}`; button.title = text; button.setAttribute('aria-label', text); }
function apply(button, shade) { if (!button?.dataset.date || button.disabled) return; if (shade) values()[button.dataset.date] = shade; else delete values()[button.dataset.date]; button.dataset.level = shade; describe(button); stats(); }
function finish() { if (!drawing) return; drawing = false; if (JSON.stringify(values()) !== strokeBefore) history.push({ year, data: strokeBefore }); strokeBefore = null; persist(); }
for (let y = new Date().getUTCFullYear(); y >= 1970; y--) { const option = document.createElement('option'); option.value = y; option.textContent = y; $('year').append(option); }
$('year').value = year; $('year').onchange = () => { finish(); year = Number($('year').value); render(); };
for (let i = 1; i <= 4; i++) { const button = document.createElement('button'); button.dataset.level = i; button.title = `${counts[i]} commits per day`; button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', i === level); button.classList.toggle('selected', i === level); button.onclick = () => { level = i; setTool(false); for (const child of $('palette').children) { child.classList.toggle('selected', child === button); child.setAttribute('aria-pressed', child === button); } }; $('palette').append(button); }
$('paint').onclick = () => setTool(false); $('erase').onclick = () => setTool(true);
$('graph').oncontextmenu = event => event.preventDefault();
$('graph').onpointerdown = event => { if (!event.target.dataset.date || event.target.disabled || ![0,2].includes(event.button)) return; event.preventDefault(); strokeBefore = JSON.stringify(values()); drawing = true; strokeLevel = event.button === 2 || erasing ? 0 : level; event.target.focus(); apply(event.target, strokeLevel); };
document.addEventListener('pointermove', event => { if (drawing) { event.preventDefault(); apply(document.elementFromPoint(event.clientX, event.clientY), strokeLevel); } }, { passive: false });
document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', finish); window.addEventListener('blur', finish);
$('graph').onkeydown = event => { const button = event.target; if (!button.dataset.date) return; const movement = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key]; if (movement) { event.preventDefault(); const cells = [...$('graph').children], next = cells[cells.indexOf(button) + movement]; if (next?.dataset.date && !next.disabled) { button.tabIndex = -1; next.tabIndex = 0; next.focus(); } } else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); history.push({ year, data: JSON.stringify(values()) }); apply(button, erasing ? 0 : level); persist(); } };
$('undo').onclick = () => { finish(); const previous = history.pop(); if (!previous) return; year = previous.year; $('year').value = year; paintings[year] = JSON.parse(previous.data); persist(); render(); };
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('undo').click(); } });
$('clear').onclick = () => { history.push({ year, data: JSON.stringify(values()) }); paintings[year] = {}; persist(); render(); };
$('demo').onclick = () => { history.push({ year, data: JSON.stringify(values()) }); const heart = ['01100110','11111111','11111111','01111110','00111100','00011000']; const first = new Date(Date.UTC(year,0,1)); const start = 7 - first.getUTCDay() + 7 * 20; heart.forEach((row,r) => [...row].forEach((pixel,c) => { const date = new Date(Date.UTC(year,0,1 + start + c * 7 + r)).toISOString().slice(0,10); if (pixel === '1' && date <= today) values()[date] = 4; })); persist(); render(); };
function generateScript(repo, email, plan) {
  return `#!/usr/bin/env python3
"""Generated contribution artwork. Requires Python 3, Git; optional GitHub CLI."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

CONFIG = json.loads(${JSON.stringify(JSON.stringify({repo, email, plan}))})

def run(*args, cwd=None, env=None):
    return subprocess.run(args, cwd=cwd, env=env, check=True)

def capture(target, *args):
    return subprocess.run(['git', *args], cwd=target, check=True, capture_output=True, text=True).stdout.strip()

def data_block(text):
    payload = text.encode('utf-8')
    return b'data ' + str(len(payload)).encode() + b'\\n' + payload + b'\\n'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true', help='Create a PUBLIC GitHub repository and push (requires gh auth login)')
    parser.add_argument('--private', action='store_true', help='Use private visibility with --publish')
    parser.add_argument('--name', help='Commit author name (defaults to git user.name)')
    parser.add_argument('--resume', action='store_true', help='Continue an interrupted generated repository, including older script versions')
    args = parser.parse_args()
    if not shutil.which('git'):
        sys.exit('Install Git first: https://git-scm.com')
    if args.private and not args.publish:
        parser.error('--private requires --publish')
    if args.publish:
        if not shutil.which('gh'):
            sys.exit('Install GitHub CLI, then run gh auth login: https://cli.github.com')
        run('gh', 'auth', 'status')
    name = args.name
    if not name:
        result = subprocess.run(['git', 'config', 'user.name'], capture_output=True, text=True)
        name = result.stdout.strip()
    if not name:
        sys.exit('Set git config --global user.name or pass --name "Your Name".')
    target = Path.cwd() / CONFIG['repo']
    if target.exists() and not args.resume:
        sys.exit('Destination already exists; refusing to overwrite: ' + str(target))
    for date, count in CONFIG['plan']:
        if datetime.date.fromisoformat(date) > datetime.datetime.now(datetime.timezone.utc).date():
            sys.exit('The plan contains a future date: ' + date)
        if not isinstance(count, int) or not 1 <= count <= 20:
            sys.exit('Invalid commit count.')
    marks = [(date, number) for date, count in CONFIG['plan'] for number in range(count)]
    if not marks:
        sys.exit('Nothing to paint.')
    if any(char in name + CONFIG['email'] for char in '\\r\\n<>'):
        sys.exit('Name and email cannot contain newlines or angle brackets.')
    completed = 0
    if args.resume:
        if not (target / '.git').is_dir():
            sys.exit('No generated repository to resume: ' + str(target))
        if json.loads((target / 'artwork.json').read_text(encoding='utf-8')) != CONFIG['plan']:
            sys.exit('The saved artwork differs from this script. Export the original painting to resume.')
        if capture(target, 'symbolic-ref', '--short', 'HEAD') != 'main':
            sys.exit('Resume requires the generated main branch to be checked out.')
        head = subprocess.run(['git', 'rev-parse', '--verify', 'HEAD'], cwd=target, capture_output=True, text=True)
        if head.returncode == 0:
            records = capture(target, 'log', '--reverse', '--format=%s|%ae|%aI|%cI').splitlines()
            if len(records) > len(marks):
                sys.exit('Repository has more commits than this artwork.')
            for index, record in enumerate(records):
                date, number = marks[index]
                stamp = date + 'T12:00:' + str(number).zfill(2) + '+00:00'
                expected = 'Paint ' + date + ' (' + str(number + 1) + ')|' + CONFIG['email'] + '|' + stamp + '|' + stamp
                parts = record.split('|')
                if len(parts) == 4:
                    parts[2:] = [part[:-1] + '+00:00' if part.endswith('Z') else part for part in parts[2:]]
                if '|'.join(parts) != expected:
                    sys.exit('History does not match the original painting; refusing to change it.')
            completed = len(records)
        # Only known generated files may be refreshed. Preserve other files and edits.
        changed = capture(target, 'status', '--porcelain', '--untracked-files=all').splitlines()
        if any(line[3:] not in ('README.md', 'artwork.json', 'painting.txt') for line in changed):
            sys.exit('Repository contains other changes. Save them before resuming.')
        readme = '# Contribution art\\n\\nAn intentionally generated contribution-calendar artwork.\\n'
        if (target / 'README.md').read_text(encoding='utf-8') != readme:
            sys.exit('README was edited; refusing to overwrite it.')
        painting = target / 'painting.txt'
        if painting.exists():
            text = painting.read_text(encoding='utf-8')
            old_lines = [date + ' / mark ' + str(number + 1) + '\\n' for date, number in marks]
            allowed = {''.join(old_lines[:completed]), ''.join(old_lines[:completed + 1])}
            if completed:
                allowed.add(old_lines[completed - 1])
            if text not in allowed:
                sys.exit('painting.txt was edited; refusing to overwrite it.')
    else:
        target.mkdir()
        run('git', 'init', '-b', 'main', str(target))
    run('git', 'config', 'user.name', name, cwd=target)
    run('git', 'config', 'user.email', CONFIG['email'], cwd=target)
    (target / 'README.md').write_text('# Contribution art\\n\\nAn intentionally generated contribution-calendar artwork.\\n', encoding='utf-8')
    (target / 'artwork.json').write_text(json.dumps(CONFIG['plan'], indent=2) + '\\n', encoding='utf-8')
    total = sum(count for _, count in CONFIG['plan'])
    print('Starting at ' + str(completed) + '/' + str(total) + ' commits. Importing remaining artwork...', flush=True)
    stream = bytearray(b'feature done\\n')
    for index in range(completed, total):
        date, number = marks[index]
        stamp = date + 'T12:00:' + str(number).zfill(2) + '+00:00'
        timestamp = int(datetime.datetime.fromisoformat(stamp).timestamp())
        identity = name + ' <' + CONFIG['email'] + '> ' + str(timestamp) + ' +0000\\n'
        stream.extend(('commit refs/heads/main\\nauthor ' + identity + 'committer ' + identity).encode('utf-8'))
        stream.extend(data_block('Paint ' + date + ' (' + str(number + 1) + ')'))
        if index == completed and completed:
            stream.extend(b'from refs/heads/main^0\\n')
        files = {'painting.txt': date + ' / mark ' + str(number + 1) + '\\n'}
        if index == 0:
            files.update({'README.md': (target / 'README.md').read_text(encoding='utf-8'),
                          'artwork.json': (target / 'artwork.json').read_text(encoding='utf-8')})
        for filename, content in files.items():
            stream.extend(('M 100644 inline ' + filename + '\\n').encode())
            stream.extend(data_block(content))
        stream.extend(b'\\n')
        if (index + 1) % 100 == 0 or index + 1 == total:
            stream.extend(('progress Imported ' + str(index + 1) + '/' + str(total) + ' commits\\n').encode())
    if completed < total:
        stream.extend(b'done\\n')
        subprocess.run(['git', 'fast-import', '--quiet'], cwd=target, input=stream, check=True, timeout=300)
    # fast-import updates history; materialize only the three generated files.
    run('git', 'restore', '--source=HEAD', '--staged', '--worktree', '--', 'README.md', 'artwork.json', 'painting.txt', cwd=target)
    actual = int(capture(target, 'rev-list', '--count', 'HEAD'))
    if actual != total:
        sys.exit('Commit count verification failed; repository kept for inspection.')
    print('Created ' + str(total) + ' dated commits in ' + str(target))
    if args.publish:
        run('gh', 'repo', 'create', CONFIG['repo'], '--private' if args.private else '--public',
            '--source', str(target), '--remote', 'origin', '--push')
        print('Published. GitHub may take up to 24 hours to update your graph.')
    else:
        print('To publish later, run inside the new folder:')
        print('  gh repo create ' + CONFIG['repo'] + ' --public --source . --remote origin --push')

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit('Interrupted. Run this script again with --resume to continue without duplicating commits.')
    except subprocess.TimeoutExpired:
        sys.exit('Git exceeded the 5-minute import limit. Repository kept; retry with --resume. A repository outside OneDrive may avoid sync-related delays.')
    except (subprocess.CalledProcessError, OSError, ValueError) as error:
        sys.exit('Stopped: ' + str(error) + '\\nAny created local repository has been kept for inspection. If publication failed, retry gh repo create or git push from that folder.')
`;
}
$('export-form').onsubmit = event => { event.preventDefault(); const plan = entries().map(([date,v]) => [date,counts[v]]); if (!plan.length) { $('status').textContent = 'Paint at least one past date before exporting.'; return; } const repo = $('repo').value.trim(), email = $('email').value.trim(); if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repo) || !email || /[\r\n]/.test(email)) { $('status').textContent = 'Enter a valid repository name and email.'; return; } const blob = new Blob([generateScript(repo,email,plan)], { type:'text/x-python;charset=utf-8' }); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'contribution-art.py'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('status').textContent = 'Downloaded! Run: python contribution-art.py (add --publish to upload).'; };
render();
