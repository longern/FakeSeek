if (window.matchMedia("(display-mode: standalone)").matches) {
  window.history.pushState({}, "");

  window.addEventListener("popstate", () => {
    window.history.pushState({}, "");
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  });
}
