// Shared letter content for every letter game (scoring thread, 15.10.2026).
// Look-alike groups are a first guess from letter shapes (literacy advisor review, games/scoring/learner-model-review.md).
// After the March 2027 pilot, replace them with the pairs children really confuse. Edit here only, never inside a game.
(function (root) {
  "use strict";
  const FL = (root.FL = root.FL || {});
  FL.LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
  FL.FINALS = ["ך", "ם", "ן", "ף", "ץ"];
  FL.FINAL_BASE = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
  FL.isFinal = (l) => FL.FINALS.includes(l);
  // Groups of letters that look alike. "strong" first; "weak" ones are kept but marked for checking in the pilot.
  // Groups with a final letter are used only when finals are in play.
  FL.LOOKALIKE = [
    { g: ["ב", "כ"], strength: "strong" },   // the strongest pair
    { g: ["כ", "פ"], strength: "strong" },
    { g: ["ד", "ר", "ך"], strength: "strong" },
    { g: ["ה", "ח", "ת"], strength: "strong" },
    { g: ["ו", "ז", "י"], strength: "strong" },
    { g: ["ו", "ן"], strength: "strong" },
    { g: ["ס", "ם"], strength: "strong" },
    { g: ["ג", "נ"], strength: "strong" },
    { g: ["ע", "צ"], strength: "strong" },
    { g: ["ט", "מ"], strength: "weak" },
    { g: ["ה", "ק"], strength: "weak" },
  ];
  // Letters that look like the given one (no finals unless withFinals). Strong groups first.
  FL.lookalikesOf = function (l, withFinals) {
    const out = [];
    for (const s of ["strong", "weak"]) for (const { g, strength } of FL.LOOKALIKE) {
      if (strength !== s || !g.includes(l)) continue;
      for (const x of g) if (x !== l && !out.includes(x) && (withFinals || !FL.isFinal(x))) out.push(x);
    }
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
