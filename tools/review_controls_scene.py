"""Hand-authored, deterministic evaluator probes; not AI output or artwork."""
from manim import *
import textwrap

BLUE_C, ORANGE_C, PURPLE_C, GREEN_C = "#60A5FA", "#FDBA74", "#A78BFA", "#86EFAC"
ORDER = [0, 1, 2, 3, 4, 5]
PERMUTED = [5, 2, 4, 0, 3, 1]
CAPTIONS = [
    "Start with the input vector v = (1,2).",
    "The basis vectors build the input.",
    "The matrix columns are the basis images.",
    "Combine one blue column and two orange columns.",
    "The resulting endpoint gives Av = (4,2).",
    "Check the column sum against the result.",
]


class ProbeScene(Scene):
    kind = "reference"

    def point(self, x, y):
        return np.array([0.1+1.05*x, -2.5+1.05*y, 0])

    def arrow(self, start, end, color):
        return Arrow(self.point(*start), self.point(*end), buff=0,
                     stroke_width=5, color=color,
                     max_tip_length_to_length_ratio=0.16)

    def label(self, text, location, color=WHITE, size=20):
        return Text(text, font="DejaVu Sans", font_size=size, color=color).move_to(location)

    def construct(self):
        self.camera.background_color = "#10151f"
        title = self.label("Build Av: input -> basis images -> combine -> result", [0, 3.45, 0], size=24)
        self.add(title)
        for stage in (PERMUTED if self.kind == "shuffled" else ORDER):
            page = VGroup()
            caption = self.label(textwrap.fill(CAPTIONS[stage], 32), [-4.4, 2.1, 0], size=23)
            matrix = self.label("A = [ 2  1 ]\n      [ 0  1 ]", [-4.4, 0.65, 0], size=26)
            values = self.label("v = (1,2)\nAv = (4,2)", [-4.4, -0.7, 0], size=25)
            recipe = self.label("1(2,0) + 2(1,1) = (4,2)", [-4.4, -2, 0], size=19)
            page.add(caption, matrix, values, recipe)
            if self.kind != "text_only":
                for x in range(6):
                    page.add(Line(self.point(x, 0), self.point(x, 3), color=GRAY, stroke_opacity=.3))
                    page.add(self.label(str(x), self.point(x, 0)+DOWN*.28, size=18))
                for y in range(4):
                    page.add(Line(self.point(0, y), self.point(5, y), color=GRAY, stroke_opacity=.3))
                    if y:
                        page.add(self.label(str(y), self.point(0, y)+LEFT*.3, size=18))
                page.add(Dot(self.point(0, 0), radius=.05))
                if stage == 0:
                    page.add(self.arrow((0, 0), (1, 2), PURPLE_C))
                    page.add(self.label("v = (1,2)", self.point(1, 2)+UP*.3, PURPLE_C))
                if stage == 1:
                    page.add(self.arrow((0, 0), (1, 0), BLUE_C), self.arrow((0, 0), (0, 1), ORANGE_C))
                    page.add(self.label("e1 = (1,0)", self.point(1, 0)+UP*.35, BLUE_C, 18))
                    page.add(self.label("e2 = (0,1)", self.point(0, 1)+RIGHT*.85, ORANGE_C, 18))
                if stage == 2:
                    page.add(self.arrow((0, 0), (2, 0), BLUE_C), self.arrow((0, 0), (1, 1), ORANGE_C))
                    page.add(self.label("T(e1) = (2,0)", self.point(2, 0)+UP*.35, BLUE_C, 18))
                    page.add(self.label("T(e2) = (1,1)", self.point(1, 1)+UP*.35, ORANGE_C, 18))
                if stage in (3, 5):
                    page.add(self.arrow((0, 0), (2, 0), BLUE_C),
                             self.arrow((2, 0), (3, 1), ORANGE_C),
                             self.arrow((3, 1), (4, 2), ORANGE_C))
                    page.add(self.label("one blue + two orange", self.point(2.5, 3), size=18))
                if stage in (4, 5):
                    endpoint = (3, 2) if self.kind == "wrong_endpoint" else (4, 2)
                    page.add(self.arrow((0, 0), endpoint, GREEN_C), Dot(self.point(*endpoint), color=GREEN_C))
                    # Intentionally keep the true written result on the wrong geometric endpoint.
                    page.add(self.label("Av = (4,2)", self.point(*endpoint)+UP*.35, GREEN_C, 20))
            self.add(page)
            self.wait(2)
            self.remove(page)


class ProbeK7(ProbeScene):
    kind = "reference"


class ProbeM2(ProbeScene):
    kind = "text_only"


class ProbeP9(ProbeScene):
    kind = "wrong_endpoint"


class ProbeR4(ProbeScene):
    kind = "shuffled"
