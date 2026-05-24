const jsonText = `{
  "socialSentiment": {
    "score": 50
  },
  "cons":`;
const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
if (jsonMatch) {
    console.log("Matched:\n", jsonMatch[0]);
} else {
    console.log("No match");
}
