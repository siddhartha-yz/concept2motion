/* Long formulas remain intact and locally scrollable; they never widen the page. */
(function () {
  const targets = [
    ...document.querySelectorAll(
      ".source-block .katex-display,.vh-annotation .katex-display,.source-block .katex:not(.katex-display>.katex),.vh-annotation .katex:not(.katex-display>.katex)",
    ),
  ];
  for (const node of targets)
    node.addEventListener("keydown", (event) => {
      if (
        !node.classList.contains("vh-math-scroll") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        node.scrollLeft += event.key === "ArrowLeft" ? -48 : 48;
      else if (event.key === "Home") node.scrollLeft = 0;
      else if (event.key === "End") node.scrollLeft = node.scrollWidth;
      else return;
      event.preventDefault();
    });
  function refresh() {
    for (const node of targets) {
      const long = node.scrollWidth > node.clientWidth + 2;
      node.classList.toggle("vh-math-scroll", long);
      if (long) {
        node.setAttribute("tabindex", "0");
        node.setAttribute("role", "region");
        node.setAttribute("aria-label", "长公式，可用左右方向键横向查看");
      } else {
        node.removeAttribute("tabindex");
        node.removeAttribute("role");
        node.removeAttribute("aria-label");
      }
    }
  }
  document.fonts.ready.then(refresh);
  addEventListener("resize", refresh, { passive: true });
})();
