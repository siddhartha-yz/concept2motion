/* Directed layouts and scalar automatic differentiation. Dagre 3.1.1 is MIT. */
(function (global) {
  const V = global.VisualBook,
    P = V.palette;
  const finite = (v) => {
    if (!Number.isFinite(v)) throw Error("Graph value is not finite");
    return v;
  };
  const fmt = (v) => V.formatNumber(v);
  function traceGraph(
    spec,
    { output = null, outputs = null, seeds = null } = {},
  ) {
    if (!Array.isArray(spec) || !spec.length || spec.length > 32)
      throw Error("Scalar graph needs 1..32 nodes");
    const nodes = new Map();
    for (const node of spec) {
      if (
        !node ||
        typeof node.id !== "string" ||
        !node.id.length ||
        nodes.has(node.id)
      )
        throw Error("Unique node ids required");
      nodes.set(node.id, { ...node, inputs: node.inputs ?? [], gradient: 0 });
    }
    const ordered = [],
      visiting = new Set(),
      visited = new Set();
    function visit(id) {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw Error("Computational graph contains a cycle");
      const node = nodes.get(id);
      if (!node) throw Error("Unknown input node " + id);
      if (!Array.isArray(node.inputs))
        throw Error("Node inputs must be an array");
      visiting.add(id);
      node.inputs.forEach(visit);
      visiting.delete(id);
      visited.add(id);
      ordered.push(node);
    }
    spec.forEach((n) => visit(n.id));
    for (const node of ordered) {
      const args = node.inputs.map((id) => nodes.get(id).value);
      const arity = (n) => {
        if (args.length !== n) throw Error(node.op + " needs " + n + " inputs");
      };
      switch (node.op) {
        case "input":
        case "constant":
          arity(0);
          node.value = finite(node.value);
          node.partials = [];
          break;
        case "add":
          arity(2);
          node.value = args[0] + args[1];
          node.partials = [1, 1];
          break;
        case "sub":
          arity(2);
          node.value = args[0] - args[1];
          node.partials = [1, -1];
          break;
        case "mul":
          arity(2);
          node.value = args[0] * args[1];
          node.partials = [args[1], args[0]];
          break;
        case "div":
          arity(2);
          if (args[1] === 0) throw Error("Division by zero");
          node.value = args[0] / args[1];
          node.partials = [1 / args[1], -args[0] / args[1] ** 2];
          break;
        case "pow":
          arity(1);
          finite(node.exponent);
          node.value = args[0] ** node.exponent;
          node.partials = [
            node.exponent === 0
              ? 0
              : node.exponent * args[0] ** (node.exponent - 1),
          ];
          break;
        case "exp":
          arity(1);
          node.value = Math.exp(args[0]);
          node.partials = [node.value];
          break;
        case "log":
          arity(1);
          if (args[0] <= 0) throw Error("Log input must be positive");
          node.value = Math.log(args[0]);
          node.partials = [1 / args[0]];
          break;
        case "relu":
          arity(1);
          node.value = Math.max(0, args[0]);
          node.partials = [args[0] > 0 ? 1 : 0];
          node.convention = "Chosen subgradient 0 at zero";
          break;
        case "sigmoid":
          arity(1);
          node.value = V.scalarFunction({ kind: "sigmoid" }).f(args[0]);
          node.partials = [node.value * (1 - node.value)];
          break;
        case "tanh":
          arity(1);
          node.value = Math.tanh(args[0]);
          node.partials = [1 - node.value ** 2];
          break;
        case "detach":
          arity(1);
          node.value = args[0];
          node.partials = [0];
          node.convention =
            "Forward identity with a stopped gradient; not the ordinary derivative of the complete numeric function";
          break;
        default:
          throw Error("Unknown scalar operation " + node.op);
      }
      finite(node.value);
      node.partials.forEach(finite);
    }
    if (output !== null && outputs !== null)
      throw Error("Use output or outputs, not both");
    const targets = outputs ?? [output ?? ordered.at(-1).id];
    if (
      !Array.isArray(targets) ||
      !targets.length ||
      new Set(targets).size !== targets.length ||
      targets.some((id) => !nodes.has(id))
    )
      throw Error("Unique known graph outputs required");
    const seedValues = seeds ?? targets.map(() => 1);
    if (
      !Array.isArray(seedValues) ||
      seedValues.length !== targets.length ||
      !seedValues.every(Number.isFinite)
    )
      throw Error("Each output needs a finite backward seed");
    targets.forEach((id, i) => {
      nodes.get(id).gradient += seedValues[i];
    });
    for (const node of [...ordered].reverse())
      node.inputs.forEach((id, i) => {
        nodes.get(id).gradient += node.gradient * node.partials[i];
        finite(nodes.get(id).gradient);
      });
    const edges = ordered.flatMap((node) =>
      node.inputs.map((id, i) => ({
        from: id,
        to: node.id,
        partial: node.partials[i],
        contribution: node.gradient * node.partials[i],
        inputIndex: i,
      })),
    );
    return {
      output: targets.length === 1 ? targets[0] : null,
      outputs: targets,
      seeds: seedValues,
      value:
        targets.length === 1
          ? nodes.get(targets[0]).value
          : targets.map((id) => nodes.get(id).value),
      seededValue: finite(
        targets.reduce(
          (sum, id, i) => sum + nodes.get(id).value * seedValues[i],
          0,
        ),
      ),
      nodes: ordered.map((n) => ({ ...n })),
      edges,
      gradients: Object.fromEntries(
        ordered.filter((n) => n.op === "input").map((n) => [n.id, n.gradient]),
      ),
      convention:
        "Seeded reverse-mode differentiation computes Jᵀv; repeated inputs contribute separately; detach stops gradients; values are supplied, not trained weights",
    };
  }
  function graphLayout(
    nodes,
    edges,
    { direction = "LR", nodeHeight = 56 } = {},
  ) {
    if (!global.dagre?.graphlib)
      throw Error("Pinned Dagre bundle is unavailable");
    const graph = new global.dagre.graphlib.Graph({ multigraph: true })
      .setGraph({
        rankdir: direction,
        nodesep: 20,
        ranksep: 32,
        marginx: 0,
        marginy: 0,
      })
      .setDefaultEdgeLabel(() => ({}));
    const ids = new Set();
    for (const n of nodes) {
      if (ids.has(n.id)) throw Error("Duplicate graph node");
      ids.add(n.id);
      const width = Math.max(
        72,
        Math.min(160, V.measure(n.label ?? n.id, 14) + 26),
      );
      graph.setNode(n.id, { width, height: nodeHeight });
    }
    edges.forEach((e, i) => {
      if (!ids.has(e.from) || !ids.has(e.to))
        throw Error("Graph edge endpoint missing");
      graph.setEdge(e.from, e.to, {}, String(i));
    });
    global.dagre.layout(graph);
    return {
      width: graph.graph().width,
      height: graph.graph().height,
      nodes: Object.fromEntries(nodes.map((n) => [n.id, graph.node(n.id)])),
      edges: edges.map((e, i) => ({
        ...e,
        points: graph.edge({ v: e.from, w: e.to, name: String(i) }).points,
      })),
    };
  }
  function positionAlong(points, t) {
    const lengths = points
        .slice(1)
        .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y)),
      sum = lengths.reduce((a, b) => a + b, 0),
      target = V.clamp(t, 0, 1) * sum;
    let before = 0;
    for (let i = 0; i < lengths.length; i++) {
      if (target <= before + lengths[i] || i === lengths.length - 1) {
        const phase = lengths[i] === 0 ? 0 : (target - before) / lengths[i];
        return [
          V.mix(points[i].x, points[i + 1].x, phase),
          V.mix(points[i].y, points[i + 1].y, phase),
        ];
      }
      before += lengths[i];
    }
    return [points[0].x, points[0].y];
  }
  function drawGraph(
    board,
    {
      nodes = [],
      edges = [],
      progress = 0,
      direction = "auto",
      mode = "forward",
      title = "关系图",
      note = null,
      selected = null,
      stateKey = null,
    } = {},
    context = {},
  ) {
    if (nodes.length > 16 || edges.length > 32 || !nodes.length)
      throw Error("Graph drawing needs 1..16 nodes and <=32 edges");
    if (!["forward", "backward"].includes(mode))
      throw Error("Graph mode must be forward or backward");
    const dir =
      direction === "auto" ? (board.width < 500 ? "TB" : "LR") : direction;
    if (!["LR", "TB"].includes(dir))
      throw Error("Graph direction must be LR or TB");
    const key = JSON.stringify({
      direction: dir,
      nodes: nodes.map((n) => [n.id, n.label]),
      edges: edges.map((e) => [e.from, e.to]),
    });
    if (board._vhGraphKey !== key) {
      board._vhGraphLayout = graphLayout(
        nodes,
        edges.map((e) => ({ from: e.from, to: e.to })),
        { direction: dir },
      );
      board._vhGraphKey = key;
    }
    const layout = board._vhGraphLayout,
      availableW = board.width - 32,
      availableH = board.height - (title ? 56 : 32) - (note ? 26 : 0),
      scale = Math.min(
        1,
        availableW / layout.width,
        availableH / layout.height,
      );
    if (scale < 0.82)
      throw Error("Graph is too dense; split it or give it more room");
    const ox = (board.width - layout.width * scale) / 2,
      oy = (title ? 40 : 16) + (availableH - layout.height * scale) / 2,
      toCanvas = (p) => [ox + p.x * scale, oy + p.y * scale],
      p = V.clamp(progress, 0, 1),
      flowColor = mode === "backward" ? P.orange : P.blue;
    if (title)
      board.label("title", title, 16, 20, {
        size: 14,
        maxWidth: board.width - 32,
        avoid: false,
      });
    if (note)
      board.label("note", note, 16, board.height - 12, {
        size: 13,
        maxWidth: board.width - 32,
        avoid: false,
        color: P.muted,
      });
    layout.edges.forEach((edge, i) => {
      const points = edge.points.map(toCanvas);
      board.path("edge-" + i, points, { color: P.faint, width: 2 });
      const at = positionAlong(edge.points, mode === "backward" ? 1 - p : p),
        [x, y] = toCanvas({ x: at[0], y: at[1] });
      const blocked = mode === "backward" && edges[i].contribution === 0;
      board.mark("flow-" + i, "circle", {
        cx: x,
        cy: y,
        r: 3,
        fill: flowColor,
        opacity: blocked ? 0 : 1,
      });
      const end = points.at(-1),
        previous = points.at(-2),
        a = Math.atan2(end[1] - previous[1], end[0] - previous[0]);
      board.path(
        "arrow-" + i,
        [
          [end[0] - 6 * Math.cos(a - 0.5), end[1] - 6 * Math.sin(a - 0.5)],
          end,
          [end[0] - 6 * Math.cos(a + 0.5), end[1] - 6 * Math.sin(a + 0.5)],
        ],
        { color: P.muted, width: 1.5 },
      );
    });
    nodes.forEach((node) => {
      const box = layout.nodes[node.id],
        [cx, cy] = toCanvas(box),
        w = box.width * scale,
        h = box.height * scale,
        active = node.id === selected;
      const rect = board.rect(
        "node-" + node.id,
        cx - w / 2,
        cy - h / 2,
        w,
        h,
        active ? "#e1edf0" : "#f0f0e9",
        {
          rx: 8,
          stroke: active ? P.blue : P.faint,
          "stroke-width": active ? 1.8 : 1,
        },
      );
      board.text(
        "label-" + node.id,
        node.label ?? node.id,
        cx,
        cy - (node.value === undefined ? -5 : 5),
        { anchor: "middle", size: 14, weight: 500 },
      );
      if (node.value !== undefined)
        board.text(
          "value-" + node.id,
          mode === "backward" && node.gradient !== undefined
            ? "g = " + fmt(node.gradient)
            : fmt(node.value),
          cx,
          cy + 15,
          { anchor: "middle", size: 13, color: flowColor },
        );
      if (stateKey)
        board.selectable(rect, {
          label: node.label ?? node.id,
          selected: active,
          onSelect: () => context.controls.setState(stateKey, node.id),
        });
    });
    return {
      nodes,
      edges,
      layout,
      mode,
      progress: p,
      convention:
        "Moving markers explain graph connections; they do not claim hardware timing or a scheduled execution order",
    };
  }
  function drawAutograd(
    board,
    {
      nodes,
      output = null,
      outputs = null,
      seeds = null,
      progress = 0,
      mode = "both",
      title = "前向数值与反向梯度",
      selected = null,
      stateKey = null,
    } = {},
    context = {},
  ) {
    const trace = traceGraph(nodes, { output, outputs, seeds }),
      p = V.clamp(progress, 0, 1),
      currentMode = mode === "both" ? (p < 0.5 ? "forward" : "backward") : mode,
      phase = mode === "both" ? (p < 0.5 ? p * 2 : (p - 0.5) * 2) : p;
    const graph = drawGraph(
      board,
      {
        nodes: trace.nodes.map((n) => ({ ...n, label: n.label ?? n.id })),
        edges: trace.edges,
        progress: phase,
        mode: currentMode,
        title,
        note:
          currentMode === "backward"
            ? "g = 目标加权和对节点的导数"
            : "蓝色数值：前向计算",
        selected,
        stateKey,
      },
      context,
    );
    return { trace, graph, mode: currentMode, phase };
  }
  V.traceGraph = traceGraph;
  V.graphLayout = graphLayout;
  Object.assign(V.components, { graph: drawGraph, autograd: drawAutograd });
})(window);
