import { byId, el, icon, showToast } from "./dom.js";

// The profile screen: details about you, plus settings. Height and weight are stored in
// centimetres and kilograms and shown in the unit system the app is set to (lb with feet
// and inches, or kg with centimetres), so switching units converts them.

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const MAX_NAME_LENGTH = 30;

export const GOALS = ["Build muscle", "Get stronger", "Lose fat", "Improve endurance", "Stay active"];
export const THEME_CHOICES = [["system", "Match phone"], ["light", "Light"], ["dark", "Dark"]];
const UNIT_CHOICES = [["lb", "lb · ft"], ["kg", "kg · cm"]];

const LIMITS = {
  age: [5, 120],
  feet: [2, 8],
  inches: [0, 11],
  heightCm: [60, 250],
  weightLb: [40, 800],
  weightKg: [20, 360],
};

export const lbToKg = (pounds) => pounds * KG_PER_LB;
export const kgToLb = (kilograms) => kilograms / KG_PER_LB;

export function cmToFeetInches(centimetres) {
  const totalInches = Math.round(centimetres / CM_PER_INCH);
  return { feet: Math.floor(totalInches / INCHES_PER_FOOT), inches: totalInches % INCHES_PER_FOOT };
}

export function feetInchesToCm(feet, inches) {
  return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
}

const roundTo = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

// "" becomes null (left blank); anything that is not a number becomes NaN.
function parseOptional(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed === "" ? null : Number(trimmed);
}

function outOfRange(value, [low, high]) {
  return value !== null && !(Number.isFinite(value) && value >= low && value <= high);
}

// Turns the text in the form into a profile to save, or { error, field } to show. Blank
// fields are allowed; filled ones must be sensible numbers.
export function parseProfileForm(form, unit) {
  const name = form.name.trim().slice(0, MAX_NAME_LENGTH);
  const age = parseOptional(form.age);
  if (outOfRange(age, LIMITS.age) || (age !== null && !Number.isInteger(age))) {
    return { error: "Enter your age as a whole number from 5 to 120.", field: "age" };
  }

  let heightCm = null;
  if (unit === "lb") {
    const feet = parseOptional(form.feet);
    const inches = parseOptional(form.inches);
    if (outOfRange(feet, LIMITS.feet) || (feet === null && inches !== null)) {
      return { error: "Enter your height in feet (2 to 8), then inches.", field: "feet" };
    }
    if (outOfRange(inches, LIMITS.inches)) {
      return { error: "Inches should be from 0 to 11.", field: "inches" };
    }
    if (feet !== null) heightCm = roundTo(feetInchesToCm(feet, inches ?? 0), 1);
  } else {
    const centimetres = parseOptional(form.cm);
    if (outOfRange(centimetres, LIMITS.heightCm)) {
      return { error: "Enter your height in centimetres, from 60 to 250.", field: "cm" };
    }
    heightCm = centimetres === null ? null : roundTo(centimetres, 1);
  }

  const weight = parseOptional(form.weight);
  if (outOfRange(weight, unit === "lb" ? LIMITS.weightLb : LIMITS.weightKg)) {
    const [low, high] = unit === "lb" ? LIMITS.weightLb : LIMITS.weightKg;
    return { error: `Enter your weight in ${unit}, from ${low} to ${high}.`, field: "weight" };
  }
  const weightKg = weight === null ? null : roundTo(unit === "lb" ? lbToKg(weight) : weight, 1);

  return { profile: { name, age, heightCm, weightKg, goal: GOALS.includes(form.goal) ? form.goal : "" } };
}

/* ---------- Screen ---------- */

function field(label, input) {
  return el("label", { class: "field" }, el("span", { text: label }), input);
}

function textInput(attributes) {
  return el("input", { class: "text-input", autocomplete: "off", ...attributes });
}

// A row of exclusive choices. The pressed state updates in place so typing elsewhere on
// the screen is not lost.
function segmented(label, choices, current, onPick) {
  const buttons = choices.map(([value, text]) => {
    const button = el("button", {
      type: "button",
      text,
      "aria-pressed": String(value === current),
      onclick: () => {
        for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
        onPick(value);
      },
    });
    return button;
  });
  return el("div", { class: "segmented", role: "group", "aria-label": label }, ...buttons);
}

