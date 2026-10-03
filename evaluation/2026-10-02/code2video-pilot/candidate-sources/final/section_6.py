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

class Section6Scene(TeachingScene):
    def construct(self):
        BLUE = "#60A5FA"
        ORANGE = "#FDBA74"
        PURPLE = "#A78BFA"
        GREEN = "#86EFAC"
        INK = "#F1F5F9"
        GRID = "#64748B"

        self.setup_layout(
            "Sec 6: Predict, Check, and Revisit the Map",
            [
                "Predict the matrix and the image of (2,1).",
                "Columns give basis images; multiplication gives coordinates.",
                "Linear transformations preserve addition and scalar multiplication.",
            ],
        )

        def point_label(text, cell, color=INK, size=19, width=1.8):
            label = Text(text, font_size=size, color=color)
            self.place_at_grid(label, cell, min(1, width / label.width))
            return label

        def area_math(tex, first, last, color=INK, width=2.65):
            formula = MathTex(tex, color=color, font_size=27)
            self.place_in_area(
                formula, first, last, min(1, width / formula.width)
            )
            return formula

        def grid_arrow(start, end, color):
            return Arrow(
                self.grid[start], self.grid[end], buff=0,
                color=color, stroke_width=4,
                max_tip_length_to_length_ratio=0.15,
            )

        # One grid unit represents one coordinate unit. O stays at E1.
        origin = Dot(self.grid["E1"], radius=0.045, color=INK)
        origin_label = point_label("O", "F1", size=20)
        plane = NumberPlane(
            x_range=[0, 2, 1], y_range=[0, 1, 0.5],
            x_length=2, y_length=1,
            axis_config={"color": GRID, "stroke_width": 1.5,
                         "include_ticks": False, "include_tip": False},
            background_line_style={"stroke_color": GRID,
                                   "stroke_width": 1,
                                   "stroke_opacity": 0.35},
            faded_line_ratio=0,
        )
        self.place_in_area(plane, "D1", "E3")

        basis_x = grid_arrow("E1", "E2", BLUE)
        basis_y = grid_arrow("E1", "B1", ORANGE)
        basis_x_label = point_label("T(e₁) = (1,0)", "F2", BLUE)
        basis_y_label = point_label("T(e₂) = (0,3)", "A1", ORANGE)
        input_dot = Dot(self.grid["D3"], color=PURPLE, radius=0.06)
        input_label = point_label("v = (2,1)", "D4", PURPLE)

        # Prediction slots and their labels use the same grid anchors.
        matrix_slot = area_math(r"\left[\begin{array}{cc}\phantom{1}&\phantom{0}\\\phantom{0}&\phantom{3}\end{array}\right]", "A4", "B6", PURPLE)
        matrix_name = point_label("A", "A5", PURPLE)
        result_slot = area_math(r"\left[\begin{array}{c}\phantom{2}\\\phantom{3}\end{array}\right]", "C5", "D6", GREEN)
        result_name = point_label("Av", "C6", GREEN)

        # === Animation for Lecture Line 1 ===
        # 0–17 s: the six-second prediction interval contains no animation.
        self.play(self.lecture[0].animate.set_color(PURPLE), run_time=1)
        self.play(
            FadeIn(plane), FadeIn(origin), FadeIn(origin_label),
            GrowArrow(basis_x), GrowArrow(basis_y),
            FadeIn(basis_x_label), FadeIn(basis_y_label),
            run_time=2,
        )
        self.play(
            FadeIn(input_dot), FadeIn(input_label),
            FadeIn(matrix_slot), FadeIn(matrix_name),
            FadeIn(result_slot), FadeIn(result_name), run_time=1,
        )
        self.wait(6)
        self.play(
            Indicate(VGroup(basis_x, basis_x_label), color=BLUE, scale_factor=1),
            Indicate(VGroup(basis_y, basis_y_label), color=ORANGE, scale_factor=1),
            run_time=1,
        )
        self.wait(6)

        # === Animation for Lecture Line 2 ===
        # 17–32 s: columns, head-to-tail addition, and the resultant.
        self.play(
            self.lecture[0].animate.set_color(WHITE),
            self.lecture[1].animate.set_color(BLUE), run_time=1,
        )

        matrix = Matrix(
            [["1", "0"], ["0", "3"]],
            h_buff=0.7, v_buff=0.65,
            bracket_h_buff=0.15, bracket_v_buff=0.15,
        )
        matrix.get_columns()[0].set_color(BLUE)
        matrix.get_columns()[1].set_color(ORANGE)
        matrix.get_brackets().set_color(INK)
        self.place_in_area(matrix, "A4", "B6", scale_factor=0.48)
        self.play(
            FadeOut(matrix_slot), FadeIn(matrix.get_brackets()),
            Write(matrix.get_columns()[0]), run_time=1,
        )
        self.play(Write(matrix.get_columns()[1]), run_time=1)

        first_step = grid_arrow("E1", "E2", BLUE)
        second_step = grid_arrow("E2", "E3", BLUE)
        vertical_step = grid_arrow("E3", "B3", ORANGE)
        self.play(GrowArrow(first_step), run_time=1)
        self.play(GrowArrow(second_step), run_time=1)
        self.play(GrowArrow(vertical_step), run_time=1)

        # A compact stationary stack preserves the complete calculation.
        multiplication = MathTex(
            r"A", r"\begin{bmatrix}2\\1\end{bmatrix}", r"=",
            r"2", r"\begin{bmatrix}1\\0\end{bmatrix}", r"+",
            r"\begin{bmatrix}0\\3\end{bmatrix}",
            font_size=25,
        )
        multiplication[0].set_color(INK)
        multiplication[1].set_color(PURPLE)
        multiplication[3:5].set_color(BLUE)
        multiplication[6].set_color(ORANGE)
        self.place_in_area(
            multiplication, "C4", "C6",
            scale_factor=min(1, 2.65 / multiplication.width),
        )
        result = area_math(r"=\begin{bmatrix}2\\3\end{bmatrix}", "D5", "D6", GREEN)
        self.play(
            FadeOut(input_label), FadeOut(result_slot), FadeOut(result_name),
            Write(multiplication), Write(result), run_time=2,
        )
        resultant = grid_arrow("E1", "B3", GREEN)
        endpoint = Dot(self.grid["B3"], color=GREEN, radius=0.065)
        endpoint_label = point_label("T(2,1) = (2,3)", "A3", GREEN)
        self.play(
            GrowArrow(resultant), FadeIn(endpoint),
            FadeIn(endpoint_label), run_time=2,
        )
        self.wait(5)

        # === Animation for Lecture Line 3 ===
        # 32–45 s: a native vector robot returns to the original map.
        # Local vertices define geometry; placement uses only the grid helper.
        robot_body = Polygon(
            [-0.14, -0.10, 0], [0.14, -0.10, 0],
            [0.14, 0.10, 0], [-0.14, 0.10, 0],
            color=PURPLE, fill_color=PURPLE, fill_opacity=0.6,
            stroke_width=1.5,
        )
        robot_head = Polygon(
            [-0.11, 0.13, 0], [0.11, 0.13, 0],
            [0.11, 0.27, 0], [-0.11, 0.27, 0],
            color=INK, fill_color=PURPLE, fill_opacity=0.8,
            stroke_width=1.5,
        )
        eyes = VGroup(
            Dot([-0.045, 0.20, 0], radius=0.018, color=INK),
            Dot([0.045, 0.20, 0], radius=0.018, color=INK),
        )
        robot = VGroup(robot_body, robot_head, eyes)
        self.place_at_grid(robot, "D2")
        robot_label = point_label("Robot", "C2", PURPLE, size=18)
        final_robot_label = point_label("Robot", "A2", PURPLE, size=18)
        landmark = Dot(self.grid["D3"], color=GREEN, radius=0.065)
        map_objects = VGroup(plane, robot, landmark)

        self.play(
            self.lecture[1].animate.set_color(WHITE),
            self.lecture[2].animate.set_color(GREEN),
            FadeOut(basis_x), FadeOut(basis_y),
            FadeOut(basis_x_label), FadeOut(basis_y_label),
            FadeOut(first_step), FadeOut(second_step), FadeOut(vertical_step),
            FadeOut(resultant), FadeOut(endpoint), FadeOut(input_dot),
            FadeIn(robot), FadeIn(robot_label), FadeIn(landmark),
            run_time=2,
        )
        # Exact linear map diag(1,3), applied about O, keeps O fixed.
        self.play(
            ApplyMatrix([[1, 0], [0, 3]], map_objects,
                        about_point=self.grid["E1"]),
            FadeOut(robot_label), FadeIn(final_robot_label),
            run_time=3,
        )
        map_rule = area_math(r"T(x,y)=(x,3y)", "F1", "F3", GREEN, width=2.5)
        addition_rule = area_math(r"T(u+v)=T(u)+T(v)", "E4", "E6", INK)
        scalar_rule = area_math(r"T(cv)=cT(v)", "F4", "F6", INK)
        column_rule = MathTex(
            r"A=", r"[", r"T(e_1)", r"\;", r"T(e_2)", r"]",
            font_size=25, color=INK,
        )
        column_rule[2].set_color(BLUE)
        column_rule[4].set_color(ORANGE)
        self.place_in_area(
            column_rule, "B4", "B6",
            scale_factor=min(1, 2.65 / column_rule.width),
        )
        self.play(
            FadeIn(map_rule), FadeIn(addition_rule),
            FadeIn(scalar_rule), FadeIn(column_rule), run_time=1,
        )
        self.play(
            Indicate(addition_rule, color=GREEN, scale_factor=1),
            Indicate(scalar_rule, color=GREEN, scale_factor=1), run_time=1,
        )
        self.play(
            Indicate(matrix.get_columns()[0], color=BLUE, scale_factor=1),
            Indicate(matrix.get_columns()[1], color=ORANGE, scale_factor=1),
            Indicate(column_rule[2], color=BLUE, scale_factor=1),
            Indicate(column_rule[4], color=ORANGE, scale_factor=1),
            run_time=1,
        )
        self.play(
            Indicate(landmark, color=GREEN, scale_factor=1),
            Indicate(endpoint_label, color=GREEN, scale_factor=1),
            Indicate(result, color=GREEN, scale_factor=1), run_time=1,
        )
        self.wait(1)
        self.wait(3)