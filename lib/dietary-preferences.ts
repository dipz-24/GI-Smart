export type DietPreference = "omnivore" | "vegetarian" | "vegan";

const ANIMAL_FOOD = /\b(chicken|turkey|beef|steak|lamb|mutton|pork|bacon|ham|salmon|tuna|cod|fish|prawn|shrimp|sardine|anchovy|meat|shawarma|kebab)\b/i;
const DAIRY_OR_EGG = /\b(milk|cheese|yogurt|yoghurt|labneh|laban|raita|paneer|cream|butter|ghee|eggs?)\b/i;
const PLANT_DAIRY = /\b(almond|soy|oat|coconut) milk\b/i;
const GLUTEN_GRAIN = /\b(wheat|barley|rye|bread|naan|pasta|couscous|bulgur|seitan|paratha|chapati|roti)\b/i;
const GLUTEN_FREE_GRAIN = /\b(rice|quinoa|corn|buckwheat|millet)\b/i;

export function isFoodAllowed(
  foodName: string,
  planningCategory: string,
  diet: DietPreference,
  glutenFree: boolean
) {
  if (diet !== "omnivore" && ANIMAL_FOOD.test(foodName)) return false;
  if (diet === "vegan" && DAIRY_OR_EGG.test(foodName) && !PLANT_DAIRY.test(foodName)) return false;

  if (diet === "vegan") {
    const plantCategory = ["Fruit", "Vegetable", "Grains", "Legume", "Nuts"].includes(planningCategory);
    const recognizedPlantProtein = /\b(tofu|tempeh|seitan)\b/i.test(foodName);
    if (!plantCategory && !recognizedPlantProtein && !PLANT_DAIRY.test(foodName)) return false;
  }

  if (glutenFree) {
    if (GLUTEN_GRAIN.test(foodName)) return false;
    if (planningCategory === "Grains" && !GLUTEN_FREE_GRAIN.test(foodName)) return false;
  }

  return true;
}
