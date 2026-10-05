from manim import *
import numpy as np

# Fixed layout: all content fits inside x ∈ [-7.5, 7.5], y ∈ [-4, 4].
config.frame_width = 15
config.frame_height = 8


class MainScene(Scene):
    COLORS = (WHITE, RED_C, YELLOW_C, GREEN_C)
    NAMES = (r"O", r"u", r"u+v", r"v")
    UNIT = np.array([[0., 0.], [1., 0.], [1., 1.], [0., 1.]])

    def construct(self):
        self.camera.background_color = "#101722"
        self.show_example(
            np.array([[2., 1.], [0., 1.]]),
            r"A=\begin{bmatrix}2&1\\0&1\end{bmatrix}",
            r"\det(A)=2\cdot1-1\cdot0=+2",
            "Area = 2 | Orientation preserved",
            "Counterclockwise stays counterclockwise",
            BLUE_D,
        )
        self.show_example(
            np.array([[-1., 0.], [0., 1.]]),
            r"B=\begin{bmatrix}-1&0\\0&1\end{bmatrix}",
            r"\det(B)=(-1)\cdot1-0\cdot0=-1",
            "Area = 1 | The minus sign means reversed orientation",
            "Same corner order, now clockwise",
            PURPLE_D,
        )

    def point(self, xy):
        return self.plane.c2p(float(xy[0]), float(xy[1]))

    @staticmethod
    def signed_area(vertices):
        x, y = vertices.T
        return 0.5 * np.sum(x * np.roll(y, -1) - y * np.roll(x, -1))

    def make_labels(self, vertices):
        # Separate vertical lanes keep corresponding labels apart even when
        # the reflection passes through a collapsed, zero-area configuration.
        offsets = (DOWN * 0.28, DOWN * 0.65,
                   UP * 0.65, UP * 0.28)
        return VGroup(*[
            MathTex(name, color=color, font_size=28)
            .move_to(self.point(vertex) + offset)
            for name, color, vertex, offset in zip(
                self.NAMES, (WHITE, RED_A, YELLOW_A, GREEN_A), vertices, offsets
            )
        ]).set_z_index(5)

    def make_geometry(self, vertices, fill_color):
        points = [self.point(vertex) for vertex in vertices]
        patch = Polygon(
            *points,
            stroke_color=BLUE_C,
            stroke_width=3,
            fill_color=fill_color,
            fill_opacity=0.35,
        )
        vectors = VGroup()
        for index, color in ((1, RED_C), (3, GREEN_C)):
            # A zero vector has no arrow. Avoid constructing a zero-length Arrow.
            if np.linalg.norm(points[index] - points[0]) > 1e-6:
                vectors.add(Arrow(
                    points[0], points[index], buff=0,
                    color=color, stroke_width=5,
                    max_tip_length_to_length_ratio=0.18,
                ))
        dots = VGroup(*[
            Dot(point, radius=0.055, color=color)
            for point, color in zip(points, self.COLORS)
        ])
        patch.set_z_index(1)
        vectors.set_z_index(2)
        dots.set_z_index(3)
        return VGroup(patch, vectors, dots)

    def trace(self, vertices, caption):
        points = [self.point(vertex) for vertex in vertices]
        path = VMobject().set_points_as_corners(points + [points[0]])
        tracer = Dot(points[0], radius=0.09, color=ORANGE).set_z_index(6)
        text = Text(caption, font_size=23, color=ORANGE)
        text.move_to([0, -3.15, 0])
        self.play(FadeIn(text), FadeIn(tracer), run_time=0.3)
        self.play(
            MoveAlongPath(tracer, path),
            run_time=2.0, rate_func=linear,
        )
        self.wait(0.4)
        self.play(FadeOut(text), FadeOut(tracer), run_time=0.3)

    def show_example(self, matrix, matrix_tex, result_tex,
                     conclusion, orientation_caption, fill_color):
        vertices = self.UNIT @ matrix.T
        determinant = float(np.linalg.det(matrix))

        # Mathematical checks are independent of visual presentation.
        assert np.allclose(vertices[1], matrix[:, 0])
        assert np.allclose(vertices[3], matrix[:, 1])
        assert np.allclose(vertices[2], vertices[1] + vertices[3])
        assert np.isclose(self.signed_area(self.UNIT), 1)
        assert np.isclose(self.signed_area(vertices), determinant)

        title = Text("Signed area and the 2D determinant", font_size=34)
        title.move_to([0, 3.5, 0])
        rule = MathTex(
            r"M=\begin{bmatrix}a&b\\c&d\end{bmatrix}"
            r"\qquad\det(M)=ad-bc"
            r"\qquad\text{Area}=|\det(M)|",
            font_size=29,
        ).move_to([0, 2.55, 0])
        heading = MathTex(matrix_tex, font_size=30)
        heading.move_to([0, 1.55, 0])
        status = Text("Fresh unit square: signed area +1", font_size=25)
        status.move_to([0, 0.7, 0])

        self.plane = NumberPlane(
            x_range=[-2, 4, 1], y_range=[-0.4, 1.4, 1],
            x_length=7.5, y_length=2.25,
            background_line_style={"stroke_opacity": 0.18},
            axis_config={"stroke_opacity": 0.45},
        )
        self.plane.shift(np.array([-1., -2., 0.]) - self.plane.c2p(0, 0))

        legend = VGroup(
            MathTex(r"u=M e_1", color=RED_A, font_size=28),
            MathTex(r"v=M e_2", color=GREEN_A, font_size=28),
            MathTex(r"\text{opposite corner}=u+v",
                    color=YELLOW_A, font_size=28),
        ).arrange(RIGHT, buff=0.6).move_to([0, -3.65, 0])

        shape = self.make_geometry(self.UNIT, BLUE_D)
        labels = self.make_labels(self.UNIT)
        self.play(Write(title), FadeIn(rule), run_time=1)
        self.play(
            FadeIn(heading), FadeIn(status), FadeIn(self.plane),
            FadeIn(legend), FadeIn(shape), FadeIn(labels), run_time=1,
        )
        self.trace(self.UNIT, "O → u → u+v → v: counterclockwise")

        # Remove the old status before writing its replacement, so text
        # never morphs through overlapping glyphs.
        result = MathTex(r"\text{TARGET:}\quad" + result_tex, font_size=29).move_to(status)
        self.play(FadeOut(status), run_time=0.25)
        self.play(Write(result), run_time=0.6)

        progress = ValueTracker(0)

        def current_vertices():
            t = progress.get_value()
            current_matrix = (1 - t) * np.eye(2) + t * matrix
            return self.UNIT @ current_matrix.T

        # Rebuild from interpolated coordinates, preserving corner identities.
        # Geometric coincidences during reflection are mathematically necessary;
        # explanatory text and corner labels remain separate throughout.
        shape.add_updater(lambda mob: mob.become(
            self.make_geometry(current_vertices(), fill_color)
        ))
        labels.add_updater(lambda mob: mob.become(
            self.make_labels(current_vertices())
        ))
        self.play(progress.animate.set_value(1), run_time=3, rate_func=smooth)
        shape.clear_updaters()
        labels.clear_updaters()
        self.wait(0.5)
        self.trace(vertices, orientation_caption)

        note = Text(conclusion, font_size=23)
        note.move_to([0, -3.15, 0])
        self.play(FadeIn(note), run_time=0.4)
        self.wait(1)

        # Complete cleanup: the next example starts with a fresh unit square.
        self.play(FadeOut(*self.mobjects), run_time=0.7)
        self.wait(0.25)
