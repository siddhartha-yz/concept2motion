"""Original Codex-authored fixture, not generated through an upstream model API.

Runtime and mechanism smoke test only; not a finished artwork.
"""
from manim import *
import math


class SharedDenominator(Scene):
    def construct(self):
        self.camera.background_color = "#080E19"
        colors = ["#64DCCA", "#8BA4FF", "#FFBA82"]
        logits = [-1.0, 0.6, 1.8]
        masses = [math.exp(x) for x in logits]
        total = sum(masses)
        probabilities = [x / total for x in masses]
        axis = Line(LEFT * 5, RIGHT * 5, color="#42516B").shift(DOWN * 0.2)
        bars = VGroup()
        for i, (value, color) in enumerate(zip(logits, colors)):
            height = abs(value) * 1.0
            bar = Rectangle(width=0.9, height=height, fill_color=color, fill_opacity=0.9,
                            stroke_width=0)
            bar.move_to([-3 + 3 * i, -0.2 + value / 2, 0])
            bars.add(bar)
        self.play(Create(axis), LaggedStart(*[FadeIn(b) for b in bars], lag_ratio=0.15),
                  run_time=2)
        self.wait(0.5)
        positive = VGroup()
        for i, (mass, color) in enumerate(zip(masses, colors)):
            height = mass * 0.42
            positive.add(Rectangle(width=0.9, height=height, fill_color=color,
                                  fill_opacity=0.9, stroke_width=0)
                         .move_to([-3 + 3 * i, -0.2 + height / 2, 0]))
        self.play(Transform(bars, positive), run_time=2)
        self.wait(0.5)
        # Move every exponential into the same total stack; no class is dropped.
        stack = VGroup()
        bottom = -1.5
        for mass, color in zip(masses, colors):
            height = mass * 0.42
            stack.add(Rectangle(width=1.25, height=height, fill_color=color,
                                fill_opacity=0.9, stroke_width=0)
                      .move_to([-2.5, bottom + height / 2, 0]))
            bottom += height
        self.play(Transform(bars, stack), FadeOut(axis), run_time=2)
        self.wait(0.5)
        # One horizontal capacity; lengths are exactly 8*p_i and their sum is 8.
        capacity = Rectangle(width=8, height=0.9, stroke_color="#E7EDF7", stroke_width=2)
        parts = VGroup()
        left = -4
        for probability, color in zip(probabilities, colors):
            width = 8 * probability
            parts.add(Rectangle(width=width, height=0.9, fill_color=color,
                                fill_opacity=0.9, stroke_width=0)
                      .move_to([left + width / 2, 0, 0]))
            left += width
        self.play(Transform(bars, parts), Create(capacity), run_time=2)
        self.wait(2)
