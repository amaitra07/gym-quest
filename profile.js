import { button, byId, el, fieldRow, fieldText, focusField, insetList, scrollToTop, setHeader, showToast } from "./dom.js";

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

// A field in a settings-style row: the label on the left, what you type on the right.
function field(label, attributes) {
  return el("ion-input", { label, class: "value-end", autocomplete: "off", ...attributes });
}

// A row of exclusive choices; the selected one slides under your finger like on an iPhone.
function segmented(label, choices, current, onPick) {
  return el("ion-segment", {
    "aria-label": label,
    value: current,
    onIonChange: (event) => onPick(event.detail.value),
  }, ...choices.map(([value, text]) => el("ion-segment-button", { value }, el("ion-label", { text }))));
}

function sectionTitle(text) {
  return el("h2", { class: "section-title", text });
}

// `actions` are { onBack, onSave(profile), onTheme(theme), onUnit(unit), onLoadSample, onClearData }.
export function renderProfile(profile, unit, theme, actions) {
  const saved = profile ?? {};
  const imperial = unit === "lb";
  const height = saved.heightCm ? cmToFeetInches(saved.heightCm) : null;
  const weightShown = saved.weightKg ? roundTo(imperial ? kgToLb(saved.weightKg) : saved.weightKg, 1) : "";

  const inputs = {
    name: field("Name", { type: "text", maxlength: String(MAX_NAME_LENGTH), placeholder: "What should we call you?", value: saved.name ?? "" }),
    age: field("Age", { type: "number", inputmode: "numeric", min: "5", max: "120", placeholder: "Not set", value: saved.age ?? "" }),
    feet: field("Height (ft)", { type: "number", inputmode: "numeric", min: "2", max: "8", placeholder: "ft", value: height?.feet ?? "" }),
    inches: field("Height (in)", { type: "number", inputmode: "numeric", min: "0", max: "11", placeholder: "in", value: height?.inches ?? "" }),
    cm: field("Height (cm)", { type: "number", inputmode: "decimal", min: "60", max: "250", placeholder: "Not set", value: saved.heightCm ? roundTo(saved.heightCm, 0) : "" }),
    weight: field(imperial ? "Weight (lb)" : "Weight (kg)", { type: "number", inputmode: "decimal", min: "20", placeholder: "Not set", value: weightShown }),
  };
  const goal = el("ion-select", { label: "Main goal", interface: "action-sheet", value: saved.goal ?? "" },
    el("ion-select-option", { value: "", text: "Not set" }),
    ...GOALS.map((text) => el("ion-select-option", { value: text, text })));

  function save() {
    const result = parseProfileForm({
      name: fieldText(inputs.name),
      age: fieldText(inputs.age),
      feet: fieldText(inputs.feet),
      inches: fieldText(inputs.inches),
      cm: fieldText(inputs.cm),
      weight: fieldText(inputs.weight),
      goal: goal.value,
    }, unit);
    if (result.error) {
      showToast(result.error);
      focusField(inputs[result.field]);
      return;
    }
    actions.onSave(result.profile);
  }

  setHeader("profile", {
    title: "Profile",
    backLabel: "Home",
    onBack: actions.onBack,
    end: [el("ion-button", { strong: "true", text: "Save", onclick: save })],
  });
  byId("profileContent").replaceChildren(
    sectionTitle("About you"),
    insetList(
      fieldRow(inputs.name),
      fieldRow(inputs.age),
      fieldRow(inputs.weight),
      ...(imperial ? [fieldRow(inputs.feet), fieldRow(inputs.inches)] : [fieldRow(inputs.cm)]),
      fieldRow(goal)),
    button("primary", { text: "Save profile", onclick: save }),
    sectionTitle("Settings"),
    el("p", { class: "muted setting-label", text: "Appearance" }),
    segmented("Appearance", THEME_CHOICES, theme, actions.onTheme),
    el("p", { class: "muted setting-label", text: "Units for weight and height" }),
    segmented("Units", UNIT_CHOICES, unit, actions.onUnit),
    sectionTitle("Try it out"),
    insetList(
      el("ion-item", { button: "true", detail: "false", onclick: actions.onLoadSample },
        el("ion-label", { color: "primary", text: "Load sample workouts" })),
      el("ion-item", { button: "true", detail: "false", onclick: actions.onClearData },
        el("ion-label", { color: "danger", text: "Clear workout data" }))),
    el("p", { class: "muted list-note", text: "Sample workouts fill the app with a Push / Pull / Legs plan and four weeks of history to test with. Clearing deletes every workout, saved workout and your weekly plan; your profile and settings stay." }));
  scrollToTop("profile");
}
