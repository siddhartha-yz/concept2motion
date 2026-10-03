import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import model_infra_pilot as p
import model_infra_pilot_v3 as v3
from batch import digest


def verdict():
    return {'videos':[{'id':ident,'checks':[{'criterion':i,'status':'uncertain','time_s':1,'evidence':'Only sampled evidence is visible'} for i in range(4)],'reconstructed_message':'Unknown','limits':'Static frames'} for ident in ('X','Z')],
            'comparisons':[{'left':'X','right':'Z','winner':'uncertain','reason':'Insufficient geometry'}],'uncertainty':'No motion evaluated'}


class FairRevealPilot(unittest.TestCase):
    def test_pair_judge_requires_both_candidates_four_checks_and_supplied_time(self):
        v3.validate_pair(verdict(),['X','Z'])
        for mutation in ('duplicate_id','missing_check','invented_time','invalid_winner'):
            v=verdict()
            if mutation=='duplicate_id':v['videos'][1]['id']='X'
            if mutation=='missing_check':v['videos'][0]['checks'].pop()
            if mutation=='invented_time':v['videos'][0]['checks'][0]['time_s']=16
            if mutation=='invalid_winner':v['comparisons'][0]['winner']='A'
            with self.assertRaises(ValueError):v3.validate_pair(v,['X','Z'])

    def test_prior_support_files_omitted_but_authored_source_and_images_unchanged(self):
        source={'scene.js':'author','index.html':'html','storyboard.md':'story','math-frame.mjs':'immutable adapter','math-timeline.mjs':'immutable timing'}
        images=[Path('/tmp/evidence.png')];manifest={'errors':[],'checks':{'findings':[{'code':'wrong_merge'}]}}
        with patch.object(p,'SUPPORT_FILES',{'math-frame.mjs':None,'math-timeline.mjs':None}),patch.object(p,'prior_material',return_value=(source,images,manifest)):
            a,actual_images,actual_manifest=v3.prior_material({})
        self.assertEqual(a,{'scene.js':'author','index.html':'html','storyboard.md':'story'})
        self.assertIs(actual_images,images);self.assertIs(actual_manifest,manifest)
        self.assertNotIn('deterministic_findings',p.feedback(manifest,False))
        self.assertEqual(p.feedback(manifest,True)['deterministic_findings'][0]['code'],'wrong_merge')

    def test_tampered_prior_cannot_be_used_as_shared_initial(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'scene.js').write_text('original')
            record={'source':'.','source_sha256':{'scene.js':digest(root/'scene.js')}}
            (root/'scene.js').write_text('hand changed')
            with patch.object(p,'ROOT',root),patch.object(p,'prior_material') as material:
                with self.assertRaisesRegex(ValueError,'source changed'):v3.prior_material(record)
                material.assert_not_called()


if __name__=='__main__':unittest.main()
