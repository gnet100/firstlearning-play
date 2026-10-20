// New Hila lines for "מעגל האותיות" (15.10.2026, after the literacy review games/letter-circle/voice-lines-review.md).
// For the voice thread: add to voice/lines.js and the word bank, then record. A missing clip stays silent (never the browser voice).
[
  // The question is always "אֵיפֹה הָאוֹת ___?". Short part, followed in the game by the name clip (name_* / fin_*):
  { id: "lc_where", kind: "line", text: "אֵיפֹה הָאוֹת", say: { "אֵיפֹה": "ˈej.fo", "הָאוֹת": "ha.ˈʔot" } },
  // Whole questions, preferred by the game when present (named lc_ + the name clip). lc_name_zayin is REQUIRED as a whole clip:
  // the game never joins lc_where + name_zayin.
  { id: "lc_name_zayin", kind: "line", text: "אֵיפֹה הָאוֹת זַיִן?", say: { "אֵיפֹה": "ˈej.fo", "הָאוֹת": "ha.ˈʔot", "זַיִן": "ˈza.jin" } },
  // optional, same pattern for the other 26: lc_name_alef "אֵיפֹה הָאוֹת אָלֶף?" ... lc_fin_nun "אֵיפֹה הָאוֹת נוּן סוֹפִית?"
  // (use each letter's say-hint from its name_* / fin_* line)
  { id: "lc_start", kind: "line", text: "מַקְשִׁיבִים לַשֵּׁם שֶׁל הָאוֹת, וְנוֹגְעִים בָּהּ.", say: { "בָּהּ": "ˈba", "הָאוֹת": "ha.ˈʔot" } },
  // by the child's profile (boy/girl); no neutral version
  { id: "lc_warm_m", kind: "line", text: "גַּע בַּכּוֹכָב", say: { "גַּע": "ˈɡa", "בַּכּוֹכָב": "ba.ko.ˈxav" } },
  { id: "lc_warm_f", kind: "line", text: "גְּעִי בַּכּוֹכָב", say: { "גְּעִי": "ˈɡʔi", "בַּכּוֹכָב": "ba.ko.ˈxav" }, pause: { "גְּעִי": "80ms" } },
]
