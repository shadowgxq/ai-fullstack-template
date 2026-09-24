"""Read project role configuration; never spawn agents or claim observed models."""
from __future__ import annotations

from pathlib import PurePosixPath
import re
import tomllib

from manager_schema import Invalid, parse, require

ROLE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]*$')


def native_config(store):
    path = store.file('.codex/config.toml')
    try:
        config = tomllib.loads(path.read_text()) if path.exists() else {}
    except (OSError, ValueError) as exc:
        raise Invalid(f'invalid .codex/config.toml: {exc}') from exc
    require(isinstance(config.get('agents', {}), dict), 'Codex agents must be a table')
    agents = config.get('agents', {})
    require(agents.get('enabled', True) is True, 'Codex subagents disabled; explicit serial workflow required')
    for key in ('max_concurrent_threads_per_session', 'max_threads'):
        if key in agents:
            require(type(agents[key]) is int and agents[key] > 0, f'invalid agents.{key}')
    return config


def route_roles(store):
    path = store.file('manager/roles.yaml')
    require(path.is_file(), 'missing manager/roles.yaml; initialize project configuration')
    data = parse(path.read_text())
    require(isinstance(data, dict) and isinstance(data.get('routes'), dict), 'roles.routes must be a mapping')
    require(type(data.get('version', 2)) is int and data.get('version', 2) == 2, 'roles version must be 2')
    routes = data['routes']
    require({'change', 'apply', 'verify'} <= set(routes), 'roles.routes requires change, apply and verify routes')
    found = set()

    def visit(node, label):
        if isinstance(node, list):
            require(bool(node), f'{label}: nonempty role route required')
            for index, item in enumerate(node): visit(item, f'{label}[{index}]')
            return
        require(isinstance(node, dict) and node, f'{label}: nonempty role route required')
        if 'agent_type' in node:
            for field in ('agent_type', 'fallback'):
                if field in node:
                    name = node[field]
                    require(isinstance(name, str) and ROLE_ID.fullmatch(name), f'{label}: invalid {field}')
                    found.add(name)
            return
        require('fallback' not in node, f'{label}: fallback requires an explicit agent_type')
        for key, value in node.items():
            require(isinstance(key, str) and bool(key.strip()), f'{label}: invalid route key')
            visit(value, f'{label}.{key}')

    for key, value in routes.items():
        visit(value, f'roles.routes.{key}')
    return sorted(found)


def role_definition(store, name):
    require(isinstance(name, str) and ROLE_ID.fullmatch(name), 'invalid native role name')
    config = native_config(store)
    declaration = config.get('agents', {}).get(name)
    relative = f'.codex/agents/{name}.toml'
    if declaration is not None:
        require(isinstance(declaration, dict), f'invalid native role declaration: {name}')
        if 'config_file' in declaration:
            value = declaration['config_file']
            require(isinstance(value, str) and value.strip(), f'{name}: invalid config_file')
            file = PurePosixPath(value)
            require(not file.is_absolute() and '..' not in file.parts, f'{name}: config_file must stay inside project .codex')
            relative = '.codex/' + value
    path = store.file(relative)
    require(path.is_file(), f'missing native role config: {name} ({relative})')
    try:
        definition = tomllib.loads(path.read_text())
    except (OSError, ValueError) as exc:
        raise Invalid(f'invalid native role config: {name}: {exc}') from exc
    require(definition.get('name') == name, f'invalid native role config: {name}: name mismatch')
    for key in ('description', 'developer_instructions'):
        require(isinstance(definition.get(key), str) and definition[key].strip(), f'{name}: {key} required')
    if declaration and declaration.get('description'):
        require(declaration['description'] == definition['description'], f'{name}: registered/standalone description drift')
    profile = definition.get('default_permissions', config.get('default_permissions'))
    if profile is not None:
        require(isinstance(config.get('permissions', {}), dict) and isinstance(definition.get('permissions', {}), dict), f'{name}: permissions must be a table')
        profiles = dict(config.get('permissions', {}), **definition.get('permissions', {}))
        builtins = {':read-only', ':workspace', ':danger-full-access'}
        require(isinstance(profile, str) and (profile in profiles or profile in builtins), f'{name}: permission profile missing in project config: {profile}')
        seen = set(); current = profile
        while current not in builtins:
            require(current not in seen and current in profiles and isinstance(profiles[current], dict), f'{name}: invalid/cyclic permission profile')
            seen.add(current); current = profiles[current].get('extends')
            if current is None: break
            require(isinstance(current, str) and current != ':danger-full-access', f'{name}: invalid permission parent')
    # Permission profile mode and legacy sandbox mode must not coexist.
    if profile is not None:
        require(not any(k in config or k in definition for k in ('sandbox_mode', 'sandbox_workspace_write')), f'{name}: do not mix permissions profiles and legacy sandbox settings')
    return definition


def describe_role(store, name):
    definition = role_definition(store, name)
    config = native_config(store)
    agents = config.get('agents', {})
    model = definition.get('model', agents.get('default_subagent_model', config.get('model')))
    source = 'role' if 'model' in definition else ('project-subagent-default' if 'default_subagent_model' in agents else 'project-parent' if 'model' in config else 'runtime-inherited')
    effort = definition.get('model_reasoning_effort', agents.get('default_subagent_reasoning_effort'))
    if effort is None and 'default_subagent_model' not in agents:
        effort = config.get('model_reasoning_effort')
    for key, value in (('model', model), ('model_reasoning_effort', effort)):
        require(value is None or isinstance(value, str) and value.strip(), f'{name}: invalid {key}')
    return {'role': name, 'configured_model': model, 'configured_reasoning_effort': effort,
            'model_source': source, 'default_permissions': definition.get('default_permissions', config.get('default_permissions')),
            'observed_model': None, 'native_execution': 'unverified'}


def check_roles(store, additional=()):
    """Validate routes plus all actual task consumers, including unrouted custom roles."""
    names = sorted(set(route_roles(store)) | set(additional))
    return [describe_role(store, name) for name in names]
