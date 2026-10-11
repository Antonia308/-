// 从 index.html 提取菜谱数据，生成 data/recipes.json 与 data/flex-recipes.mjs，并重播种 SQLite 数据库。
// 用法：node tools/sync-recipes.mjs [--force]
// index.html 是菜谱数据的唯一来源；修改其中的菜谱后运行 npm run db:sync 即可同步。
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtmlPath = resolve(root, "index.html");
const dataDir = resolve(root, "data");
const tmpDir = resolve(dataDir, ".sync-tmp");
const force = process.argv.includes("--force");

const source = readFileSync(indexHtmlPath, "utf8");

// —— 提取工具：带字符串感知的括号匹配 ——

function scanToMatching(text, openIndex) {
  const openChar = text[openIndex];
  const pairs = { "[": "]", "{": "}", "(": ")" };
  const closeChar = pairs[openChar];
  if (!closeChar) throw new Error(`不支持的括号：${openChar}`);
  let depth = 0;
  let quote = null;
  let index = openIndex;
  while (index < text.length) {
    const char = text[index];
    if (quote) {
      if (char === "\\") { index += 2; continue; }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; index += 1; continue; }
    if (char === openChar) depth += 1;
    else if (char === closeChar) depth -= 1;
    index += 1;
    if (depth === 0) return index; // 返回闭合括号之后的索引
  }
  throw new Error(`括号不匹配，起点偏移 ${openIndex}`);
}

function extractLiteral(text, anchor, openChar) {
  const anchorIndex = text.lastIndexOf(anchor);
  if (anchorIndex < 0) throw new Error(`未找到锚点：${anchor}`);
  // 锚点自身以括号结尾时，该括号就是字面量的起点；否则向后搜索第一个括号
  const openIndex = text[anchorIndex + anchor.length - 1] === openChar
    ? anchorIndex + anchor.length - 1
    : text.indexOf(openChar, anchorIndex + anchor.length);
  if (openIndex < 0) throw new Error(`锚点后未找到 ${openChar}：${anchor}`);
  return text.slice(openIndex, scanToMatching(text, openIndex));
}

function extractFunction(text, signature) {
  const anchor = `function ${signature}`;
  const anchorIndex = text.lastIndexOf(anchor);
  if (anchorIndex < 0) throw new Error(`未找到函数：${anchor}`);
  const openIndex = text.indexOf("{", anchorIndex + anchor.length);
  if (openIndex < 0) throw new Error(`函数后未找到 {：${anchor}`);
  return text.slice(anchorIndex, scanToMatching(text, openIndex));
}

const evaluate = (literal) => new Function(`return ${literal}`)();

function assert(condition, message) {
  if (!condition) throw new Error(`校验失败：${message}`);
}

// —— 提取数据 ——

const initialRecipes = evaluate(extractLiteral(source, "const recipes = [", "["));
const nutritionEstimates = evaluate(extractLiteral(source, "const nutritionEstimates = {", "{"));
const pantryStaplesArray = evaluate(extractLiteral(source, "const pantryStaples = new Set(", "["));
const aliases = evaluate(extractLiteral(source, "const aliases = {", "{"));

// 与浏览器运行时（index.html 中 healthyRecipe）保持一致的实现，仅用于求值 recipes.push 语句
const healthyRecipeImpl = function healthyRecipe(name, icon, time, kcal, protein, ingredients, steps, oil = "5克", salt = "1克") {
  return { name, icon, time, level: "少油少盐", kcal, protein, oil, salt, ingredients, steps };
};

const pushed = [];
const collector = { push: (...items) => pushed.push(...items) };
let searchFrom = 0;
while (true) {
  const statementIndex = source.indexOf("recipes.push(", searchFrom);
  if (statementIndex < 0) break;
  const openIndex = source.indexOf("(", statementIndex);
  const endIndex = scanToMatching(source, openIndex);
  new Function("recipes", "healthyRecipe", source.slice(statementIndex, endIndex))(collector, healthyRecipeImpl);
  searchFrom = endIndex;
}

