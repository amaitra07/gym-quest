import { el, openSheet } from "./dom.js";

// Short plain-language instructions for the built-in exercises, for people who are new to
// them: what the exercise works and the few cues that matter most. Exercises a person
// names themselves have none.
const HOW_TOS = [
  ["Bench Press", "Chest, front of the shoulders and triceps", [
    "Lie on the bench with your eyes under the bar and your feet flat on the floor.",
    "Grip a little wider than your shoulders and lower the bar to the middle of your chest.",
    "Press straight back up until your arms are straight. Keep your hips on the bench.",
  ]],
  ["Incline Dumbbell Press", "Upper chest and front of the shoulders", [
    "Set the bench to a low incline and sit back with a dumbbell above each shoulder.",
    "Lower the dumbbells to the sides of your upper chest, elbows a little below your shoulders.",
    "Press up until your arms are straight, without banging the dumbbells together.",
  ]],
  ["Dips", "Chest, triceps and front of the shoulders", [
    "Hold yourself up on the bars with straight arms and your shoulders down.",
    "Bend your elbows and lower yourself until your upper arms are about level with the floor.",
    "Push back up to straight arms. Use the assisted machine if you cannot do five yet.",
  ]],
  ["Dumbbell Fly", "Chest", [
    "Lie on a bench with the dumbbells above your chest and your elbows slightly bent.",
    "Open your arms wide and lower slowly until you feel a stretch across your chest.",
    "Bring the dumbbells back together in a wide arc, keeping the same bend in your elbows.",
  ]],
  ["Overhead Press", "Shoulders and triceps", [
    "Stand with the bar resting on your upper chest, hands just outside your shoulders.",
    "Squeeze your stomach and glutes, then press the bar straight up past your face.",
    "Finish with the bar over the middle of your feet and your arms straight, then lower it under control.",
  ]],
  ["Dumbbell Shoulder Press", "Shoulders and triceps", [
    "Sit upright with a dumbbell at each shoulder, palms facing forward.",
    "Press both dumbbells up until your arms are straight above your head.",
    "Lower them back to shoulder height slowly. Keep your back against the seat.",
  ]],
  ["Lateral Raise", "Sides of the shoulders", [
    "Stand with a light dumbbell in each hand at your sides, elbows slightly bent.",
    "Raise your arms out to the sides until they are level with your shoulders.",
    "Lower slowly. If you have to swing your body, the weight is too heavy.",
  ]],
  ["Tricep Pushdown", "Triceps (back of the upper arm)", [
    "Face the cable machine and hold the bar or rope with your elbows tucked at your sides.",
    "Push down until your arms are straight, moving only your forearms.",
    "Let the handle rise slowly until your forearms are just above level.",
  ]],
  ["Overhead Tricep Extension", "Triceps (back of the upper arm)", [
    "Hold one dumbbell with both hands above your head, arms straight.",
    "Bend your elbows and lower the dumbbell behind your head, elbows pointing forward.",
    "Straighten your arms to lift it back up. Keep your upper arms still.",
  ]],
  ["Skull Crusher", "Triceps (back of the upper arm)", [
    "Lie on a bench holding a bar above your chest with straight arms.",
    "Bend only your elbows and lower the bar toward your forehead, slowly.",
    "Straighten your arms again. Keep your elbows pointing at the ceiling.",
  ]],
  ["Push-up", "Chest, shoulders and triceps", [
    "Put your hands under your shoulders and hold your body in a straight line from head to heels.",
    "Lower your chest to just above the floor, elbows at about 45 degrees from your sides.",
    "Push back up. Drop to your knees if your hips start to sag.",
  ]],
  ["Deadlift", "Back of the legs, glutes and back", [
    "Stand with the bar over the middle of your feet, then bend down and grip it just outside your legs.",
    "Flatten your back, chest up, and push the floor away to stand up with the bar close to your legs.",
    "Lower it by pushing your hips back first. Never round your back; start light.",
  ]],
  ["Barbell Row", "Upper back, lats and biceps", [
    "Hinge forward at the hips with a flat back and the bar hanging below your chest.",
    "Pull the bar to your lower ribs, leading with your elbows.",
    "Lower it under control. Do not stand up or jerk to move the weight.",
  ]],
  ["Dumbbell Row", "Upper back, lats and biceps", [
    "Put one hand and the same-side knee on a bench, back flat, dumbbell hanging from the other hand.",
    "Pull the dumbbell to your hip, keeping your elbow close to your body.",
    "Lower it all the way down. Do every rep on one side, then switch.",
  ]],
  ["Seated Cable Row", "Middle of the back, lats and biceps", [
    "Sit tall with your feet on the plates and a slight bend in your knees.",
    "Pull the handle to your stomach and squeeze your shoulder blades together.",
    "Let your arms straighten slowly. Do not lean back to pull.",
  ]],
  ["Lat Pulldown", "Lats (sides of the back) and biceps", [
    "Grip the bar wider than your shoulders and sit with your thighs under the pads.",
    "Pull the bar down to your upper chest, driving your elbows toward the floor.",
    "Let it rise slowly until your arms are straight. Lean back only a little.",
  ]],
  ["Pull-up", "Lats (sides of the back) and biceps", [
    "Hang from the bar with your hands a little wider than your shoulders, palms facing away.",
    "Pull until your chin is over the bar, without swinging or kicking.",
    "Lower all the way down slowly. Use a band or the assisted machine to start.",
  ]],
  ["Face Pull", "Back of the shoulders and upper back", [
    "Set a rope on the cable at face height and step back with your arms straight.",
    "Pull the rope toward your face, spreading your hands apart, elbows high.",
    "Pause, then return slowly. Use a light weight for this one.",
  ]],
  ["Bicep Curl", "Biceps (front of the upper arm)", [
    "Stand with a dumbbell in each hand, palms facing forward, elbows at your sides.",
    "Curl the weights up to your shoulders without moving your elbows forward.",
    "Lower slowly until your arms are straight. Do not swing your back.",
  ]],
  ["Hammer Curl", "Biceps and forearms", [
    "Stand with a dumbbell in each hand, palms facing each other.",
    "Curl the weights up, keeping your palms facing in the whole time.",
    "Lower slowly, with your elbows staying at your sides.",
  ]],
  ["Squat", "Front of the legs and glutes", [
    "Rest the bar across your upper back and stand with your feet shoulder-width apart, toes slightly out.",
    "Sit down and back, knees following your toes, until your thighs are about level with the floor.",
    "Stand up by pushing through your whole foot. Keep your chest up and your heels down.",
  ]],
  ["Leg Press", "Front of the legs and glutes", [
    "Sit with your back flat against the pad and your feet shoulder-width apart on the platform.",
    "Release the safety handles and lower the platform until your knees are at about 90 degrees.",
    "Push back up without locking your knees hard. Keep your lower back on the pad.",
  ]],
  ["Romanian Deadlift", "Back of the legs and glutes", [
    "Stand holding the bar at your thighs with a slight bend in your knees.",
    "Push your hips straight back and slide the bar down your legs, back flat.",
    "Stop when you feel a stretch behind your thighs, then stand up by driving your hips forward.",
  ]],
  ["Lunge", "Front of the legs and glutes", [
    "Stand tall, then take a long step forward.",
    "Lower until both knees are at about 90 degrees and your back knee is just above the floor.",
    "Push off your front foot to step back. Do the same number on each leg.",
  ]],
  ["Bulgarian Split Squat", "Front of the legs and glutes", [
    "Stand a big step in front of a bench and rest the top of one foot on it behind you.",
    "Lower straight down until your front thigh is about level with the floor.",
    "Push up through your front foot. Do every rep on one leg, then switch.",
  ]],
  ["Leg Curl", "Back of the legs", [
    "Set the pad just above your heels and line your knees up with the machine's hinge.",
    "Curl your heels toward your body as far as they go.",
    "Let the weight return slowly. Keep your hips on the pad.",
  ]],
  ["Calf Raise", "Calves", [
    "Stand with the balls of your feet on a step and your heels hanging off.",
    "Rise up on your toes as high as you can and pause for a moment.",
    "Lower your heels below the step for a stretch, slowly.",
  ]],
  ["Running", "Heart, lungs and legs", [
    "Start at a pace where you could still speak in short sentences.",
    "Keep your shoulders relaxed and take short, quick steps.",
    "If you are new, alternate a minute of running with a minute of walking.",
  ]],
  ["Cycling", "Heart, lungs and legs", [
    "Set the seat so your knee is slightly bent at the bottom of each pedal stroke.",
    "Pedal at a steady rhythm with enough resistance that you are breathing harder but can still talk.",
    "Keep your shoulders loose and avoid rocking side to side.",
  ]],
  ["Rowing", "Heart, lungs, legs and back", [
    "Strap your feet in, grip the handle and start with your knees bent and arms straight.",
    "Push with your legs first, then lean back slightly, then pull the handle to your lower ribs.",
    "Return in the reverse order: arms, body, then knees. Keep your back straight.",
  ]],
  ["Swimming", "Heart, lungs and the whole body", [
    "Start with a stroke you are comfortable with and an easy, steady pace.",
    "Breathe out under water and in when your face is clear.",
    "Rest at the wall when you need to; short lengths with breaks still count.",
  ]],
  ["Plank", "Stomach and core", [
    "Rest on your forearms and toes with your elbows under your shoulders.",
    "Hold a straight line from head to heels, squeezing your stomach and glutes.",
    "Stop when your hips start to sag or lift. Breathe normally the whole time.",
  ]],
  ["Wall Sit", "Front of the legs", [
    "Lean your back flat against a wall and slide down until your knees are at 90 degrees.",
    "Keep your knees above your ankles and your weight in your heels.",
    "Hold, with your hands off your legs. Stand up when your form slips.",
  ]],
];

// "Push-ups" and "push up" both find "Push-up".
function howToKey(name) {
  return name.trim().toLowerCase().replace(/[-\s]+/g, " ").replace(/s$/, "");
}

const HOW_TO_BY_KEY = new Map(HOW_TOS.map(([name, works, steps]) => [howToKey(name), { name, works, steps }]));

// The instructions for an exercise as { name, works, steps }, or null if the app has none.
export function howToFor(name) {
  return HOW_TO_BY_KEY.get(howToKey(name)) ?? null;
}

// Opens the instructions for an exercise in a sheet. Returns the sheet, or null if the
// exercise has no instructions.
export function showHowTo(name) {
  const howTo = howToFor(name);
  if (howTo === null) return null;
  const sheet = openSheet(howTo.name);
  sheet.content.replaceChildren(
    el("p", { class: "how-to-heading", text: "What it works" }),
    el("p", { class: "how-to-works", text: howTo.works }),
    el("p", { class: "how-to-heading", text: "How to do it" }),
    el("ol", { class: "how-to-steps" }, ...howTo.steps.map((step) => el("li", { text: step }))),
    el("p", { class: "muted how-to-note", text: "Start lighter than you think you need, and stop if something hurts." }));
  return sheet;
}
