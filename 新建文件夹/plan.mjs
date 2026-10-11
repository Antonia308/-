// 一周食谱排菜：菜谱数据来自 SQLite 数据库（db.mjs）。
// 排菜核心 generateWeeklyPlanCore 与浏览器端离线兜底共用同一实现（由 npm run db:sync 从 index.html 原样同步生成），
// 唯一的差异是传入的菜谱列表：服务器用数据库读出的菜谱，浏览器离线时用内置菜谱。
import { getAllRecipes } from "./db.mjs";
import { canonical, generateWeeklyPlanCore } from "./data/flex-recipes.mjs";

export { canonical };

export function generateWeeklyPlan(inputIngredients, seedInput = "") {
  return generateWeeklyPlanCore(getAllRecipes(), inputIngredients, seedInput);
}
