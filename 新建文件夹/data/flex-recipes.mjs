// 自动生成文件，请勿手动修改。
// 菜谱数据的唯一来源是 index.html；修改后运行 npm run db:sync 重新生成本文件与 recipes.json。
import recipesData from "./recipes.json" with { type: "json" };

export const recipes = recipesData.recipes;
export const pantryStaples = new Set(recipesData.pantryStaples);
export const aliases = recipesData.aliases;

function canonical(name) {
      const cleaned = name.trim().replace(/\s+/g, "");
      return aliases[cleaned] || cleaned;
    }
export { canonical };

function generateFlexibleRecipes(available) {
      const vegetables = new Set(["西葫芦", "茭白", "菜花", "洋葱", "黄瓜", "青菜", "包菜", "蒜黄", "丝瓜", "蘑菇", "菠菜", "西兰花", "白菜", "胡萝卜", "番茄", "芦笋", "茄子", "木耳", "彩椒", "玉米", "南瓜", "荷兰豆", "芹菜", "西芹"]);
      const availableVegetables = [...available].filter((name) => vegetables.has(name));
      const preferred = (order) => [...new Set([...order, ...availableVegetables])].filter((name) => available.has(name) && vegetables.has(name)).slice(0, 2);
      const generated = [];

      function isAlreadyCovered(required) {
        return recipes.some((recipe) => {
          const items = recipe.ingredients.filter(([name]) => !pantryStaples.has(name)).map(([name]) => canonical(name));
          return required.every((name) => items.includes(name)) && items.every((name) => available.has(name));
        });
      }

      function addCombination(kind, main, sideVegetables) {
        if (sideVegetables.length === 0 || isAlreadyCovered([main, ...sideVegetables])) return;
        const vegetablesText = sideVegetables.join("、");
        const vegetableTitle = sideVegetables.join("");
        const profiles = {
          egg: { name: `${vegetableTitle}滑蛋`, icon: "🥚", amount: "2个", kcal: 210, protein: 15, time: 18, steps: [`${vegetablesText}洗净切片或切段；鸡蛋打散。`, "不粘锅放少量油，先把不易熟的蔬菜炒至断生。", "倒入蛋液炒至完全凝固，少盐调味即可。"] },
          pork: { name: `${vegetableTitle}炒肉片`, icon: "🥢", amount: "120克（选瘦肉）", kcal: 300, protein: 27, time: 20, steps: [`${vegetablesText}洗净切好，猪肉切薄片。`, "少量油先将肉片炒至完全熟透后盛出。", "蔬菜炒熟，倒回肉片翻匀，少量生抽调味。"] },
          tofu: { name: `${vegetableTitle}豆腐煲`, icon: "🍲", amount: "150克", kcal: 240, protein: 18, time: 22, steps: [`${vegetablesText}洗净切好，豆腐切块。`, "锅中加少量水或高汤，先煮不易熟的蔬菜。", "加入豆腐焖煮至食材熟透，少盐调味。"] },
          ribs: { name: `排骨${vegetableTitle}汤`, icon: "🥣", amount: "150克", kcal: 420, protein: 27, time: 65, steps: ["排骨冷水下锅焯2至3分钟，捞出冲净浮沫。", "加清水小火炖至排骨熟透、软烂，撇去表面浮油。", `${vegetablesText}切好后加入锅中煮熟，最后少量盐调味。`] },
          vegetables: { name: `${vegetableTitle}双蔬快炒`, icon: "🥬", amount: "各约100克", kcal: 150, protein: 5, time: 15, steps: [`${vegetablesText}洗净切好；菜花、茭白等较硬蔬菜可先焯水。`, "不粘锅放少量油，先炒较硬的蔬菜，再加入易熟蔬菜。", "炒至熟透后用蒜末、醋或少量盐调味。"] }
        };
        const profile = profiles[kind];
        const mainIngredient = kind === "vegetables" ? [] : [[main, profile.amount]];
        const ingredients = [...mainIngredient, ...sideVegetables.map((name) => [name, "约80克"]), ["食用油", kind === "ribs" ? "0克" : "5克"], ["盐", "约1克"]];
        generated.push({ name: profile.name, icon: profile.icon, time: profile.time, level: "按手头食材组合", kcal: profile.kcal, protein: profile.protein, oil: kind === "ribs" ? "0克" : "5克", salt: "约1克", ingredients, steps: profile.steps, dynamic: true });
      }

      const egg = [...available].find((name) => name === "鸡蛋");
      const pork = [...available].find((name) => name === "猪肉");
      const tofu = [...available].find((name) => name === "豆腐");
      const ribs = [...available].find((name) => name === "排骨");
      if (egg) addCombination("egg", egg, preferred(["番茄", "蒜黄", "西葫芦", "丝瓜", "青菜", "蘑菇", "菜花", "洋葱", "包菜", "茭白"]));
      if (pork) addCombination("pork", pork, preferred(["茭白", "蒜黄", "西葫芦", "包菜", "菜花", "洋葱", "青菜", "蘑菇", "丝瓜", "番茄"]));
      if (tofu) addCombination("tofu", tofu, preferred(["蘑菇", "番茄", "丝瓜", "菜花", "茭白", "青菜", "包菜", "洋葱"]));
      if (ribs) addCombination("ribs", ribs, preferred(["茭白", "菜花", "洋葱", "番茄", "包菜"]));
      if (availableVegetables.length) addCombination("vegetables", "食材", preferred(["西葫芦", "茭白", "菜花", "青菜", "包菜", "洋葱", "蘑菇", "丝瓜", "蒜黄"]));
      return generated;
    }
