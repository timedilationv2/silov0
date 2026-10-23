// Share the existing workspace preference without accessing document storage.
const themeButton = document.getElementById("theme");
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "Light theme" : "Dark theme";
  themeButton.setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
}
let initialTheme = matchMedia("(prefers-color-scheme: light)").matches
  ? "light"
  : "dark";
try {
  initialTheme = localStorage.getItem("silov0-theme") || initialTheme;
} catch {
  /* Optional preference. */
}
applyTheme(initialTheme === "light" ? "light" : "dark");
themeButton.addEventListener("click", () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("silov0-theme", theme);
  } catch {
    /* Optional preference. */
  }
});
// Keep useful inbound links to the former long landing page working.
const legacyTargets = {
  "#architecture": "running.html#storage",
  "#cards": "documentation.html#cards",
  "#table": "documentation.html#table",
  "#live-demo": "documentation.html#live-demo",
  "#samples": "documentation.html#live-demo",
  "#case-study": "history.html",
  "#api-reference": "api.html",
};
function followLegacyLink() {
  const path = location.pathname;
  if (
    (path.endsWith("/") ||
      path.endsWith("/index.html") ||
      path.endsWith("/learn.html")) &&
    legacyTargets[location.hash]
  ) {
    location.replace(legacyTargets[location.hash]);
  }
  if (path.endsWith("/learn.html") && location.hash === "#overview")
    location.replace("index.html#overview");
}
window.addEventListener("hashchange", followLegacyLink);
followLegacyLink();
