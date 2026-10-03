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

class Section5Scene(TeachingScene):
    def construct(self):
        BLUE = "#60A5FA"
        ORANGE = "#FDBA74"
        PURPLE = "#A78BFA"
        DIM = "#94A3B8"
        GREEN = "#86EFAC"
        YELLOW = "#FDE047"
        WHITE_LIGHT = "#F1F5F9"

        self.setup_layout(
            "Sec 5: Calculating and Recognizing Transformations",
            [
                "Multiply by combining the matrix’s colored columns.",
                "Row arithmetic gives the same resulting coordinates.",
                "Scaling changes lengths; rotation turns vectors.",
                "Shear slants grids while preserving linearity.",
                "Linear maps can collapse dimensions and lose invertibility.",
            ],
        )

        # Geometry is constructed in a grid-anchored coordinate system.
        # The unchanged base class supplies all layout positioning.
        coordinates = NumberPlane(
            x_range=[-2, 2, 1],
            y_range=[-2, 2, 1],
            x_length=2.2,
            y_length=2.2,
            axis_config={"stroke_color": DIM, "stroke_width": 1.4},
            background_line_style={
                "stroke_color": DIM,
                "stroke_width": 1,
                "stroke_opacity": 0.35,
            },
            faded_line_ratio=0,
        )
        self.place_at_grid(coordinates, "D3")
        origin = coordinates.c2p(0, 0)

        def point(x, y):
            return coordinates.c2p(x, y)

        def grid_copy(color=DIM, opacity=0.35):
            return coordinates.copy().set_color(color).set_opacity(opacity)

        def vector(x, y, color, start=(0, 0)):
            return Arrow(
                point(*start), point(x, y), buff=0,
                color=color, stroke_width=4,
                max_tip_length_to_length_ratio=0.16,
            ).set_z_index(5)

        def text_at(text, cell, color=WHITE_LIGHT, size=19):
            obj = Text(text, font_size=size, color=color)
            return self.place_at_grid(obj, cell)

        def math_at(tex, cell, color=WHITE_LIGHT, size=27):
            obj = MathTex(tex, font_size=size, color=color)
            return self.place_at_grid(obj, cell)

        def activate(index, color):
            self.play(*[
                line.animate.set_color(color if i == index else WHITE)
                for i, line in enumerate(self.lecture)
            ], run_time=0.4)

        def hold_until(deadline):
            remaining = deadline - self.time
            if remaining > 0:
                self.wait(remaining)

        origin_dot = Dot(origin, radius=0.035, color=WHITE_LIGHT)
        origin_label = math_at("O", "E3", size=19)
        self.add(origin_dot, origin_label)

        # === Animation for Lecture Line 1 ===
        activate(0, GREEN)
        matrix = Matrix(
            [[2, 1], [0, 1]],
            element_to_mobject_config={"font_size": 27},
            h_buff=0.65, v_buff=0.55,
        )
        matrix.get_columns()[0].set_color(BLUE)
        matrix.get_columns()[1].set_color(ORANGE)
        matrix.get_brackets().set_color(WHITE_LIGHT)
        matrix_heading = VGroup(
            MathTex("A=", font_size=28, color=WHITE_LIGHT), matrix
        ).arrange(RIGHT, buff=0.12)
        self.place_in_area(matrix_heading, "A2", "A4")

        original_grid = grid_copy()
        image_grid = grid_copy(GREEN, 0.45)
        original_vector = vector(1, 2, PURPLE)
        original_label = math_at(r"v=(1,2)", "C3", PURPLE, 22)
        combination = MathTex(
            r"Av=", r"1\begin{bmatrix}2\\0\end{bmatrix}",
            "+", r"2\begin{bmatrix}1\\1\end{bmatrix}",
            font_size=27,
        )
        combination[0].set_color(GREEN)
        combination[1].set_color(BLUE)
        combination[2].set_color(WHITE_LIGHT)
        combination[3].set_color(ORANGE)
        self.place_in_area(combination, "B2", "B5")

        self.play(FadeIn(matrix_heading), Create(original_grid),
                  GrowArrow(original_vector), FadeIn(original_label), run_time=1.6)
        self.add(image_grid)
        self.play(
            ApplyMatrix([[2, 1], [0, 1]], image_grid, about_point=origin),
            Write(combination), run_time=2.5,
        )
        first_component = vector(2, 0, BLUE)
        second_component = vector(4, 2, ORANGE, start=(2, 0))
        first_label = math_at(r"1a_1", "E4", BLUE, 21)
        second_label = math_at(r"2a_2", "D5", ORANGE, 21)
        self.play(GrowArrow(first_component), FadeIn(first_label), run_time=1.4)
        self.play(GrowArrow(second_component), FadeIn(second_label), run_time=1.6)
        image_vector = vector(4, 2, GREEN)
        image_label = math_at(r"Av=(4,2)", "C5", GREEN, 22)
        endpoint = Dot(point(4, 2), radius=0.055, color=GREEN).set_z_index(7)
        self.play(GrowArrow(image_vector), FadeIn(image_label),
                  FadeIn(endpoint), run_time=1.5)
        hold_until(15)

        # === Animation for Lecture Line 2 ===
        activate(1, YELLOW)
        self.play(FadeOut(first_component), FadeOut(second_component),
                  FadeOut(first_label), FadeOut(second_label), run_time=0.6)
        arithmetic = MathTex(
            r"Av=",
            r"\begin{bmatrix}2\cdot1+1\cdot2\\0\cdot1+1\cdot2\end{bmatrix}",
            "=", r"\begin{bmatrix}4\\2\end{bmatrix}",
            font_size=27, color=WHITE_LIGHT,
        )
        arithmetic[0].set_color(GREEN)
        arithmetic[3].set_color(GREEN)
        self.place_in_area(arithmetic, "F2", "F5")
        self.play(Write(arithmetic), run_time=1.8)

        # A matching overlay isolates each product row without changing
        # the vertical column-vector typesetting underneath.
        row_products = VGroup(
            MathTex(r"2\cdot1+1\cdot2", font_size=27, color=YELLOW),
            MathTex(r"0\cdot1+1\cdot2", font_size=27, color=YELLOW),
        ).arrange(DOWN, buff=0.12)
        self.place_at_grid(row_products, "E4", scale_factor=0.78)
        x_result = math_at(r"x=4", "D6", YELLOW, 23)
        y_result = math_at(r"y=2", "B5", YELLOW, 23)
        rows = matrix.get_rows()
        self.play(rows[0].animate.set_color(YELLOW),
                  FadeIn(row_products[0]), run_time=0.7)
        self.play(Write(x_result), run_time=0.7)
        self.wait(1.2)
        self.play(rows[0][0].animate.set_color(BLUE),
                  rows[0][1].animate.set_color(ORANGE),
                  rows[1].animate.set_color(YELLOW),
                  FadeOut(row_products[0]), FadeIn(row_products[1]), run_time=0.8)
        self.play(Write(y_result), run_time=0.7)
        self.wait(1.2)
        self.play(matrix.get_columns()[0].animate.set_color(BLUE),
                  matrix.get_columns()[1].animate.set_color(ORANGE),
                  FadeOut(row_products[1]), run_time=0.7)
        self.play(Flash(endpoint, color=YELLOW, flash_radius=0.18),
                  Indicate(image_vector, color=YELLOW),
                  Indicate(arithmetic[3], color=YELLOW), run_time=1)
        hold_until(29)

        # === Animation for Lecture Line 3 ===
        activate(2, GREEN)
        self.play(*[FadeOut(obj) for obj in [
            matrix_heading, combination, arithmetic, x_result, y_result,
            original_grid, image_grid, original_vector, original_label,
            image_vector, image_label, endpoint,
        ]], run_time=0.6)
        independent = text_at("Independent examples", "A4", size=22)
        self.play(FadeIn(independent), run_time=0.4)

        working_grid = grid_copy(GREEN, 0.45)
        reference_grid = grid_copy()
        working_vector = vector(1, 2, PURPLE)
        input_label = math_at(r"(1,2)", "C3", PURPLE, 21)
        scale_heading = text_at("Horizontal scaling", "B4", GREEN, 21)
        scale_formula = math_at(
            r"D=\begin{bmatrix}2&0\\0&1\end{bmatrix},\quad D(1,2)=(2,2)",
            "F4", GREEN, 24,
        )
        scale_result = math_at(r"(2,2)", "C4", GREEN, 21)
        self.play(Create(reference_grid), Create(working_grid),
                  GrowArrow(working_vector), FadeIn(input_label),
                  FadeIn(scale_heading), Write(scale_formula), run_time=0.7)
        self.play(
            ApplyMatrix([[2, 0], [0, 1]], working_grid, about_point=origin),
            Transform(working_vector, vector(2, 2, GREEN)),
            FadeOut(input_label), FadeIn(scale_result), run_time=1.7,
        )
        self.wait(0.8)
        self.play(*[FadeOut(obj) for obj in [
            working_grid, working_vector, scale_heading,
            scale_formula, scale_result,
        ]], run_time=0.4)

        working_grid = grid_copy(GREEN, 0.45)
        working_vector = vector(1, 2, PURPLE)
        rotation_heading = text_at("Rotation", "B4", GREEN, 21)
        rotation_formula = math_at(
            r"R=\begin{bmatrix}0&-1\\1&0\end{bmatrix},\quad R(1,2)=(-2,1)",
            "F4", GREEN, 24,
        )
        rotation_result = math_at(r"(-2,1)", "C2", GREEN, 21)
        direction_arc = ParametricFunction(
            lambda t: point(1.35 * np.cos(t), 1.35 * np.sin(t)),
            t_range=[0, PI / 2], color=YELLOW, stroke_width=3,
        )
        direction_label = text_at("90° CCW", "D4", YELLOW, 18)
        self.play(FadeIn(working_grid), GrowArrow(working_vector),
                  FadeIn(rotation_heading), Write(rotation_formula), run_time=0.7)
        self.play(Rotate(working_grid, angle=PI / 2, about_point=origin),
                  Rotate(working_vector, angle=PI / 2, about_point=origin),
                  Create(direction_arc), FadeIn(direction_label), run_time=2.2)
        self.play(working_vector.animate.set_color(GREEN),
                  FadeIn(rotation_result), run_time=0.4)
        hold_until(42)

        # === Animation for Lecture Line 4 ===
        activate(3, GREEN)
        self.play(*[FadeOut(obj) for obj in [
            working_grid, working_vector, reference_grid,
            rotation_heading, rotation_formula, rotation_result,
            direction_arc, direction_label, independent,
        ]], run_time=0.5)
        shear_heading = text_at("Horizontal shear", "A4", GREEN, 22)
        shear_matrix = math_at(
            r"H=\begin{bmatrix}1&1\\0&1\end{bmatrix}", "B3", WHITE_LIGHT, 27
        )
        shear_rule = math_at(r"(x,y)\mapsto(x+y,y)", "B5", GREEN, 23)
        reference_grid = grid_copy()
        working_grid = grid_copy(GREEN, 0.45)
        working_vector = vector(1, 2, PURPLE)
        input_label = math_at(r"(1,2)", "C3", PURPLE, 21)
        shear_result = math_at(r"H(1,2)=(3,2)", "C5", GREEN, 22)
        self.play(FadeIn(shear_heading), Write(shear_matrix), Write(shear_rule),
                  Create(reference_grid), Create(working_grid),
                  GrowArrow(working_vector), FadeIn(input_label), run_time=0.7)
        self.play(
            ApplyMatrix([[1, 1], [0, 1]], working_grid, about_point=origin),
            Transform(working_vector, vector(3, 2, GREEN)),
            FadeOut(input_label), FadeIn(shear_result), run_time=2.1,
        )
        basis_one = vector(1, 0, BLUE)
        basis_two = vector(1, 1, ORANGE)
        basis_one_label = math_at(r"(1,0)", "E4", BLUE, 20)
        basis_two_label = math_at(r"(1,1)", "C4", ORANGE, 20)
        self.play(GrowArrow(basis_one), GrowArrow(basis_two),
                  FadeIn(basis_one_label), FadeIn(basis_two_label), run_time=0.8)
        self.play(Indicate(basis_one, color=BLUE),
                  Indicate(basis_two, color=ORANGE), run_time=0.8)
        hold_until(51)

        # === Animation for Lecture Line 5 ===
        activate(4, YELLOW)
        self.play(*[FadeOut(obj) for obj in [
            shear_heading, shear_matrix, shear_rule, reference_grid,
            working_grid, working_vector, shear_result,
            basis_one, basis_two, basis_one_label, basis_two_label,
        ]], run_time=0.5)
        projection_heading = text_at("Projection onto a line", "A4", size=22)
        projection_matrix = math_at(
            r"C=\begin{bmatrix}1&0\\0&0\end{bmatrix}", "B4", WHITE_LIGHT, 28
        )
        working_grid = grid_copy(DIM, 0.55)
        point_one = Dot(point(1, 1), radius=0.055, color=GREEN).set_z_index(7)
        point_two = Dot(point(1, 2), radius=0.055, color=GREEN).set_z_index(7)
        label_one = math_at(r"(1,1)", "D4", GREEN, 20)
        label_two = math_at(r"(1,2)", "C4", GREEN, 20)
        merged_label = math_at(r"(1,0)", "E4", GREEN, 21)
        same_output = text_at("Different inputs, same output", "E4", YELLOW, 20)
        # Keep the output label close to its point while the explanatory
        # sentence occupies a distinct grid row.
        self.place_at_grid(same_output, "C4")
        not_reversible = text_at("Not reversible", "E5", YELLOW, 20)
        conclusion = text_at("Lengths and angles need not be preserved", "F4", size=18)
        collapsed_line = Line(point(-2, 0), point(2, 0), color=DIM, stroke_width=2)
        self.play(FadeIn(projection_heading), Write(projection_matrix),
                  Create(working_grid), FadeIn(point_one), FadeIn(point_two),
                  FadeIn(label_one), FadeIn(label_two), run_time=0.7)
        self.play(
            ApplyMatrix([[1, 0], [0, 0]], working_grid, about_point=origin),
            Transform(point_one, Dot(point(1, 0), radius=0.055, color=GREEN)),
            Transform(point_two, Dot(point(1, 0), radius=0.055, color=GREEN)),
            FadeOut(label_one), FadeOut(label_two), run_time=2.2,
        )
        self.remove(working_grid, point_two)
        self.add(collapsed_line)
        self.play(FadeIn(merged_label), Flash(point_one, color=GREEN), run_time=0.6)
        self.play(Write(same_output), Write(not_reversible), run_time=0.8)
        self.play(Write(conclusion), run_time=0.9)
        hold_until(60)