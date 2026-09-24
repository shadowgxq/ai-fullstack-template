"""Distribution consistency and historical-archive guard regressions."""
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import tomllib
import unittest

ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/'manager-execute-current-batch/scripts'
sys.path.insert(0,str(SCRIPTS))
import plan_tool

class PackagingTests(unittest.TestCase):
    def test_runtime_dependencies_and_documented_gate_files_exist(self):
        for name in ('plan_tool','plan_inputs','manager_schema','manager_store','manager_flow','manager_tasks','manager_gate','manager_archive','manager_roles'):
            self.assertTrue((SCRIPTS/(name+'.py')).is_file(),name)
        for name in ('MANAGER-V2-MIGRATION.md','manager-execute-current-batch/references/evidence-contract.md','manager-execute-current-batch/references/verify-auto-repair.md','scripts/archive_guard.py'):
            self.assertTrue((ROOT/name).is_file(),name)
    def test_each_advertised_command_has_real_help(self):
        for name in plan_tool.COMMANDS:
            proc=subprocess.run([sys.executable,str(SCRIPTS/'plan_tool.py'),name,'--help'],capture_output=True,text=True)
            self.assertEqual(proc.returncode,0,name+proc.stderr)
    def test_live_cli_job_is_not_optional_in_ci(self):
        workflow=(ROOT/'.github/workflows/manager-runtime.yml').read_text()
        self.assertIn("MANAGER_LIVE_OPENSPEC: '1'",workflow)
        self.assertIn('@fission-ai/openspec@1.13.1',workflow)
        self.assertNotIn('continue-on-error',workflow)

    def test_project_template_uses_native_two_tier_codex_models(self):
        codex=ROOT/'templates/project/.codex'
        config=tomllib.loads((codex/'config.toml').read_text())
        self.assertEqual(config['model'],'gpt-6-sol')
        self.assertEqual(config['model_reasoning_effort'],'xhigh')
        agents=config['agents']
        self.assertEqual(agents['default_subagent_model'],'gpt-6-sol')
        self.assertEqual(agents['default_subagent_reasoning_effort'],'xhigh')
        primary={'architect','backend-dev','frontend-dev','product-manager','reviewer'}
        light={'explorer','qa','test-worker','ui-ux-reviewer'}
        self.assertFalse({k for k,v in agents.items() if isinstance(v,dict)}, 'standalone roles do not need duplicate registrations')
        for role in sorted(primary|light):
            role_config=tomllib.loads((codex/'agents'/f'{role}.toml').read_text())
            self.assertEqual(role_config.get('name'),role)
            if role in primary:
                self.assertNotIn('model',role_config,role)
                self.assertNotIn('model_reasoning_effort',role_config,role)
            else:
                self.assertEqual(role_config.get('model'),'gpt-6-luna',role)
                self.assertEqual(role_config.get('model_reasoning_effort'),'max',role)
        combined='\n'.join(p.read_text() for p in [codex/'config.toml',*sorted((codex/'agents').glob('*.toml'))])
        self.assertNotIn('gpt-5.6-',combined)
        self.assertNotIn('terra',combined.lower())

class ArchiveGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)
        self.git('init','-q');self.git('config','user.name','Test Fixture');self.git('config','user.email','test@example.invalid')
        self.write('openspec/changes/archive/2020-01-01-old/spec.md','original\n');self.git('add','.');self.git('commit','-qm','fixture base')
        self.base=self.git('rev-parse','HEAD').strip()
    def tearDown(self):self.temp.cleanup()
    def git(self,*args):return subprocess.check_output(['git',*args],cwd=self.root,text=True,stderr=subprocess.STDOUT)
    def write(self,path,text):
        p=self.root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    def result(self):
        self.git('add','-A');self.git('commit','-qm','fixture candidate')
        proc=subprocess.run([sys.executable,str(ROOT/'scripts/archive_guard.py'),'--base',self.base],cwd=self.root,capture_output=True,text=True)
        return proc,json.loads(proc.stdout)
    def test_new_unit_allowed(self):
        self.write('openspec/changes/archive/2026-09-22-new/spec.md','new\n');p,result=self.result();self.assertEqual(p.returncode,0);self.assertTrue(result['ok'])
    def test_edited_old_unit_rejected(self):
        self.write('openspec/changes/archive/2020-01-01-old/spec.md','edited\n');p,result=self.result();self.assertEqual(p.returncode,1);self.assertTrue(result['changed_history'])
    def test_new_file_in_old_unit_rejected(self):
        self.write('openspec/changes/archive/2020-01-01-old/notes.md','addition\n');p,result=self.result();self.assertEqual(p.returncode,1)
    def test_deleted_old_unit_rejected(self):
        (self.root/'openspec/changes/archive/2020-01-01-old/spec.md').unlink();p,result=self.result();self.assertEqual(p.returncode,1)


class DependentParallelTests(unittest.TestCase):
    def test_completed_dependency_does_not_serialize_child_task_claims(self):
        from test_manager_runtime import Project, task
        import manager_tasks
        with tempfile.TemporaryDirectory() as td:
            project=Project(td)
            try:
                project.add('child',['example'],batch='m2')
                project.write('openspec/changes/child/execution.yaml', 'tasks:\n  - id: A\n    role: backend-dev\n    writes: [src/a]\n    acceptance: [A works]\n  - id: B\n    role: backend-dev\n    writes: [src/b]\n    acceptance: [B works]\n')
                project.write('openspec/changes/child/tasks.md', '## Implementation\n- [ ] A Implement A\n- [ ] B Implement B\n')
                project.archive_ready()
                project.apply_started('child')
                a=project.cli('task-claim','--change','child','--task','A','--agent-id','test-a')
                b=project.cli('task-claim','--change','child','--task','B','--agent-id','test-b')
                self.assertEqual(a.returncode,0,a.stderr)
                self.assertEqual(b.returncode,0,b.stderr)
                self.assertEqual(len(project.store().running()),2)
            finally:
                project.close()

if __name__=='__main__':unittest.main()