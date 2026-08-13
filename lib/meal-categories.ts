const CATEGORY_PATTERNS: Array<[string, RegExp]> = [
  ["Dairy", /\b(milk|yogurt|yoghurt|cheese|labneh|laban|raita)\b/i],
  ["Fruit", /\b(apple|apples|banana|berries|blueberries|strawberr(?:y|ies)|orange|mango|grapes?|pear|peach|kiwi|melon|pineapple|papaya)\b/i],
  ["Nuts", /\b(almonds?|cashews?|walnuts?|pistachios?|peanuts?|pecans?|hazelnuts?|chia seeds?|flaxseeds?)\b/i],
  ["Legume", /\b(lentils?|beans?|chickpeas?|dal|chana|rajma|hummus|foul medames)\b/i],
  ["Protein", /\b(chicken|salmon|cod|fish|tuna|turkey|beef|lamb|mutton|prawn|shrimp|eggs?|tofu)\b/i],
  ["Vegetable", /\b(artichokes?|asparagus|avocado|bell peppers?|broccoli|brussels sprouts?|cabbage|carrots?|cauliflower|celery|cucumber|eggplant|lettuce|mushrooms?|okra|spinach|tomatoes?|zucchini)\b/i],
  ["Grains", /\b(barley|brown rice|rice|oats?|quinoa|bread|pasta|couscous|bulgur|dosa|idli|upma)\b/i],
];

export function getPlanningCategory(category: string | null, foodName: string) {
  if (category && category !== "Uncategorized") return category;
  return CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(foodName))?.[0] || category || "Uncategorized";
}

export function pickRotatingFood<T extends { name: string }>(
  pool: T[],
  usedToday: Set<string>,
  lastUsedDay: Map<string, number>,
  day: number,
  rotation: number
) {
  const available = pool.filter((food) => !usedToday.has(food.name));
  if (available.length === 0) return null;
  const oldestDay = Math.min(...available.map((food) => lastUsedDay.get(food.name) || 0));
  const leastRecent = available
    .filter((food) => (lastUsedDay.get(food.name) || 0) === oldestDay)
    .sort((a, b) => a.name.localeCompare(b.name));
  return leastRecent[(day + rotation) % leastRecent.length];
}
