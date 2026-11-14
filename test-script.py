"""Integration tests for the actual downloaded script. Never contacts GitHub."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path('.test-output/contribution-art.py').resolve()
PLAN = [['2024-02-29', 5]]


class ScriptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='painter-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'test-art'

    def run_script(self, *args, success=True):
        result = subprocess.run([sys.executable, str(SCRIPT), '--name', 'Painter Test', *args],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.repo, check=True,
                              capture_output=True, text=True).stdout.strip()

    def verify(self):
        self.assertEqual(self.git('rev-list', '--count', 'HEAD'), '5')
        records = self.git('log', '--reverse', '--format=%s|%ae|%aI|%cI').splitlines()
        for index, record in enumerate(records):
            stamp = f'2024-02-29T12:00:0{index}+00:00'
            self.assertEqual(record.replace('Z', '+00:00'), f'Paint 2024-02-29 ({index + 1})|test@example.com|{stamp}|{stamp}')
        self.assertEqual(self.git('status', '--porcelain'), '')
        for commit in self.git('rev-list', 'HEAD').splitlines():
            self.assertIn('painting.txt', self.git('diff-tree', '--root', '--no-commit-id', '--name-only', '-r', commit))

    def test_fresh_and_completed_resume(self):
        result = self.run_script()
        self.assertIn('Imported 5/5', result.stdout)
        self.verify()
        original = self.git('rev-parse', 'HEAD')
        self.run_script('--resume')
        self.assertEqual(self.git('rev-parse', 'HEAD'), original)
        self.verify()
        self.run_script(success=False)

    def test_resume_old_script_with_pending_add(self):
        self.repo.mkdir()
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Painter Test')
        self.git('config', 'user.email', 'test@example.com')
        (self.repo / 'README.md').write_text('# Contribution art\n\nAn intentionally generated contribution-calendar artwork.\n')
        (self.repo / 'artwork.json').write_text(json.dumps(PLAN))
        import os
        for number in range(2):
            with (self.repo / 'painting.txt').open('a') as output:
                output.write(f'2024-02-29 / mark {number + 1}\n')
            self.git('add', '.')
            stamp = f'2024-02-29T12:00:0{number}+00:00'
            env = dict(os.environ, GIT_AUTHOR_DATE=stamp, GIT_COMMITTER_DATE=stamp,
                       GIT_AUTHOR_NAME='Painter Test', GIT_COMMITTER_NAME='Painter Test',
                       GIT_AUTHOR_EMAIL='test@example.com', GIT_COMMITTER_EMAIL='test@example.com')
            subprocess.run(['git', '-c', 'commit.gpgsign=false', 'commit', '-qm', f'Paint 2024-02-29 ({number + 1})'],
                           cwd=self.repo, env=env, check=True)
        first_two = self.git('rev-list', '--reverse', 'HEAD').splitlines()
        with (self.repo / 'painting.txt').open('a') as output:
            output.write('2024-02-29 / mark 3\n')
        self.git('add', 'painting.txt')
        result = self.run_script('--resume')
        self.assertIn('Starting at 2/5', result.stdout)
        self.assertEqual(self.git('rev-list', '--reverse', 'HEAD').splitlines()[:2], first_two)
        self.verify()

    def test_reject_changed_plan_and_unrelated_edits(self):
        self.run_script()
        original = self.git('rev-parse', 'HEAD')
        (self.repo / 'artwork.json').write_text('[]')
        self.run_script('--resume', success=False)
        (self.repo / 'artwork.json').write_text(json.dumps(PLAN))
        (self.repo / 'painting.txt').write_text('my own edits')
        self.run_script('--resume', success=False)
        self.assertEqual(self.git('rev-parse', 'HEAD'), original)
        self.assertEqual((self.repo / 'painting.txt').read_text(), 'my own edits')

    def test_full_year_maximum_intensity(self):
        import datetime
        import time
        plan = [[str(datetime.date(2024, 1, 1) + datetime.timedelta(days=day)), 20] for day in range(366)]
        config = dict(repo='test-art', email='test@example.com', plan=plan)
        lines = SCRIPT.read_text().splitlines()
        lines = ['CONFIG = json.loads(' + repr(json.dumps(config)) + ')' if line.startswith('CONFIG = ') else line for line in lines]
        large_script = self.root / 'large.py'
        large_script.write_text('\n'.join(lines), encoding='utf-8')
        started = time.monotonic()
        result = subprocess.run([sys.executable, str(large_script), '--name', 'Painter Test'],
                                cwd=self.root, capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git('rev-list', '--count', 'HEAD'), '7320')
        self.assertIn('Imported 7320/7320', result.stdout)
        self.assertEqual(self.git('status', '--porcelain'), '')
        dates = self.git('log', '--format=%as').splitlines()
        self.assertEqual(len(set(dates)), 366)
        self.assertTrue(all(dates.count(date) == 20 for date, _ in plan))
        print(f'Full year: 7,320 commits in {time.monotonic() - started:.2f}s')


if __name__ == '__main__':
    unittest.main()
