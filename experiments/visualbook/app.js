function startVisualbook(data) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const controllers = [];
  const follow = document.querySelector("#follow");
  const original = document.querySelector("#original");
  const announce = (el, text) => {
    el.querySelector(".figure-status").textContent = text;
  };
  for (const f of data.figures) {
    const el = document.getElementById("figure-" + f.id);
    if (!el) continue;
    const graphic = el.querySelector(".graphic"),
      live = graphic.querySelector(".live");
    const params = Object.fromEntries(f.controls.map((c) => [c.key, c.value]));
    let state = f.states[0].key,
      manual = false,
      lastWidth = 0,
      reservedWidth = 0;
    const fn = data.renderers[f.id];
    const c = {
      f,
      el,
      params,
      get state() {
        return state;
      },
      get manual() {
        return manual;
      },
      setState(key, user = false) {
        state = key;
        manual = user;
        draw();
      },
      resume() {
        manual = false;
        for (const control of f.controls) {
          params[control.key] = control.value;
          const input = el.querySelector('[data-param="' + control.key + '"]');
          input.value = control.value;
          input.nextElementSibling.value = control.value;
        }
        update();
        draw();
      },
      facts: null,
      draw,
    };
    function draw() {
      const width = Math.floor(graphic.clientWidth);
      if (!width) return;
      try {
        if (reservedWidth !== width) {
          const examples = [
            Object.fromEntries(f.controls.map((c) => [c.key, c.value])),
          ];
          for (const control of f.controls)
            for (const value of [control.min, control.max])
              examples.push({ ...examples[0], [control.key]: value });
          let maxHeight = 0;
          for (const s of f.states)
            for (const p of examples) {
              const svg = fn({ width, state: s.key, params: p }).svg;
              const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
              const node = doc.documentElement;
              const box = node
                .getAttribute("viewBox")
                .trim()
                .split(/\s+/)
                .map(Number);
              if (
                box.length !== 4 ||
                !box.every(Number.isFinite) ||
                box[2] <= 0
              )
                throw Error("Invalid SVG viewBox");
              maxHeight = Math.max(maxHeight, (box[3] * width) / box[2]);
            }
          graphic.style.minHeight = Math.ceil(maxHeight) + "px";
          reservedWidth = width;
        }
        const value = fn({ width, state, params });
        const ids = [...value.svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        let svg = themeSvg(value.svg);
        for (const id of ids) {
          const prefixed = f.id + "-" + id;
          svg = svg
            .replaceAll('id="' + id + '"', 'id="' + prefixed + '"')
            .replaceAll("url(#" + id + ")", "url(#" + prefixed + ")");
        }
        live.innerHTML = svg;
        c.facts = value.facts;
        lastWidth = width;
        graphic.classList.remove("failed");
        el.querySelectorAll("[data-state]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.state === state)),
        );
        announce(el, manual ? "已停在你选择的状态。" : "");
        sizePolicy();
      } catch (error) {
        graphic.classList.add("failed");
        announce(el, "互动图暂不可用，已显示静态图。");
        c.error = String(error);
      }
    }
    el.querySelectorAll("[data-state]").forEach((b) =>
      b.addEventListener("click", () => c.setState(b.dataset.state, true)),
    );
    el.querySelectorAll("[data-param]").forEach((input) =>
      input.addEventListener("input", () => {
        params[input.dataset.param] = Number(input.value);
        input.nextElementSibling.value = input.value;
        manual = true;
        draw();
      }),
    );
    el.querySelector(".reset").addEventListener("click", () => c.resume());
    el.querySelector(".fig-controls").addEventListener("toggle", sizePolicy);
    const observer = new ResizeObserver(() => {
      if (Math.floor(graphic.clientWidth) !== lastWidth) draw();
    });
    observer.observe(graphic);
    controllers.push(c);
    draw();
  }
  let scheduled = false;
  function update() {
    scheduled = false;
    if (!follow.checked || document.body.classList.contains("original")) return;
    const line = Math.min(innerHeight * 0.48, 380);
    for (const c of controllers) {
      if (c.manual) continue;
      const scope = c.el.closest(".viz-scope").getBoundingClientRect();
      if (scope.bottom < 64 || scope.top > innerHeight) continue;
      let next = c.f.states[0].key;
      for (const s of c.f.states) {
        const b = document.getElementById(s.anchor);
        if (b && b.getBoundingClientRect().top <= line) next = s.key;
      }
      if (next !== c.state) c.setState(next);
    }
  }
  addEventListener(
    "scroll",
    () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  follow.addEventListener("change", () => {
    controllers.forEach((c) => c.resume());
    update();
  });
  original.addEventListener("click", () => {
    // Keep the same source paragraph in view when inline figures disappear.
    // Temporarily suppress browser scroll anchoring so it does not also apply
    // the same correction after our explicit source-anchor adjustment.
    document.documentElement.classList.add("changing-view");
    const line = Math.min(innerHeight * 0.48, 380);
    const nearby = [...document.querySelectorAll(".source-block")]
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter((x) => x.rect.bottom > 64 && x.rect.top < innerHeight)
      .sort(
        (a, b) => Math.abs(a.rect.top - line) - Math.abs(b.rect.top - line),
      )[0];
    const yes = document.body.classList.toggle("original");
    original.setAttribute("aria-pressed", String(yes));
    original.textContent = yes ? "显示图解" : "只看原文";
    if (nearby)
      scrollBy(0, nearby.el.getBoundingClientRect().top - nearby.rect.top);
    update();
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.documentElement.classList.remove("changing-view"),
      ),
    );
  });
  const originalParam = new URLSearchParams(location.search).get("original");
  if (originalParam === "1") original.click();
  const dialog = document.querySelector("#feedback-dialog"),
    note = document.querySelector("#feedback-note");
  let pending = null;
  document.querySelectorAll("[data-report]").forEach((button) =>
    button.addEventListener("click", () => {
      const c = controllers.find((c) => c.f.id === button.dataset.report);
      pending = {
        version: 1,
        section: data.section,
        attempt: data.attempt,
        sourceSha256: data.sourceSha256,
        candidateSha256: data.candidateSha256,
        figure: c.f.id,
        state: c.state,
        params: { ...c.params },
        anchors: c.f.states.map((s) => s.anchor),
        selection: String(getSelection()).slice(0, 500),
        kind: "reader-written feedback",
      };
      document.querySelector("#feedback-context").textContent = c.f.title;
      note.value = "";
      dialog.showModal();
      note.focus();
    }),
  );
  document.querySelector("#feedback-download").addEventListener("click", () => {
    if (!pending || !note.value.trim()) {
      note.focus();
      return;
    }
    const value = { ...pending, note: note.value.trim() };
    const link = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
    link.href = url;
    link.download = "visualbook-feedback-" + data.section + ".json";
    link.click();
    URL.revokeObjectURL(url);
    dialog.close();
  });
  // Avoid a fixed figure consuming most of a short screen. Static placement
  // remains available; reading position still selects a coarse state.
  function sizePolicy() {
    for (const c of controllers)
      c.el.classList.toggle(
        "no-sticky",
        c.el.getBoundingClientRect().height > innerHeight * 0.43 ||
          reduced.matches,
      );
  }
  addEventListener("resize", sizePolicy);
  reduced.addEventListener("change", sizePolicy);
  sizePolicy();
  update();
  window.visualbook = { controllers, update, sizePolicy };
}