// `actions` are { onBack, onSave(profile), onTheme(theme), onUnit(unit), onLoadSample, onClearData }.
export function renderProfile(profile, unit, theme, actions) {
  const saved = profile ?? {};
  const imperial = unit === "lb";
  const height = saved.heightCm ? cmToFeetInches(saved.heightCm) : null;
  const weightShown = saved.weightKg ? roundTo(imperial ? kgToLb(saved.weightKg) : saved.weightKg, 1) : "";

  const inputs = {
    name: textInput({ type: "text", maxlength: String(MAX_NAME_LENGTH), placeholder: "What should we call you?", value: saved.name ?? "" }),
    age: textInput({ type: "number", inputmode: "numeric", min: "5", max: "120", value: saved.age ?? "" }),
    feet: textInput({ type: "number", inputmode: "numeric", min: "2", max: "8", placeholder: "ft", value: height?.feet ?? "" }),
    inches: textInput({ type: "number", inputmode: "numeric", min: "0", max: "11", placeholder: "in", value: height?.inches ?? "" }),
    cm: textInput({ type: "number", inputmode: "decimal", min: "60", max: "250", value: saved.heightCm ? roundTo(saved.heightCm, 0) : "" }),
    weight: textInput({ type: "number", inputmode: "decimal", min: "20", value: weightShown }),
  };
  const goal = el("select", { class: "text-input", "aria-label": "Your main goal" },
    el("option", { value: "", text: "Not set" }),
    ...GOALS.map((text) => el("option", { value: text, text })));
  goal.value = saved.goal ?? "";

  function save() {
    const result = parseProfileForm({
      name: inputs.name.value,
      age: inputs.age.value,
      feet: inputs.feet.value,
      inches: inputs.inches.value,
      cm: inputs.cm.value,
      weight: inputs.weight.value,
      goal: goal.value,
    }, unit);
    if (result.error) {
      showToast(result.error);
      inputs[result.field].focus();
      return;
    }
    actions.onSave(result.profile);
  }

  byId("profileContent").replaceChildren(
    el("div", { class: "top-bar" },
      el("button", { class: "back-button", type: "button", onclick: actions.onBack }, icon("back"), "Home")),
    el("h1", { class: "screen-title", text: "Profile" }),
    el("section", { class: "panel profile-form" },
      el("h2", { text: "About you" }),
      field("Name", inputs.name),
      el("div", { class: "field-pair" },
        field("Age", inputs.age),
        field(imperial ? "Weight (lb)" : "Weight (kg)", inputs.weight)),
      imperial
        ? el("div", { class: "field-pair" }, field("Height (ft)", inputs.feet), field("Height (in)", inputs.inches))
        : field("Height (cm)", inputs.cm),
      field("Main goal", goal),
      el("button", { class: "primary-button", type: "button", text: "Save profile", onclick: save })),
    el("section", { class: "panel" },
      el("h2", { text: "Settings" }),
      el("p", { class: "muted setting-label", text: "Appearance" }),
      segmented("Appearance", THEME_CHOICES, theme, actions.onTheme),
      el("p", { class: "muted setting-label", text: "Units for weight and height" }),
      segmented("Units", UNIT_CHOICES, unit, actions.onUnit)),
    el("section", { class: "panel" },
      el("h2", { text: "Try it out" }),
      el("p", { class: "muted", text: "Fill the app with a Push / Pull / Legs plan and four weeks of sample history to test with." }),
      el("button", { class: "secondary-button", type: "button", text: "Load sample workouts", onclick: actions.onLoadSample }),
      el("p", { class: "muted", text: "Or start over: this deletes every workout, saved workout and your weekly plan. Your profile and settings stay." }),
      el("button", { class: "danger-button", type: "button", text: "Clear workout data", onclick: actions.onClearData })));
  window.scrollTo(0, 0);
}
