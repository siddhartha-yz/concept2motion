import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'tools'))
import model_infra_pilot as engine
import model_infra_pilot_v2 as experiment
from batch import digest, save


class ExperimentIntegrity(unittest.TestCase):
    def test_resume_rejects_changed_images_and_model_even_with_same_prompt(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)/'call'
            image = Path(temporary)/'frame.png'
            image.write_bytes(b'original image')
            prompt = 'unchanged prompt'
            save(directory/'safe.json', {'model':'weak', 'status':'completed',
                 'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(), 'image_sha256':[digest(image)]})
            self.assertEqual(engine.invoke(directory,prompt,{},'weak',[image])['status'],'completed')
            with self.assertRaisesRegex(ValueError,'model or attached'):
                engine.invoke(directory,prompt,{},'strong',[image])
            image.write_bytes(b'changed image')
            with self.assertRaisesRegex(ValueError,'model or attached'):
                engine.invoke(directory,prompt,{},'weak',[image])

    def test_failed_batch_retains_success_and_failure_and_stops(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(experiment,'REPORT',Path(temporary)):
            retained=[]
            jobs=[(lambda:{'status':'rendered'},()),(lambda:{'status':'generation_unknown'},())]
            with self.assertRaisesRegex(RuntimeError,'no later calls'):
                experiment.run_batch(jobs,retained.append,'initial_generation')
            self.assertEqual(len(retained),2)
            self.assertEqual(json.loads((Path(temporary)/'progress.json').read_text())['status'],'stopped')


if __name__ == '__main__':unittest.main()