// 前 11 道菜的营养字段在浏览器里由 nutritionEstimates 运行时注入（index.html 中 recipes.forEach），这里复刻
for (const recipe of initialRecipes) {
  const [kcal, protein] = nutritionEstimates[recipe.name];
  assert(Array.isArray(nutritionEstimates[recipe.name]), `${recipe.name} 缺少营养估算`);
  Object.assign(recipe, { kcal, protein, oil: "5克", salt: "1克" });
}

const allRecipes = [...initialRecipes, ...pushed];

// —— 写入前的校验 ——

assert(allRecipes.length === 93, `菜谱总数应为 93，实际 ${allRecipes.length}`);
assert(new Set(allRecipes.map((recipe) => recipe.name)).size === allRecipes.length, "菜名存在重复");
for (const recipe of allRecipes) {
  assert(typeof recipe.name === "string" && recipe.name, "存在缺菜名的菜谱");
  assert(typeof recipe.icon === "string", `${recipe.name} 缺少 icon`);
  assert(typeof recipe.time === "number", `${recipe.name} 的 time 不是数字`);
  assert(typeof recipe.level === "string" && recipe.level, `${recipe.name} 缺少 level`);
  assert(typeof recipe.kcal === "number", `${recipe.name} 缺少 kcal`);
  assert(typeof recipe.protein === "number", `${recipe.name} 缺少 protein`);
  assert(typeof recipe.oil === "string", `${recipe.name} 缺少 oil`);
  assert(typeof recipe.salt === "string", `${recipe.name} 缺少 salt`);
  assert(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0, `${recipe.name} 缺少食材`);
  assert(recipe.ingredients.every((pair) => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" && typeof pair[1] === "string"), `${recipe.name} 食材格式不正确`);
  assert(Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.every((step) => typeof step === "string"), `${recipe.name} 缺少做法步骤`);
}
assert(pantryStaplesArray.length > 0 && pantryStaplesArray.every((name) => typeof name === "string"), "pantryStaples 格式不正确");
assert(Object.keys(aliases).length > 0, "aliases 为空");

// —— 生成产物 ——

const recipesData = { aliases, pantryStaples: pantryStaplesArray, recipes: allRecipes };
const recipesJson = JSON.stringify(recipesData, null, 2);
const canonicalSource = extractFunction(source, "canonical(name)");
const flexibleSource = extractFunction(source, "generateFlexibleRecipes(available)");
const coreSource = extractFunction(source, 'generateWeeklyPlanCore(staticRecipes, inputIngredients, seedInput = "")');
const flexModule = `// 自动生成文件，请勿手动修改。
// 菜谱数据的唯一来源是 index.html；修改后运行 npm run db:sync 重新生成本文件与 recipes.json。
import recipesData from "./recipes.json" with { type: "json" };

export const recipes = recipesData.recipes;
export const pantryStaples = new Set(recipesData.pantryStaples);
export const aliases = recipesData.aliases;

${canonicalSource}
export { canonical };

${flexibleSource}
export { generateFlexibleRecipes };

${coreSource}
export { generateWeeklyPlanCore };
`;

const finalJsonPath = resolve(dataDir, "recipes.json");
const finalFlexPath = resolve(dataDir, "flex-recipes.mjs");
const existingJson = existsSync(finalJsonPath) ? readFileSync(finalJsonPath, "utf8") : null;
const existingFlex = existsSync(finalFlexPath) ? readFileSync(finalFlexPath, "utf8") : null;
if (!force && existingJson === recipesJson && existingFlex === flexModule) {
  console.log("菜谱数据与 data/recipes.json、data/flex-recipes.mjs 一致，跳过同步。需要强制重播种时加 --force。");
  process.exit(0);
}

// —— 冒烟测试：在临时目录生成并导入，验证提取出的函数行为正确 ——

mkdirSync(tmpDir, { recursive: true });
writeFileSync(resolve(tmpDir, "recipes.json"), recipesJson);
writeFileSync(resolve(tmpDir, "flex-recipes.mjs"), flexModule);
try {
  const moduleUrl = pathToFileURL(resolve(tmpDir, "flex-recipes.mjs")).href + `?t=${Date.now()}`;
  const { canonical, generateFlexibleRecipes, generateWeeklyPlanCore } = await import(moduleUrl);
  assert(canonical("西红柿") === "番茄", `canonical("西红柿") 应为 番茄，实际 ${canonical("西红柿")}`);
  assert(canonical("猪里脊") === "猪肉", `canonical("猪里脊") 应为 猪肉，实际 ${canonical("猪里脊")}`);
  assert(canonical("平菇") === "蘑菇", `canonical("平菇") 应为 蘑菇，实际 ${canonical("平菇")}`);
  // 组合菜生成与浏览器端逻辑一致：isAlreadyCovered 会跳过已被静态菜谱覆盖的组合
  const combos = [
    ...generateFlexibleRecipes(new Set(["番茄", "鸡蛋", "豆腐"])),
    ...generateFlexibleRecipes(new Set(["鸡蛋", "西葫芦"])),
    ...generateFlexibleRecipes(new Set(["豆腐", "蘑菇"]))
  ];
  assert(Array.isArray(combos) && combos.length > 0, "组合菜生成结果为空");
  assert(combos.every((recipe) => recipe.dynamic === true && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && Array.isArray(recipe.steps) && recipe.steps.length > 0), "组合菜字段不完整");
  assert(combos.some((recipe) => recipe.name.includes("滑蛋")), "应生成鸡蛋类组合菜");
  assert(combos.some((recipe) => recipe.name.includes("豆腐煲")), "应生成豆腐类组合菜");
  assert(combos.some((recipe) => recipe.name.includes("双蔬快炒")), "应生成双蔬快炒组合菜");
  // 周食谱核心：结构正确、可复现、极端食材降级
  const plan = generateWeeklyPlanCore(recipesData.recipes, ["番茄", "鸡蛋", "豆腐"]);
  assert(plan.days.length === 7 && plan.days.every((day) => day.meals.length === 2), "周食谱应为 7 天 × 2 餐");
  assert(plan.days.flatMap((day) => day.meals).filter((meal) => meal.recipe).length === 14, "周食谱应排满 14 餐");
  assert(JSON.stringify(generateWeeklyPlanCore(recipesData.recipes, ["番茄", "鸡蛋", "豆腐"]).days) === JSON.stringify(plan.days), "同一食材清单的周食谱应可复现");
  assert(generateWeeklyPlanCore(recipesData.recipes, ["榴莲"]).days.every((day) => day.meals.every((meal) => meal.recipe === null)), "配不到的食材应返回空餐位");
  console.log(`冒烟测试通过：组合菜 ${[...new Set(combos.map((recipe) => recipe.name))].join("、")}；周食谱 ${plan.stats.candidateCount} 道候选、${plan.stats.distinctDishes} 道不重样`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

// —— 原子写入产物 ——

mkdirSync(dataDir, { recursive: true });
writeFileSync(finalJsonPath + ".tmp", recipesJson);
writeFileSync(finalFlexPath + ".tmp", flexModule);
renameSync(finalJsonPath + ".tmp", finalJsonPath);
renameSync(finalFlexPath + ".tmp", finalFlexPath);
console.log(`已写出 data/recipes.json（${allRecipes.length} 道菜）与 data/flex-recipes.mjs`);

// —— 重播种数据库 ——

const { initDb, reseed } = await import("../db.mjs");
initDb();
reseed();
console.log("数据库 data/recipes.db 已重播种完成。");
