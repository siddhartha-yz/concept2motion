from manim import *


class TeachingScene(Scene):
    def setup_layout(self, title_text, lecture_lines):
        # BASE
        self.camera.background_color = "#000000"
        self.title = Text(title_text, font_size=28, color=WHITE).to_edge(UP)
        self.add(self.title)

        # Left-side lecture content (bullets with "-")
        lecture_texts = [Text(line, font_size=22, color=WHITE) for line in lecture_lines]
        self.lecture = VGroup(*lecture_texts).arrange(DOWN, aligned_edge=LEFT).scale(0.8)
        self.lecture.to_edge(LEFT, buff=0.2)
        self.add(self.lecture)

        # Define fine-grained animation grid (4x4 grid on right side)
        self.grid = {}
        rows = ["A", "B", "C", "D", "E", "F"]  # Top to bottom
        cols = ["1", "2", "3", "4", "5", "6"]  # Left to right

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
        
        # Calculate center of the area
        center_x = (tl_pos[0] + br_pos[0]) / 2
        center_y = (tl_pos[1] + br_pos[1]) / 2
        center = np.array([center_x, center_y, 0])
        
        mobject.scale(scale_factor)
        mobject.move_to(center)
        return mobject

class Section3Scene(TeachingScene):
    def construct(self):
        WHITE_LIGHT = "#F1F5F9"
        BLUE = "#60A5FA"
        ORANGE = "#FDBA74"
        PURPLE = "#A78BFA"
        GREEN = "#86EFAC"
        YELLOW = "#FDE047"
        RED = "#FCA5A5"
        GRID_COLOR = "#334155"

        self.setup_layout(
            "Sec 3: What Makes a Transformation Linear?",
            [
                "Linear transformations preserve vector addition.",
                "They also preserve scalar multiplication.",
                "Both rules hold for every vector and scalar.",
                "Therefore, every linear transformation fixes the origin.",
                "Fixing the origin alone does not prove linearity.",
            ],
        )

        # Vector coordinates are grid nodes: O = F2, one grid unit = one unit.
        # All custom placement uses the supplied grid methods or grid endpoints.
        def node(x, y):
            return self.grid[f"{'ABCDEF'[5 - y]}{2 + x}"]

        def vector(x, y, color, start=(0, 0), opacity=1):
            return Arrow(
                node(*start), node(x, y), buff=0,
                color=color, stroke_width=4,
                max_tip_length_to_length_ratio=0.16,
            ).set_opacity(opacity)

        def label(text, first, last=None, color=WHITE_LIGHT, size=19):
            obj = Text(text, font_size=size, color=color)
            if last is None:
                return self.place_at_grid(obj, first)
            return self.place_in_area(obj, first, last)

        def formula(tex, first, last, color=WHITE_LIGHT, size=29):
            return self.place_in_area(
                MathTex(tex, font_size=size, color=color), first, last
            )

        def highlight(index, color):
            return [
                line.animate.set_color(color if i == index else WHITE_LIGHT)
                for i, line in enumerate(self.lecture)
            ]

        # A restrained coordinate lattice makes endpoint comparisons legible.
        lattice = VGroup(
            *[Line(node(x, 0), node(x, 2), color=GRID_COLOR, stroke_width=1)
              for x in range(5)],
            *[Line(node(0, y), node(4, y), color=GRID_COLOR, stroke_width=1)
              for y in range(3)],
        ).set_opacity(0.5)
        axes = VGroup(
            Line(node(0, 0), node(4, 0), color=WHITE_LIGHT, stroke_width=1.5),
            Line(node(0, 0), node(0, 2), color=WHITE_LIGHT, stroke_width=1.5),
        ).set_opacity(0.6)
        origin = self.place_at_grid(Dot(radius=0.055, color=WHITE_LIGHT), "F2")
        origin_label = label("O", "F1", size=18)
        self.add(lattice, axes, origin, origin_label)

        addition = formula(r"T(u+v)=T(u)+T(v)", "A2", "A6")
        addition_name = label("Addition rule", "A1", size=15)
        scalar = formula(r"T(cw)=cT(w)", "B2", "B6")
        scalar_name = label("Scalar rule", "B1", size=15)

        # === Animation for Lecture Line 1 ===
        # 0–16 seconds: addition, deformation, and coincident endpoint.
        self.play(*highlight(0, PURPLE), Write(addition), FadeIn(addition_name), run_time=1)
        u = vector(1, 0, BLUE)
        v = vector(0, 1, ORANGE)
        diagonal = vector(1, 1, PURPLE)
        u_label = label("u = (1,0)", "E3", size=16, color=BLUE)
        v_label = label("v = (0,1)", "E1", size=16, color=ORANGE)
        sum_label = label("u+v", "D3", size=18, color=PURPLE)
        self.play(Create(u), Create(v), FadeIn(u_label), FadeIn(v_label), run_time=2)
        self.play(Create(diagonal), FadeIn(sum_label), run_time=1)
        u_copy = vector(1, 1, BLUE, start=(0, 1), opacity=0.3)
        v_copy = vector(1, 1, ORANGE, start=(1, 0), opacity=0.3)
        self.play(Create(u_copy), Create(v_copy), run_time=1)
        transform_label = formula(r"T(x,y)=(2x,y)", "C2", "C6", GREEN, 25)
        self.play(Write(transform_label), run_time=1)
        self.play(
            Transform(u, vector(2, 0, BLUE)),
            Transform(v, vector(0, 1, ORANGE)),
            Transform(diagonal, vector(2, 1, PURPLE)),
            Transform(u_copy, vector(2, 1, BLUE, start=(0, 1), opacity=0.3)),
            Transform(v_copy, vector(2, 1, ORANGE, start=(2, 0), opacity=0.3)),
            FadeOut(u_label), FadeOut(v_label), FadeOut(sum_label),
            run_time=3,
        )
        tu_label = label("T(u)", "E3", color=BLUE, size=17)
        tv_label = label("T(v)", "E1", color=ORANGE, size=17)
        self.play(FadeIn(tu_label), FadeIn(tv_label), run_time=1)
        head_tail = vector(2, 1, ORANGE, start=(2, 0))
        self.play(Create(head_tail), run_time=2)
        endpoint = self.place_at_grid(Dot(radius=0.07, color=GREEN), "E4")
        endpoint_label = label("(2,1)", "D4", color=GREEN)
        self.play(FadeIn(endpoint), FadeIn(endpoint_label),
                  Flash(node(2, 1), color=GREEN, flash_radius=0.18), run_time=1)
        self.wait(3)
        addition_diagram = VGroup(
            u, v, diagonal, u_copy, v_copy, head_tail,
            tu_label, tv_label, endpoint, endpoint_label,
        )

        # === Animation for Lecture Line 2 ===
        # 16–28 seconds: both orders reach (4,2).
        self.play(*highlight(1, GREEN), FadeOut(addition_diagram),
                  FadeOut(transform_label), Write(scalar), FadeIn(scalar_name), run_time=1)
        top_path = label("Scale, then transform: 2w → T(2w)", "C2", "C6", BLUE, 18)
        bottom_path = label("Transform, then scale: T(w) → 2T(w)", "F3", "F6", ORANGE, 15)
        sample = label("w = (1,1), c = 2", "D1", "D3", WHITE_LIGHT, 17)
        upper = vector(1, 1, BLUE)
        self.play(FadeIn(top_path), FadeIn(bottom_path), FadeIn(sample),
                  Create(upper), run_time=1)
        self.play(Transform(upper, vector(2, 2, BLUE)), run_time=2)
        self.play(Transform(upper, vector(4, 2, GREEN)), run_time=2)
        lower = vector(1, 1, ORANGE)
        self.play(Create(lower), run_time=1)
        self.play(Transform(lower, vector(2, 1, ORANGE)), run_time=1)
        self.play(Transform(lower, vector(4, 2, GREEN)), run_time=2)
        final_tip = label("(4,2)", "C6", color=GREEN, size=18)
        self.play(FadeOut(top_path), FadeIn(final_tip),
                  Flash(node(4, 2), color=GREEN, flash_radius=0.2), run_time=1)
        self.wait(1)

        # === Animation for Lecture Line 3 ===
        # 28–36 seconds: quantify the rules; examples are illustrations.
        quantifier = label("For all u, v and real c", "C1", "C6", YELLOW, 22)
        self.play(*highlight(2, YELLOW), FadeOut(bottom_path), FadeOut(sample),
                  FadeOut(final_tip), Write(quantifier), run_time=1)
        second_sample = label("u=(1,1), v=(1,0); w=(1,0), c=3", "D1", "D6", size=17)
        self.play(FadeOut(upper), FadeOut(lower), FadeIn(second_sample), run_time=1)
        second_u = vector(2, 1, BLUE)
        second_v = vector(4, 1, ORANGE, start=(2, 1))
        second_sum = vector(4, 1, PURPLE)
        self.play(Create(second_u), Create(second_v), Create(second_sum), run_time=1)
        self.play(Flash(node(4, 1), color=GREEN, flash_radius=0.16), run_time=0.5)
        self.play(FadeOut(second_u), FadeOut(second_v), FadeOut(second_sum),
                  Transform(second_sample, label("w=(1,0), c=3: both orders give (6,0)",
                                                "D1", "D6", size=17)), run_time=0.5)
        # This second scalar example is algebraic so no out-of-grid endpoint is used.
        second_calculation = formula(r"T(3,0)=(6,0)=3T(1,0)", "E2", "E6", GREEN, 25)
        self.play(Write(second_calculation), run_time=1)
        proof_note = label("Examples illustrate; algebra establishes", "D1", "D6", size=20)
        self.play(FadeOut(second_sample), FadeOut(second_calculation),
                  FadeIn(proof_note), run_time=1)
        self.play(quantifier.animate.set_color(WHITE_LIGHT), run_time=0.5)
        self.play(quantifier.animate.set_color(YELLOW), run_time=0.5)
        self.wait(1)

        # === Animation for Lecture Line 4 ===
        # 36–46 seconds: the origin consequence and a translation contrast.
        derivation = formula(r"T(0)=T(0\cdot w)=0\cdot T(w)=0", "C1", "C6", size=27)
        self.play(*highlight(3, WHITE_LIGHT), FadeOut(quantifier), FadeOut(proof_note),
                  Write(derivation), run_time=1)
        working_vector = vector(2, 1, GREEN)
        self.play(Create(working_vector), run_time=1)
        collapsed = self.place_at_grid(Dot(radius=0.055, color=WHITE_LIGHT), "F2")
        self.play(ReplacementTransform(working_vector, collapsed), run_time=2)
        fixed_label = label("T(0) = 0", "E2", color=WHITE_LIGHT, size=18)
        self.play(FadeIn(fixed_label),
                  Flash(node(0, 0), color=WHITE_LIGHT, flash_radius=0.16), run_time=1)
        translation = formula(r"S(x,y)=(x+1,y)", "D2", "D6", RED, 26)
        self.play(Write(translation), run_time=1)
        shifted_origin = origin.copy().set_color(RED)
        self.add(shifted_origin)
        target_origin = self.place_at_grid(Dot(radius=0.065, color=RED), "F3")
        self.play(Transform(shifted_origin, target_origin), run_time=1)
        translation_result = label("S(0,0) = (1,0)", "E3", "E4", RED, 18)
        not_linear = label("Not linear", "E5", color=RED, size=20)
        self.play(FadeIn(translation_result), FadeIn(not_linear), run_time=1)
        self.wait(2)

        # === Animation for Lecture Line 5 ===
        # 46–60 seconds: a fixed origin does not guarantee the scalar rule.
        nonlinear = formula(r"F(x,y)=(x^2,y)", "C1", "C6", RED, 29)
        self.play(*highlight(4, RED), FadeOut(derivation), FadeOut(translation),
                  FadeOut(shifted_origin), FadeOut(translation_result), FadeOut(not_linear),
                  FadeOut(fixed_label), FadeOut(collapsed), Write(nonlinear), run_time=1)
        fixed_f = label("F(0,0) = (0,0)", "E1", "E3", RED, 17)
        self.play(FadeIn(fixed_f),
                  Flash(node(0, 0), color=WHITE_LIGHT, flash_radius=0.16), run_time=1)
        blue_arrow = vector(1, 0, BLUE)
        blue_start = label("w = (1,0); F(w) = (1,0)", "D1", "D6", BLUE, 18)
        self.play(Create(blue_arrow), FadeIn(blue_start), run_time=1)
        self.wait(1)
        blue_result = label("2F(1,0) = (2,0)", "E3", "E4", BLUE, 17)
        self.play(Transform(blue_arrow, vector(2, 0, BLUE)),
                  FadeOut(blue_start), FadeIn(blue_result), run_time=2)
        orange_arrow = vector(2, 0, ORANGE)
        orange_start = label("2w = (2,0)", "D2", "D5", ORANGE, 19)
        self.play(Create(orange_arrow), FadeIn(orange_start), run_time=1)
        orange_result = label("F(2,0) = (4,0)", "E5", "E6", ORANGE, 17)
        self.play(Transform(orange_arrow, vector(4, 0, ORANGE)),
                  FadeOut(orange_start), FadeIn(orange_result), run_time=2)
        # Restore the shorter arrow above the longer one for endpoint visibility.
        self.bring_to_front(blue_arrow, origin)
        failure = formula(r"F(2w)\ne 2F(w)", "D1", "D6", RED, 30)
        self.play(Write(failure),
                  Flash(node(2, 0), color=BLUE, flash_radius=0.18),
                  Flash(node(4, 0), color=ORANGE, flash_radius=0.18), run_time=1)
        self.wait(1)
        self.play(addition.animate.set_color(YELLOW), scalar.animate.set_color(YELLOW),
                  addition_name.animate.set_color(YELLOW),
                  scalar_name.animate.set_color(YELLOW), run_time=1)
        self.wait(2)
