from manim import *
import numpy as np


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

class Section4Scene(TeachingScene):
    def construct(self):
        WHITE_LIGHT = "#F1F5F9"
        SLATE = "#94A3B8"
        BLUE = "#60A5FA"
        ORANGE = "#FDBA74"
        YELLOW = "#FDE047"
        GREEN = "#86EFAC"

        self.setup_layout(
            "Sec 4: Building a Matrix From Basis Images",
            [
                "Track where the two basis vectors go.",
                "Place their images in the matrix’s columns.",
                "First column: T(e₁). Second column: T(e₂).",
                "Linearity transforms combinations into combinations of images.",
                "These two images determine the entire transformation.",
            ],
        )

        def highlight(index, color):
            # Lecture objects retain their original positions and sizes.
            self.play(
                *[
                    line.animate.set_color(color if i == index else WHITE)
                    for i, line in enumerate(self.lecture)
                ],
                run_time=0.5,
            )

        # A hidden coordinate system supplies mathematical geometry coordinates.
        # Its placement, and every text placement, use the supplied grid helpers.
        coordinates = Axes(
            x_range=[0, 4.5, 1],
            y_range=[0, 2.5, 1],
            x_length=2.7,
            y_length=1.5,
            tips=False,
            axis_config={"include_ticks": False, "stroke_width": 0},
        )
        self.place_in_area(coordinates, "D1", "F4")

        def point(x, y):
            return coordinates.c2p(x, y)

        def arrow(start, end, color, width=4):
            return Arrow(
                point(*start), point(*end),
                buff=0,
                color=color,
                stroke_width=width,
                max_tip_length_to_length_ratio=0.19,
            )

        def polygon(vertices):
            return Polygon(
                *[point(*vertex) for vertex in vertices],
                stroke_color=SLATE,
                stroke_width=2,
                fill_color=BLUE,
                fill_opacity=0.08,
            ).set_z_index(-2)

        # === Animation for Lecture Line 1 ===
        # 0–12 seconds
        highlight(0, BLUE)
        example = Text("New example", font_size=23, color=WHITE_LIGHT)
        self.place_at_grid(example, "D2")
        square = polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        origin = Dot(point(0, 0), radius=0.045, color=WHITE_LIGHT).set_z_index(5)
        origin_label = MathTex("O", font_size=22, color=WHITE_LIGHT)
        self.place_at_grid(origin_label, "F1")
        self.play(
            FadeIn(example), Create(square), FadeIn(origin), Write(origin_label),
            run_time=1.5,
        )

        e1 = arrow((0, 0), (1, 0), BLUE).set_z_index(3)
        e2 = arrow((0, 0), (0, 1), ORANGE).set_z_index(3)
        e1_label = MathTex(r"e_1=(1,0)", font_size=23, color=BLUE)
        e2_label = MathTex(r"e_2=(0,1)", font_size=23, color=ORANGE)
        self.place_at_grid(e1_label, "F2")
        self.place_at_grid(e2_label, "E1")
        self.play(
            GrowArrow(e1), GrowArrow(e2), Write(e1_label), Write(e2_label),
            run_time=2,
        )

        image1_label = MathTex(
            r"T(e_1)=", "(", "2", ",", "0", ")",
            font_size=23, color=BLUE,
        )
        image2_label = MathTex(
            r"T(e_2)=", "(", "1", ",", "1", ")",
            font_size=23, color=ORANGE,
        )
        self.place_at_grid(image1_label, "F2")
        self.place_at_grid(image2_label, "E1")
        parallelogram = polygon([(0, 0), (2, 0), (3, 1), (1, 1)])
        self.play(
            Transform(e1, arrow((0, 0), (2, 0), BLUE).set_z_index(3)),
            Transform(e2, arrow((0, 0), (1, 1), ORANGE).set_z_index(3)),
            Transform(square, parallelogram),
            ReplacementTransform(e1_label, image1_label),
            ReplacementTransform(e2_label, image2_label),
            run_time=3,
        )
        self.wait(5)

        # === Animation for Lecture Line 2 ===
        # 12–23 seconds
        highlight(1, YELLOW)
        matrix = Matrix(
            [["2", "1"], ["0", "1"]],
            h_buff=0.85,
            v_buff=0.65,
            bracket_h_buff=0.16,
            bracket_v_buff=0.15,
            element_to_mobject_config={"font_size": 32},
        )
        matrix.get_columns()[0].set_color(BLUE)
        matrix.get_columns()[1].set_color(ORANGE)
        matrix.get_brackets().set_color(WHITE_LIGHT)
        matrix_name = MathTex("A=", font_size=31, color=WHITE_LIGHT)
        matrix_display = VGroup(matrix_name, matrix).arrange(RIGHT, buff=0.15)
        self.place_in_area(matrix_display, "B4", "C6", scale_factor=0.85)
        entries = matrix.get_entries()
        self.play(Write(matrix_name), Create(matrix.get_brackets()), run_time=1.5)
        self.play(
            TransformFromCopy(image1_label[2], entries[0]),
            TransformFromCopy(image1_label[4], entries[2]),
            run_time=2,
        )
        self.play(
            TransformFromCopy(image2_label[2], entries[1]),
            TransformFromCopy(image2_label[4], entries[3]),
            run_time=2,
        )
        self.wait(5)

        # === Animation for Lecture Line 3 ===
        # 23–32 seconds
        highlight(2, YELLOW)
        header1 = MathTex(r"T(e_1)", font_size=25, color=BLUE)
        header2 = MathTex(r"T(e_2)", font_size=25, color=ORANGE)
        self.place_at_grid(header1, "A5")
        self.place_at_grid(header2, "A6")
        self.play(Write(header1), Write(header2), run_time=1.5)
        # Indicate with scale_factor=1 preserves the locations of matrix entries.
        self.play(
            Indicate(matrix.get_columns()[0], color=BLUE, scale_factor=1),
            Indicate(e1, color=BLUE, scale_factor=1),
            run_time=1,
        )
        self.play(
            Indicate(matrix.get_columns()[1], color=ORANGE, scale_factor=1),
            Indicate(e2, color=ORANGE, scale_factor=1),
            run_time=1,
        )
        columns_caption = Text("Basis images are columns", font_size=20, color=YELLOW)
        self.place_in_area(columns_caption, "D4", "D6")
        self.play(Write(columns_caption), run_time=1)
        self.wait(5)

        # === Animation for Lecture Line 4 ===
        # 32–47 seconds
        highlight(3, WHITE_LIGHT)
        linearity = MathTex(
            r"T(xe_1+ye_2)=", r"xT(e_1)", "+", r"yT(e_2)",
            font_size=30, color=WHITE_LIGHT,
        )
        linearity[1].set_color(BLUE)
        linearity[3].set_color(ORANGE)
        self.place_in_area(linearity, "A1", "A6", scale_factor=0.85)
        numeric = MathTex("x=1,\\quad y=2", font_size=25, color=WHITE_LIGHT)
        self.place_in_area(numeric, "B1", "B3")
        self.play(
            FadeOut(header1), FadeOut(header2),
            Write(linearity), Write(numeric),
            run_time=1.5,
        )

        first_step = arrow((0, 0), (2, 0), BLUE, width=5).set_z_index(4)
        second_step = arrow((2, 0), (3, 1), ORANGE, width=5).set_z_index(4)
        third_step = arrow((3, 1), (4, 2), ORANGE, width=5).set_z_index(4)
        self.play(TransformFromCopy(e1, first_step), run_time=2)
        self.play(TransformFromCopy(e2, second_step), run_time=2)
        self.play(TransformFromCopy(e2, third_step), run_time=2)
        resultant = arrow((0, 0), (4, 2), GREEN, width=5).set_z_index(5)
        resultant_label = MathTex(r"T(1,2)=(4,2)", font_size=24, color=GREEN)
        self.place_at_grid(resultant_label, "D3")
        self.play(GrowArrow(resultant), Write(resultant_label), run_time=2)
        self.wait(5)

        # === Animation for Lecture Line 5 ===
        # 47–60 seconds
        highlight(4, GREEN)
        self.play(
            FadeOut(linearity), FadeOut(numeric),
            FadeOut(columns_caption),
            FadeOut(first_step), FadeOut(second_step), FadeOut(third_step),
            FadeOut(resultant), FadeOut(resultant_label),
            FadeOut(example),
            run_time=1,
        )

        combination = MathTex(
            r"A\begin{bmatrix}x\\y\end{bmatrix}=",
            r"x\begin{bmatrix}2\\0\end{bmatrix}",
            "+",
            r"y\begin{bmatrix}1\\1\end{bmatrix}",
            "=",
            r"\begin{bmatrix}2x+y\\y\end{bmatrix}",
            font_size=29,
            color=WHITE_LIGHT,
        )
        combination[1].set_color(BLUE)
        combination[3].set_color(ORANGE)
        combination[5].set_color(GREEN)
        self.place_in_area(combination, "A1", "A6", scale_factor=0.82)
        transformation = MathTex(r"T(x,y)=(2x+y,y)", font_size=28, color=GREEN)
        self.place_in_area(transformation, "B1", "B3", scale_factor=0.85)
        self.play(Write(combination), Write(transformation), run_time=2)

        # The sparse square lattice is transformed at deterministic frame times.
        # Every source endpoint (x,y) maps to (2x+y,y); (0,0) stays fixed.
        values = np.linspace(0, 1.5, 4)
        source_grid = VGroup()
        target_grid = VGroup()
        for value in values:
            source_grid.add(
                Line(point(value, 0), point(value, 1.5), color=SLATE, stroke_width=1.2),
                Line(point(0, value), point(1.5, value), color=SLATE, stroke_width=1.2),
            )
            target_grid.add(
                Line(point(2 * value, 0), point(2 * value + 1.5, 1.5),
                     color=GREEN, stroke_width=1.2),
                Line(point(value, value), point(3 + value, value),
                     color=GREEN, stroke_width=1.2),
            )
        source_grid.set_opacity(0.45).set_z_index(-3)
        target_grid.set_opacity(0.45).set_z_index(-3)
        self.play(Create(source_grid), run_time=1)
        self.play(Transform(source_grid, target_grid), run_time=4, rate_func=smooth)
        self.wait(4.5)
