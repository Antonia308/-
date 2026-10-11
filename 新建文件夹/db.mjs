// SQLite 菜谱数据库层。数据源为 data/recipes.json（由 npm run db:sync 从 index.html 生成）。
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dataDir = resolve(root, "data");
const dbPath = resolve(dataDir, "recipes.db");
const recipesJsonPath = resolve(dataDir, "recipes.json");

let db = null;

export function initDb() {
  if (db) return db;
  mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      time_minutes INTEGER NOT NULL,
      level TEXT NOT NULL,
      kcal REAL NOT NULL,
      protein REAL NOT NULL,
      oil TEXT NOT NULL,
      salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recipe_steps (
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name ON recipe_ingredients(name);
  `);
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM recipes").get();
  if (count === 0) insertRecipes(db, readRecipesData().recipes);
  return db;
}

function readRecipesData() {
  if (!existsSync(recipesJsonPath)) throw new Error("缺少 data/recipes.json，请先运行 npm run db:sync");
  return JSON.parse(readFileSync(recipesJsonPath, "utf8"));
}

function insertRecipesCore(database, recipeList) {
  const insertRecipe = database.prepare("INSERT INTO recipes (name, icon, time_minutes, level, kcal, protein, oil, salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertIngredient = database.prepare("INSERT INTO recipe_ingredients (recipe_id, name, amount, position) VALUES (?, ?, ?, ?)");
  const insertStep = database.prepare("INSERT INTO recipe_steps (recipe_id, position, text) VALUES (?, ?, ?)");
  for (const recipe of recipeList) {
    const { lastInsertRowid } = insertRecipe.run(recipe.name, recipe.icon, recipe.time, recipe.level, recipe.kcal, recipe.protein, recipe.oil, recipe.salt);
    const recipeId = Number(lastInsertRowid);
    recipe.ingredients.forEach(([name, amount], position) => insertIngredient.run(recipeId, name, amount, position));
    recipe.steps.forEach((text, position) => insertStep.run(recipeId, position, text));
  }
}

function insertRecipes(database, recipeList) {
  database.exec("BEGIN");
  try {
    insertRecipesCore(database, recipeList);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function reseed() {
  const database = initDb();
  const recipeList = readRecipesData().recipes;
  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM recipes");
    insertRecipesCore(database, recipeList);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

// 每次请求现读全表（93 道 × 每道约 5 种食材，开销可忽略），
// 不做进程内缓存，以免另一进程 npm run db:sync 重播种后读到陈旧数据。
export function getAllRecipes() {
  const database = initDb();
  const rows = database.prepare("SELECT * FROM recipes ORDER BY id").all();
  const ingredients = database.prepare("SELECT recipe_id, name, amount FROM recipe_ingredients ORDER BY recipe_id, position").all();
  const steps = database.prepare("SELECT recipe_id, text FROM recipe_steps ORDER BY recipe_id, position").all();
  const recipesById = new Map(rows.map((row) => [row.id, {
    name: row.name,
    icon: row.icon,
    time: row.time_minutes,
    level: row.level,
    kcal: row.kcal,
    protein: row.protein,
    oil: row.oil,
    salt: row.salt,
    ingredients: [],
    steps: []
  }]));
  for (const item of ingredients) {
    const recipe = recipesById.get(item.recipe_id);
    if (recipe) recipe.ingredients.push([item.name, item.amount]);
  }
  for (const step of steps) {
    const recipe = recipesById.get(step.recipe_id);
    if (recipe) recipe.steps.push(step.text);
  }
  return rows.map((row) => recipesById.get(row.id));
}
