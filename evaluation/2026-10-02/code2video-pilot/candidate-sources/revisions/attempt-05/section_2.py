from manim import *
import numpy as np

config.frame_width = 24
config.frame_height = 9
config.pixel_width = 2400
config.pixel_height = 900
# The supplied output contains progress bars, not an exception traceback.
config.progress_bar = "none"

class TeachingScene(Scene):
    def setup_layout(self, title_text, lecture_lines):
        self.camera.background_color = "#000000"
        self.title = Text(title_text, font_size=28, color=WHITE).to_edge(UP)
        self.add(self.title)

        lecture_texts = [Text(line, font_size=22, color=WHITE) for line in lecture_lines]
        self.lecture = VGroup(*lecture_texts).arrange(DOWN, aligned_edge=LEFT).scale(0.8)
        self.lecture.to_edge(LEFT, buff=0.2)
        self.add(self.lecture)

        self.grid = {}
        rows = ["A", "B", "C", "D", "E", "F"]
        cols = ["1", "2", "3", "4", "5", "6"]

        for i, row in enumerate(rows):
            for j, col in enumerate(cols):
                x = 0.5 + j * 1
                y = 2.2 - i * 1
                self.grid[f"{row}{col}"] = np.array([x, y, 0])

    def place_at_grid(self, mobject, grid_pos, scale_factor=1.0):
        mobject.scale(scale_factor)
        mobject.move_to(self.grid[grid_pos])
        return mobject

    def place_in_area(self, mobject, top_left, bottom_right, scale_factor=1.0):
        tl_pos = self.grid[top_left]
        br_pos = self.grid[bottom_right]
        center_x = (tl_pos[0] + br_pos[0]) / 2
        center_y = (tl_pos[1] + br_pos[1]) / 2
        center = np.array([center_x, center_y, 0])
        mobject.scale(scale_factor)
        mobject.move_to(center)
        return mobject

