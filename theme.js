// Ionic's dark colours switch on with this class; the app's own colours follow it too.
const DARK_CLASS = "ion-palette-dark";
const phoneDarkSetting = window.matchMedia("(prefers-color-scheme: dark)");
let chosenTheme = "system";

function refreshTheme() {
  const isDark = chosenTheme === "dark" || (chosenTheme !== "light" && phoneDarkSetting.matches);
  document.documentElement.classList.toggle(DARK_CLASS, isDark);
}

// "light" and "dark" force a theme; "system" follows the phone's setting, including when
// the phone switches while the app is open.
export function applyTheme(theme) {
  chosenTheme = theme;
  refreshTheme();
}

phoneDarkSetting.addEventListener("change", refreshTheme);
