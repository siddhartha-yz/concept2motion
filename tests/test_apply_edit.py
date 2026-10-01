import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('apply_edit', Path(__file__).resolve().parents[1]/'tools/apply_edit.py')
edit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit)


class EditTests(unittest.TestCase):
    def test_stale_or_ambiguous_edit_leaves_both_versions_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);scene = root/'scene';scene.mkdir()
            source = scene/'scene.js';source.write_text('label label')
            for change in ({'sha256': 'stale', 'edits': [{'old': 'label', 'new': 'new'}]},
                           {'sha256': edit.digest(source.read_bytes()), 'edits': [{'old': 'label', 'new': 'new'}]}):
                with self.assertRaises(ValueError):
                    edit.apply(scene, {'files': [{'path': 'scene.js', **change}]}, root/'new')
                self.assertFalse((root/'new').exists())
                self.assertEqual(source.read_text(), 'label label')

    def test_all_edits_validate_before_publishing_and_assets_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);scene = root/'scene';scene.mkdir()
            (scene/'scene.js').write_text('one two');(scene/'icon.svg').write_text('<svg/>')
            change = {'path': 'scene.js', 'sha256': edit.digest((scene/'scene.js').read_bytes()),
                      'edits': [{'old': 'one', 'new': 'three'}, {'old': 'missing', 'new': 'four'}]}
            with self.assertRaises(ValueError):
                edit.apply(scene, {'files': [change]}, root/'new')
            self.assertFalse((root/'new').exists())
            change['edits'].pop()
            record = edit.apply(scene, {'files': [change]}, root/'new')
            self.assertEqual((scene/'scene.js').read_text(), 'one two')
            self.assertEqual((root/'new/scene.js').read_text(), 'three two')
            self.assertEqual((root/'new/icon.svg').read_bytes(), (scene/'icon.svg').read_bytes())
            self.assertIn('scene.js', record['changed_hashes'])
            with self.assertRaises(ValueError):
                edit.apply(scene, {'files': [change]}, root/'new')
