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

class Section1Scene(TeachingScene):
    def construct(self):
        TEXT = "#F1F5F9"
        GRID = "#94A3B8"
        HORIZONTAL = "#60A5FA"
        VERTICAL = "#FDBA74"
        ORIGINAL = "#A78BFA"
        RESULT = "#86EFAC"
        ACTIVE = "#FDE047"

        self.setup_layout(
            "Sec 1: Moving a Robot’s Map",
            [
                "How can one rule move every map point?",
                "Double horizontal coordinates; keep vertical coordinates unchanged.",
                "Linear transformations move vectors; matrices calculate their coordinates.",
            ],
        )
        self.title.set_color(TEXT)
        self.lecture.set_color(TEXT)

        # Local diagram coordinates: one coordinate unit = 0.5 scene units.
        # Invisible square anchors preserve a shared origin when grid-placing
        # asymmetric vector groups. They are never displayed.
        def anchored(*objects):
            anchor = Square(side_length=2).set_stroke(opacity=0).set_fill(opacity=0)
            group = VGroup(anchor, *objects)
            self.place_at_grid(group, "C3")
            return group

        map_grid = VGroup()
        for k in range(-2, 3):
            q = 0.5 * k
            map_grid.add(
                Line([q, -1, 0], [q, 1, 0], color=GRID, stroke_width=1.3),
                Line([-1, q, 0], [1, q, 0], color=GRID, stroke_width=1.3),
            )
        self.place_at_grid(map_grid, "C3")
        map_grid.set_opacity(0.65)

        origin = Dot(radius=0.045, color=TEXT).set_z_index(5)
        self.place_at_grid(origin, "C3")
        origin_label = Text("O", font_size=20, color=TEXT)
        self.place_in_area(origin_label, "C3", "D3")

        # Native robot geometry; internal arrangement is local to the icon.
        eyes = VGroup(
            Circle(radius=0.035, color=TEXT, fill_opacity=1),
            Circle(radius=0.035, color=TEXT, fill_opacity=1),
        ).arrange(RIGHT, buff=0.13)
        head = RoundedRectangle(
            width=0.48, height=0.29, corner_radius=0.06,
            color=TEXT, stroke_width=2,
        )
        head.add(eyes)
        body = Rectangle(width=0.36, height=0.27, color=TEXT, stroke_width=2)
        wheels = VGroup(
            Circle(radius=0.065, color=TEXT, fill_opacity=1),
            Circle(radius=0.065, color=TEXT, fill_opacity=1),
        ).arrange(RIGHT, buff=0.17)
        robot = VGroup(head, body, wheels).arrange(DOWN, buff=0.035)
        self.place_at_grid(robot, "F2")
        robot_label = Text("Robot", font_size=20, color=TEXT)
        self.place_at_grid(robot_label, "F3")

        basis = anchored(
            Arrow(ORIGIN, [0.5, 0, 0], buff=0, color=HORIZONTAL,
                  stroke_width=3, max_tip_length_to_length_ratio=0.2),
            Arrow(ORIGIN, [0, 0.5, 0], buff=0, color=VERTICAL,
                  stroke_width=3, max_tip_length_to_length_ratio=0.2),
        )
        basis.set_z_index(2)

        original_arrow = Arrow(
            ORIGIN, [0.5, 1, 0], buff=0, color=ORIGINAL,
            stroke_width=4, max_tip_length_to_length_ratio=0.13,
        )
        original_dot = Dot([0.5, 1, 0], radius=0.055, color=ORIGINAL)
        original = anchored(original_arrow, original_dot).set_z_index(3)
        p_label = Text("P = (1,2)", font_size=20, color=ORIGINAL)
        self.place_in_area(p_label, "A3", "B4")

        transformed = original.copy().set_z_index(4)
        transformed_arrow = transformed[1]
        transformed_dot = transformed[2]
        tp_label = Text("T(P) = (2,2)", font_size=20, color=RESULT)
        self.place_in_area(tp_label, "A4", "B5")

        rule = VGroup(
            Text("Transformation rule", font_size=18, color=TEXT),
            MathTex(r"T(x,y)=(2x,y)", font_size=30, color=RESULT),
        ).arrange(DOWN, buff=0.16)
        self.place_at_grid(rule, "E3")

        matrix = VGroup(
            Text("Matrix", font_size=18, color=TEXT),
            MathTex(r"\begin{bmatrix}2&0\\0&1\end{bmatrix}",
                    font_size=31, color=TEXT),
        ).arrange(DOWN, buff=0.12)
        self.place_in_area(matrix, "E5", "F5")

        # === Animation for Lecture Line 1 ===
        # 0–10 seconds: establish the robot, square map, and fixed origin.
        self.play(self.lecture[0].animate.set_color(ACTIVE), run_time=0.4)
        self.play(Create(robot), FadeIn(robot_label), run_time=2.6)
        self.play(Create(map_grid), run_time=3.0)
        self.play(FadeIn(origin), FadeIn(origin_label), Create(basis), run_time=2.0)
        self.wait(1.6)
        self.play(self.lecture[0].animate.set_color(TEXT), run_time=0.4)

        # === Animation for Lecture Line 2 ===
        # 10–22 seconds: every grid point follows the same linear map.
        self.play(self.lecture[1].animate.set_color(ACTIVE), run_time=0.4)
        self.play(GrowArrow(original_arrow), FadeIn(original_dot),
                  FadeIn(p_label), run_time=2.0)
        self.wait(1.0)
        self.add(transformed_arrow, transformed_dot)
        stretch = np.diag([2.0, 1.0, 1.0])
        fixed_origin = self.grid["C3"]
        self.play(
            ApplyMatrix(stretch, map_grid, about_point=fixed_origin),
            ApplyMatrix(stretch, basis, about_point=fixed_origin),
            transformed.animate.apply_matrix(stretch, about_point=fixed_origin)
                .set_color(RESULT),
            original_arrow.animate.set_opacity(0.3),
            original_dot.animate.set_opacity(0.3),
            p_label.animate.set_opacity(0.6),
            run_time=5.0,
            rate_func=smooth,
        )
        self.play(FadeIn(tp_label), run_time=0.8)
        self.wait(2.4)
        self.play(self.lecture[1].animate.set_color(TEXT), run_time=0.4)

        # === Animation for Lecture Line 3 ===
        # 22–30 seconds: connect the geometric rule to its matrix.
        self.play(self.lecture[2].animate.set_color(ACTIVE), run_time=0.4)
        self.play(FadeIn(rule), run_time=2.0)
        self.play(FadeIn(matrix), run_time=2.0)
        self.play(
            Flash(origin, color=ACTIVE, flash_radius=0.14, line_length=0.08),
            run_time=1.0,
        )
        self.wait(1.6)
        self.play(
            FadeOut(map_grid), FadeOut(basis), FadeOut(origin),
            FadeOut(origin_label), FadeOut(original_arrow),
            FadeOut(original_dot), FadeOut(transformed_arrow),
            FadeOut(transformed_dot), FadeOut(p_label), FadeOut(tp_label),
            FadeOut(robot), FadeOut(robot_label), FadeOut(rule), FadeOut(matrix),
            run_time=0.6,
        )
        self.play(self.lecture[2].animate.set_color(TEXT), run_time=0.4)
        # This section occupies the first 30 seconds of the larger lesson.