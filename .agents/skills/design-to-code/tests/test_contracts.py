"""Static documentation and source contracts, not LLM or live-page acceptance."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
ENTRIES = ('design-to-code', 'design-qa', 'pencil-design', 'ui-ux-delivery')


def anchor_names(document):
    # GitHub-style anchors for the simple headings used by these maintained docs.
    counts, names = {}, set()
    for heading in re.findall(r'^#{1,6} (.+)$', document, re.M):
        base = re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-')
        occurrence = counts.get(base, 0)
        names.add(base if not occurrence else f'{base}-{occurrence}')
        counts[base] = occurrence + 1
    return names


class Contracts(unittest.TestCase):
    def test_local_document_links_and_fragments_resolve(self):
        files = [ROOT/'DESIGN-WORKFLOW.md', ROOT/'MANAGER-WORKFLOW.md', ROOT/'SKILLS-OVERVIEW.md']
        for folder in (*ENTRIES, *(p.name for p in ROOT.glob('manager-*')), 'tests/acceptance'):
            files.extend((ROOT/folder).rglob('*.md'))
        for file in files:
            for link in re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
                if '://' in link or link.startswith('mailto:'): continue
                relative, _, fragment = link.partition('#')
                target = (file.parent/relative).resolve() if relative else file
                with self.subTest(file=str(file), link=link):
                    self.assertTrue(target.is_file(), str(target))
                    if fragment and target.suffix == '.md':
                        self.assertIn(fragment, anchor_names(target.read_text(encoding='utf-8')))

    def test_focused_entries_have_unique_names_and_small_instructions(self):
        for skill in ENTRIES:
            content = (ROOT/skill/'SKILL.md').read_text(encoding='utf-8')
            self.assertEqual(re.findall(r'^name: (.+)$', content, re.M), [skill])
            self.assertLess(len(content.splitlines()), 90)

    def test_only_current_entrypoints_are_distributed(self):
        for removed in ('legacy', 'FIGMA-WORKFLOW.md', 'figma-to-code', 'figma-mcp-cache',
                        'figma-project-components', 'figma-visual-qa',
                        'ui-ux-delivery/references/migration.md',
                        'ui-ux-delivery/references/review-acceptance.md'):
            self.assertFalse((ROOT/removed).exists(), removed)
        self.assertEqual({p.name for p in (ROOT/'ui-ux-delivery/references').iterdir()},
                         {'manager-integration.md'})
        # Remove aliases, not actual Figma support or platform adapters.
        for source in ('figma', 'pencil'):
            self.assertTrue((ROOT/f'design-to-code/references/sources/{source}.md').is_file())
        for target in ('react-web', 'vue-web', 'react-native'):
            self.assertTrue((ROOT/f'design-to-code/references/targets/{target}.md').is_file())

    def test_native_not_dom_and_measurement_not_visual_pass(self):
        native = (ROOT/'design-to-code/references/targets/react-native.md').read_text(encoding='utf-8')
        for phrase in ('WebView', 'DOM', 'not_run', '平台'):
            self.assertIn(phrase, native)
        rules = (ROOT/'design-qa/references/comparison.md').read_text(encoding='utf-8')
        self.assertIn('未测量不是豁免', rules)
        self.assertIn('不是自动视觉结论', rules)

    def test_no_source_tool_auto_execution(self):
        source = (ROOT/'design-to-code/references/sources/pencil.md').read_text(encoding='utf-8')
        self.assertIn('只读', source); self.assertIn('不自动切换', source)
        self.assertIn('live_mcp=not_run', source)

    def test_capture_and_measurement_share_engine_but_keep_distinct_behavior(self):
        for script, argument in (('capture.mjs', 'false'), ('inspect.mjs', 'true')):
            content = (ROOT/'design-qa/scripts'/script).read_text(encoding='utf-8')
            self.assertIn("from './web.mjs'", content)
            self.assertIn(f'cli({argument})', content)
            self.assertLess(len(content.splitlines()), 8)


if __name__ == '__main__': unittest.main()