export { generateFlexibleRecipes };

function generateWeeklyPlanCore(staticRecipes, inputIngredients, seedInput = "") {
      const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      const slotNames = ["lunch", "dinner"];
      const proteinKeywords = [
        ["蛋", ["鸡蛋"]],
        ["禽", ["鸡胸肉", "鸡腿肉"]],
        ["畜", ["猪肉", "猪里脊", "排骨", "牛肉", "牛腩"]],
        ["虾", ["虾仁", "虾皮"]],
        ["鱼", ["鳕鱼", "鲈鱼", "三文鱼", "鲳鱼"]],
        ["豆", ["豆腐", "豆皮", "鹰嘴豆", "毛豆"]]
      ];
      function proteinCategory(recipe) {
        for (const [ingredient] of recipe.ingredients) {
          const normalized = canonical(ingredient);
          for (const [category, keywords] of proteinKeywords) {
            if (keywords.some((keyword) => normalized.includes(keyword))) return category;
          }
        }
        return "素";
      }
      // 打分与浏览器端 matchingRecipes 一致：essentials 排除常用调料，score = matched / essentials
      function matchingCandidates(available) {
        const candidates = [...staticRecipes, ...generateFlexibleRecipes(available)];
        return candidates
          .map((recipe) => {
            const essentials = recipe.ingredients.filter(([name]) => !pantryStaples.has(name));
            const matched = essentials.filter(([name]) => available.has(canonical(name)));
            const missing = essentials.filter(([name]) => !available.has(canonical(name)));
            return {
              ...recipe,
              matched,
              missing,
              score: matched.length / essentials.length,
              dynamic: Boolean(recipe.dynamic),
              proteinCategory: proteinCategory(recipe)
            };
          })
          .filter((recipe) => recipe.matched.length > 0)
          .sort((first, second) => second.score - first.score || Number(Boolean(second.dynamic)) - Number(Boolean(first.dynamic)) || first.missing.length - second.missing.length || first.time - second.time);
      }
      function fnv1a(text) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
      }
      function mulberry32(seed) {
        let state = seed >>> 0;
        return () => {
          state = (state + 0x6d2b79f5) >>> 0;
          let value = state;
          value = Math.imul(value ^ (value >>> 15), value | 1);
          value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
          return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
      }

      const ingredients = [...new Set(inputIngredients.map(canonical).filter(Boolean))];
      const available = new Set(ingredients);
      const candidates = matchingCandidates(available);
      // 不带 seed 时由食材清单导出确定性种子：同一清单每次生成结果稳定
      const seed = seedInput ? fnv1a(seedInput) : fnv1a([...ingredients].sort().join("、"));
      const random = mulberry32(seed);

      // 逐餐位贪心。约束按阶梯放宽：
      // L0 未用过的菜；L1 重复菜但距上次出现 ≥2 槽且次数 < cap；L2 仅限次数；L3 仅不与上一槽相同；L4 全部候选
      const meals = [];
      const pickForSlot = () => {
        const usage = new Map();
        const lastSlot = new Map();
        meals.forEach((meal, index) => {
          if (!meal.recipe) return;
          usage.set(meal.recipe.name, (usage.get(meal.recipe.name) || 0) + 1);
          lastSlot.set(meal.recipe.name, index);
        });
        const previousName = meals[meals.length - 1]?.recipe?.name;
        const previousCategory = meals[meals.length - 1]?.recipe?.proteinCategory;
        const repeatCap = candidates.length < 4 ? 4 : 2;
        let pool = candidates.filter((candidate) => !usage.has(candidate.name));
        if (!pool.length) pool = candidates.filter((candidate) => candidate.name !== previousName && (usage.get(candidate.name) || 0) < repeatCap && meals.length - (lastSlot.get(candidate.name) ?? -Infinity) >= 2);
        if (!pool.length) pool = candidates.filter((candidate) => candidate.name !== previousName && (usage.get(candidate.name) || 0) < repeatCap);
        if (!pool.length) pool = candidates.filter((candidate) => candidate.name !== previousName);
        if (!pool.length) pool = candidates;
        let best = null;
        let bestScore = -Infinity;
        for (const candidate of pool) {
          const value = candidate.score * 100 - candidate.missing.length * 6 - (candidate.proteinCategory === previousCategory ? 12 : 0) + random() * 3;
          if (value > bestScore) {
            bestScore = value;
            best = candidate;
          }
        }
        return best;
      };

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        for (const slot of slotNames) {
          const recipe = candidates.length ? pickForSlot() : null;
          const repeated = Boolean(recipe && meals.some((meal) => meal.recipe && meal.recipe.name === recipe.name));
          meals.push({ slot, repeated, recipe });
        }
      }

      // 组装 7 天（从今天开始）
      const start = new Date();
      const days = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIndex);
        days.push({
          date: `${date.getMonth() + 1}月${date.getDate()}日`,
          weekday: weekdayNames[date.getDay()],
          isToday: dayIndex === 0,
          meals: meals.slice(dayIndex * 2, dayIndex * 2 + 2)
        });
      }

      // 本周需要补买：按 canonical 名聚合出现次数，不聚合用量（"半根"+"150克"不可相加）
      const shopping = new Map();
      for (const meal of meals) {
        if (!meal.recipe) continue;
        for (const [name] of meal.recipe.missing) {
          const key = canonical(name);
          if (!shopping.has(key)) shopping.set(key, { name: key, count: 0, meals: new Set() });
          const entry = shopping.get(key);
          entry.count += 1;
          entry.meals.add(meal.recipe.name);
        }
      }
      const shoppingList = [...shopping.values()]
        .map((entry) => ({ name: entry.name, count: entry.count, meals: [...entry.meals] }))
        .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name, "zh-CN"));

      const planned = meals.filter((meal) => meal.recipe);
      const repeatNames = [...new Set(meals.filter((meal) => meal.repeated).map((meal) => meal.recipe.name))];
      const usedPantry = new Set(planned.flatMap((meal) => meal.recipe.matched.map(([name]) => canonical(name))));
      const totalKcal = planned.reduce((sum, meal) => sum + meal.recipe.kcal, 0);
      const totalProtein = planned.reduce((sum, meal) => sum + meal.recipe.protein, 0);
      const suggestions = ["鸡蛋", "番茄", "土豆", "豆腐"].filter((name) => !available.has(name));
      let notice = "";
      if (candidates.length === 0) {
        notice = "这些食材暂时配不出菜谱，建议先补充常见食材，或到「帮我搭配买菜」看看。";
      } else if (repeatNames.length) {
        notice = `现有食材能配的菜比较少，${repeatNames.join("、")} 会重复安排；补充几种食材可以排得更丰富。`;
      }

      return {
        seed: seedInput || String(seed),
        startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
        ingredients,
        days,
        shoppingList,
        stats: {
          candidateCount: candidates.length,
          repeatCount: meals.filter((meal) => meal.repeated).length,
          distinctDishes: new Set(planned.map((meal) => meal.recipe.name)).size,
          avgKcal: Math.round(totalKcal / 7),
          avgProtein: Math.round(totalProtein / 7),
          pantryCoverage: ingredients.length ? Math.round((usedPantry.size / ingredients.length) * 100) : 0
        },
        repeatNames,
        notice,
        suggestions
      };
    }
export { generateWeeklyPlanCore };
