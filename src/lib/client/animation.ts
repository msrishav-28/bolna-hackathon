/** Run decorative canvas work only while visible, with a static reduced-motion frame. */
export function animateWhenVisible(element: Element, draw: () => void) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let visible = true;
  const tick = () => {
    if (!visible || document.hidden) return;
    draw();
    if (!reduced.matches) frame = requestAnimationFrame(tick);
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    tick();
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    restart();
  });
  observer.observe(element);
  document.addEventListener("visibilitychange", restart);
  reduced.addEventListener("change", restart);
  restart();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", restart);
    reduced.removeEventListener("change", restart);
  };
}
