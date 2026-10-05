"""Exploratory independent oracle against actual generated geometry helpers.

Run with the recorded Manimator environment. This is a post-generation probe,
not a preregistered quality score, pixel check, or new render.
"""
import ast
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from manim import ValueTracker, BLUE_D

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'work/full-reproduction-v1/manimator-port-v1/candidate-01/extracted.py'
EXPECTED_SHA = 'd986f7cc37d3216cb20407b9b3a92ead580b3259fdfab00c6d31ff68fdee7d77'


def signed_area(points):
    # Independent edge sum; do not call the author's signed_area or UNIT.
    return sum(points[i][0] * points[(i + 1) % 4][1]
               - points[(i + 1) % 4][0] * points[i][1]
               for i in range(4)) / 2


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_SHA
    target = OUT / 'geometry-checks-v1.json'
    if target.exists():
        raise ValueError('Frozen result exists; use a new version')
    spec = importlib.util.spec_from_file_location('candidate', SOURCE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    scene = module.MainScene()
    tree = ast.parse(SOURCE.read_text())
    example = next(node for node in ast.walk(tree)
                   if isinstance(node, ast.FunctionDef) and node.name == 'show_example')
    plane_assignment = next(node for node in example.body
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == 'self.plane')
    plane_shift = next(node for node in example.body
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
        and ast.unparse(node.value.func) == 'self.plane.shift')
    current = next(node for node in example.body
        if isinstance(node, ast.FunctionDef) and node.name == 'current_vertices')
    env = dict(vars(module), self=scene)
    for node in (plane_assignment, plane_shift):
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SOURCE), 'exec'), env)
    unit = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=float)
    origin = np.array([-1., -2., 0.])
    # Independent scale from the production plane's declared range and lengths.
    scale = 1.25
    rows = []
    for name, matrix in [('A', np.array([[2., 1.], [0., 1.]])),
                         ('B', np.array([[-1., 0.], [0., 1.]]))]:
        progress = ValueTracker(0)
        env.update(progress=progress, matrix=matrix)
        exec(compile(ast.Module(body=[current], type_ignores=[]), str(SOURCE), 'exec'), env)
        maximum_corner_error = maximum_arrow_error = maximum_area_error = 0.
        colors_ok = True
        for i in range(101):
            t = i / 100
            progress.set_value(t)
            actual = env['current_vertices']()
            # Explicit scalar formulas rather than reusing the author's matrix product.
            if name == 'A':
                expected = np.array([[0, 0], [1+t, 0], [1+2*t, 1], [t, 1]])
                expected_area = 1+t
            else:
                expected = np.array([[0, 0], [1-2*t, 0], [1-2*t, 1], [0, 1]])
                expected_area = 1-2*t
            physical = np.column_stack((expected * scale, np.zeros(4))) + origin
            geometry = scene.make_geometry(actual, BLUE_D)
            polygon, arrows, dots = geometry
            maximum_corner_error = max(maximum_corner_error,
                float(np.max(np.abs(polygon.get_vertices() - physical))),
                float(np.max(np.abs(np.array([dot.get_center() for dot in dots]) - physical))))
            maximum_area_error = max(maximum_area_error,
                abs(signed_area(polygon.get_vertices()) / scale**2 - expected_area))
            arrow_indices = [j for j in (1, 3) if np.linalg.norm(physical[j] - origin) > 1e-6]
            assert len(arrows) == len(arrow_indices)
            for arrow, j in zip(arrows, arrow_indices):
                maximum_arrow_error = max(maximum_arrow_error,
                    float(np.max(np.abs(arrow.get_start() - origin))),
                    float(np.max(np.abs(arrow.get_end() - physical[j]))))
                colors_ok &= arrow.get_color() == module.MainScene.COLORS[j]
            colors_ok &= all(dot.get_color() == module.MainScene.COLORS[j]
                             for j, dot in enumerate(dots))
        rows.append(dict(matrix=name, sampled_progress_values=101,
            maximum_corner_error=maximum_corner_error,
            maximum_arrow_error=maximum_arrow_error,
            maximum_signed_area_error=maximum_area_error,
            corner_and_basis_colors_stable=bool(colors_ok),
            collapsed_reflection_at_halfway_checked=name == 'B'))
    passed = all(max(r['maximum_corner_error'], r['maximum_arrow_error'],
                     r['maximum_signed_area_error']) < 1e-9
                 and r['corner_and_basis_colors_stable'] for r in rows)
    result = dict(source_sha256=EXPECTED_SHA, production_helpers_executed=True,
        oracle='explicit scalar corners; independent edge-sum area; production plane scale 1.25',
        exploratory_after_generation=True, checks=rows, passed=passed,
        limits='202 sampled progress values, two fixed matrices. No pixel, label, motion trace, general matrix or artistic quality proof.')
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    assert passed


if __name__ == '__main__':
    main()