class Section2Scene(TeachingScene):
    def construct(self):
        violet = "#A78BFA"
        blue = "#60A5FA"
        orange = "#FDBA74"
        green = "#86EFAC"
        white = "#F1F5F9"
        slate = "#94A3B8"
        yellow = "#FDE047"

        self.setup_layout(
            "Sec 2: Vectors and Their Building Blocks",
            [
                "Vectors record horizontal and vertical displacement.",
                "Basis vectors build every vector: v = xe₁ + ye₂.",
                "Addition joins arrows; scalar multiplication changes their scale.",
            ],
        )

        def arrow(start, end, color, width=4):
            return Arrow(
                self.grid[start], self.grid[end],
                buff=0, color=color, stroke_width=width,
                max_tip_length_to_length_ratio=0.16,
            ).set_z_index(3)

        def label(tex, anchor, color=white, size=25):
            obj = MathTex(tex, color=color, font_size=size)
            self.place_at_grid(obj, anchor)
            return obj.set_z_index(6)

        origin = self.grid["E2"]
        reference = VGroup(
            *[
                Line(self.grid[f"C{c}"], self.grid[f"F{c}"],
                     color=slate, stroke_width=1)
                for c in "123456"
            ],
            *[
                Line(self.grid[f"{r}1"], self.grid[f"{r}6"],
                     color=slate, stroke_width=1)
                for r in "CDEF"
            ],
        ).set_opacity(0.22).set_z_index(0)
        dot = Dot(radius=0.055, color=white).set_z_index(8)
        self.place_at_grid(dot, "E2")
        origin_label = label("O", "E1", size=24)
        vector = arrow("E2", "D4", violet)
        vector_label = label(r"v=(2,1)", "D5", violet, 24)

        horizontal = DashedLine(
            self.grid["E2"], self.grid["E4"],
            color=blue, stroke_width=3, dash_length=0.12,
        ).set_z_index(2)
        vertical = DashedLine(
            self.grid["E4"], self.grid["D4"],
            color=orange, stroke_width=3, dash_length=0.12,
        ).set_z_index(2)
        horizontal_label = label("2", "F3", blue)
        vertical_label = MathTex("1", color=orange, font_size=25)
        self.place_in_area(vertical_label, "D4", "E5")
        vertical_label.set_z_index(6)

        self.play(self.lecture[0].animate.set_color(violet), run_time=0.8)
        self.play(FadeIn(reference), FadeIn(dot), Write(origin_label), run_time=1.2)
        self.play(GrowArrow(vector), Write(vector_label), run_time=2.0)
        self.play(Create(horizontal), Write(horizontal_label), run_time=1.5)
        self.play(Create(vertical), Write(vertical_label), run_time=1.5)
        self.wait(5.0)

        e1 = arrow("E2", "E3", blue)
        e2 = arrow("E2", "D2", orange)
        e1_label = MathTex(r"e_1=(1,0)", color=blue, font_size=23)
        self.place_in_area(e1_label, "E2", "F3")
        e2_label = label(r"e_2=(0,1)", "D1", orange, 23)

        identity = MathTex(
            r"v=", r"2e_1", "+", r"e_2", r"=(2,1)",
            font_size=29, color=violet,
        )
        identity[1].set_color(blue)
        identity[3].set_color(orange)
        self.place_in_area(identity, "A1", "A6")
        general = MathTex(r"(x,y)=xe_1+ye_2", font_size=29, color=white)
        self.place_in_area(general, "B1", "B6")

        self.play(
            self.lecture[0].animate.set_color(white),
            self.lecture[1].animate.set_color(blue),
            FadeOut(horizontal), FadeOut(vertical),
            FadeOut(horizontal_label), FadeOut(vertical_label),
            run_time=1.0,
        )
        self.play(GrowArrow(e1), Write(e1_label), run_time=1.5)
        self.play(
            self.lecture[1].animate.set_color(orange),
            GrowArrow(e2), Write(e2_label), run_time=1.5,
        )

        step1 = e1.copy()
        step2 = e1.copy()
        step3 = e2.copy()
        self.play(FadeIn(step1), run_time=0.5)
        self.play(TransformFromCopy(e1, step2), run_time=0.5)
        self.play(Transform(step2, arrow("E3", "E4", blue)), run_time=1.5)
        self.play(TransformFromCopy(e2, step3), run_time=0.5)
        self.play(Transform(step3, arrow("E4", "D4", orange)), run_time=1.5)
        self.play(self.lecture[1].animate.set_color(blue), Write(identity), run_time=2.0)
        self.wait(2.0)
        self.play(self.lecture[1].animate.set_color(white), Write(general), run_time=1.5)
        self.wait(2.0)

        working = vector.copy().set_color(green).set_z_index(4)
        twice_label = label(r"2v=(4,2)", "B6", green, 24)
        half_label = label(r"\tfrac12v", "D3", green, 26)
        negative_label = label(r"-v", "F2", green, 26)

        self.play(
            self.lecture[2].animate.set_color(green),
            FadeOut(step1), FadeOut(step2), FadeOut(step3),
            FadeOut(identity), FadeOut(general),
            FadeOut(e1_label), FadeOut(e2_label),
            run_time=1.0,
        )
        self.play(FadeIn(working), run_time=0.5)
        self.play(
            Transform(working, arrow("E2", "C6", green)),
            Write(twice_label), run_time=1.5,
        )
        self.wait(1.0)
        self.play(
            Transform(working, vector.copy().set_color(green)),
            FadeOut(twice_label), run_time=1.0,
        )
        self.play(FadeOut(working), run_time=0.5)

        small = vector.copy().set_color(green).set_z_index(4)
        half_target = vector.copy().set_color(green).scale(0.5, about_point=origin)
        self.play(FadeIn(small), run_time=0.5)
        self.play(Transform(small, half_target), Write(half_label), run_time=1.0)
        self.wait(0.5)
        self.play(
            Transform(small, arrow("E2", "F1", green)),
            FadeOut(half_label), Write(negative_label), run_time=1.0,
        )
        self.wait(0.5)
        self.play(FadeOut(small), FadeOut(negative_label), run_time=0.5)

        added_step = e2.copy()
        result = arrow("E2", "C4", green)
        result_label = label(r"v+e_2=(2,2)", "B4", green, 25)
        junction = Circle(radius=0.14, color=yellow, stroke_width=4)
        self.place_at_grid(junction, "D4")
        junction.set_z_index(9)

        self.play(FadeIn(added_step), run_time=0.5)
        self.play(Transform(added_step, arrow("D4", "C4", orange)), run_time=1.5)
        self.play(GrowArrow(result), Write(result_label), run_time=1.5)
        self.play(FadeIn(junction), run_time=0.25)
        self.play(FadeOut(junction), run_time=0.25)
        self.wait(3.5)