export const MEAL_PRIORITY = ["Lunch", "Breakfast", "Dinner"];
export const LOCATION_PRIORITY = ["fountain", "case", "clark", "one-earth"];
export const CATEGORY_PRIORITY = ["Entrees", "Simply Made", "Pasta", "Saute", "Pizza", "Salads & Cold Foods", "Other"];
export const STATION_GROUPS = [
  ["Home Style Entree", "Entree", "Entree Breakfast", "ENTREE - FASTFOOD", "Global"],
  ["Simply Made", "Mediterranean"],
  ["Pasta"],
  ["Saute Station", "Asian"],
  ["Pizza"],
];

const STATION_CATEGORY_LOOKUP = new Map([
  ["Home Style Entree", "Entrees"],
  ["Entree", "Entrees"],
  ["Entree Breakfast", "Entrees"],
  ["ENTREE - FASTFOOD", "Entrees"],
  ["Global", "Entrees"],
  ["Simply Made", "Simply Made"],
  ["Mediterranean", "Simply Made"],
  ["Pasta", "Pasta"],
  ["Saute Station", "Saute"],
  ["Asian", "Saute"],
  ["Pizza", "Pizza"],
  ...["Composed Salads", "Salad", "Salad Bar Toppings", "Salad Dressings", "Salad Greens", "Yogurt/Fruit Bar"]
    .map(station => [station, "Salads & Cold Foods"]),
]);

const LOCATION_LABELS = {
  fountain: "Fountain",
  case: "Case",
  clark: "Clark",
  "one-earth": "One Earth",
};

const NUTRIENT_LABELS = {
  calories: "Calories",
  calories_from_fat: "Calories from fat",
  total_fat: "Total fat",
  saturated_fat: "Saturated fat",
  trans_fat: "Trans fat",
  cholesterol: "Cholesterol",
  sodium: "Sodium",
  total_carbohydrate: "Total carbohydrate",
  dietary_fiber: "Dietary fiber",
  sugars: "Sugars",
  protein: "Protein",
  vitamin_a: "Vitamin A",
  vitamin_c: "Vitamin C",
  calcium: "Calcium",
  iron: "Iron",
  potassium: "Potassium",
};

const NUTRIENT_PRIORITY = Object.keys(NUTRIENT_LABELS);

export function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function rank(value, choices) {
  const folded = normalize(value);
  const index = choices.findIndex(choice => normalize(choice) === folded);
  return index === -1 ? choices.length : index;
}

export function stationGroupRank(station) {
  const folded = normalize(station);
  const index = STATION_GROUPS.findIndex(group => group.some(name => normalize(name) === folded));
  return index === -1 ? STATION_GROUPS.length : index;
}

export function stationCategory(station, location = null) {
  if (station === "Home Style Sides" && location === "clark") return "Entrees";
  if (String(station ?? "").trim() === "Mediterranean" && normalize(location) === "fountain") {
    return "Other";
  }
  return STATION_CATEGORY_LOOKUP.get(String(station ?? "").trim()) || "Other";
}

function isoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.valueOf()) ? null : date;
}

function isoAddDays(value, days) {
  const date = isoDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function inclusiveWindowDates(window) {
  const dates = [];
  let current = window?.start;
  if (!isoDate(current) || !isoDate(window?.end) || current > window.end) return dates;
  while (current <= window.end && dates.length < 370) {
    dates.push(current);
    current = isoAddDays(current, 1);
  }
  return dates;
}

export function initialDate(window, now = new Date(), occurrences = []) {
  const today = easternDate(now);
  if (window?.start <= today && today <= window?.end) return today;
  const firstListed = [...new Set(occurrences.map(row => row.date))]
    .filter(date => window?.start <= date && date <= window?.end)
    .sort()[0];
  return firstListed || window?.start;
}

export function dateOptionLabel(value, window, now = new Date(), nextAvailableDate = window?.start) {
  if (value === "all") {
    const style = { month: "short", day: "numeric", year: "numeric" };
    return `All week · ${formatDate(window.start, style)} – ${formatDate(window.end, style)}`;
  }
  const today = easternDate(now);
  const inWindow = window?.start <= today && today <= window?.end;
  const formatted = formatDate(value);
  if (!inWindow && value === nextAvailableDate) return `Next Available Day · ${formatted}`;
  if (inWindow && value === today) return `Today · ${formatted}`;
  if (inWindow && value === isoAddDays(today, 1)) return `Tomorrow · ${formatted}`;
  return formatted;
}

export function compareOccurrences(left, right) {
  return left.date.localeCompare(right.date)
    || rank(left.meal, MEAL_PRIORITY) - rank(right.meal, MEAL_PRIORITY)
    || normalize(left.meal).localeCompare(normalize(right.meal))
    || rank(left.location, LOCATION_PRIORITY) - rank(right.location, LOCATION_PRIORITY)
    || normalize(left.location).localeCompare(normalize(right.location))
    || stationGroupRank(left.station) - stationGroupRank(right.station)
    || normalize(left.station).localeCompare(normalize(right.station))
    || normalize(left.item_name).localeCompare(normalize(right.item_name))
    || normalize(left.serving_size).localeCompare(normalize(right.serving_size));
}

export function filterOccurrences(occurrences, state) {
  const query = normalize(state.query);
  return occurrences.filter(row =>
    (state.date === "all" || row.date === state.date)
    && state.meals.has(row.meal)
    && state.halls.has(row.location)
    && (!state.categories || state.categories.has(stationCategory(row.station, row.location)))
    && (!query || normalize(row.item_name).includes(query))
  ).sort(compareOccurrences);
}

export function groupOccurrences(occurrences, mode = "hall") {
  const dates = new Map();
  for (const row of occurrences) {
    if (!dates.has(row.date)) dates.set(row.date, new Map());
    const meals = dates.get(row.date);
    if (!meals.has(row.meal)) meals.set(row.meal, new Map());
    let locations = meals.get(row.meal);
    if (mode === "category") {
      const category = stationCategory(row.station, row.location);
      if (!locations.has(category)) locations.set(category, new Map());
      locations = locations.get(category);
    }
    if (!locations.has(row.location)) locations.set(row.location, new Map());
    const stations = locations.get(row.location);
    const station = row.station || "Unlabeled station";
    if (!stations.has(station)) stations.set(station, []);
    stations.get(station).push(row);
  }
  return dates;
}

export function rawNutrient(nutrition, name) {
  const nutrient = nutrition?.nutrients?.[name];
  if (!nutrient || nutrient.raw === undefined || nutrient.raw === null || nutrient.raw === "") {
    return "Not reported";
  }
  return String(nutrient.raw);
}

export function nutritionAvailability(row, nutrition) {
  if (row?.nutrition_available === false && nutrition) return "retained";
  if (!nutrition) return "unavailable";
  return "available";
}

export function extractAllergenStatements(ingredients) {
  if (!ingredients) return [];
  const matches = [];
  const expression = /\bcontains\s*:\s*([^.;)]+)/gi;
  for (const match of ingredients.matchAll(expression)) {
    const value = match[1].trim();
    if (value && !matches.some(existing => normalize(existing) === normalize(value))) matches.push(value);
  }
  return matches;
}

export function relevantCoverage(coverage, state) {
  return coverage.filter(row =>
    (state.date === "all" || row.date === state.date)
    && state.halls.has(row.location)
    && (row.meal == null || state.meals.has(row.meal))
  );
}

export function emptyStateMessage({ query, meals, halls, categories }, coverage) {
  if (!meals.size) return ["Choose at least one meal", "Meal filters determine which menus appear."];
  if (!halls.size) return ["Choose at least one dining hall", "You can select more than one hall."];
  if (categories && !categories.size) return ["Choose at least one food category", "Category filters determine which offerings appear."];
  if (query.trim()) return ["No foods match that search", "Try a shorter food name or broaden the date, meal, or hall filters."];
  if (coverage.length && coverage.every(row => row.status === "unavailable")) {
    return ["No menus were published for this scope", "The source did not publish matching menu links. This does not necessarily mean the halls are closed."];
  }
  if (coverage.length && coverage.every(row => row.status === "empty")) {
    return ["Published menus are empty", "The source explicitly reported no items for these menus."];
  }
  return ["No foods are listed for these filters", "Try another date, meal, or dining hall."];
}

export function comparisonScopeIssue(state) {
  if (!state.date || state.date === "all") return "Choose one date in the sticky controls to compare dining halls.";
  if (state.meals.size !== 1) return "Choose exactly one meal in the sticky controls to compare dining halls.";
  if (!state.halls.size) return "Choose at least one dining hall to compare.";
  if (state.categories && !state.categories.size) return "Choose at least one food category in Advanced filters.";
  return null;
}

function scopedCoverage(coverage, date, meal, location) {
  const rows = coverage.filter(row => row.date === date && row.location === location);
  return rows.find(row => row.meal === meal) || rows.find(row => row.meal == null) || null;
}

export function comparisonCellMessage({ coverage, hasMenuOfferings, hasCategoryOfferings, hasSearchMatch, query }) {
  if (hasSearchMatch) return null;
  const messages = {
    unavailable: ["Menu unpublished", "The source published no matching menu link. This does not prove the hall is closed."],
    empty: ["Menu explicitly empty", "The source published this menu with no offerings."],
    failed: ["Menu check failed", "This menu could not be verified during collection."],
    partial: ["Menu coverage incomplete", "Some collection work failed, so this listing may be incomplete."],
    degraded: ["No matching offerings", "The listing was verified, but source nutrition is incomplete for some offerings."],
    ok: ["No offerings in this category", "The verified menu has no listed items in this category."],
  };
  if (!coverage || !messages[coverage.status]) return ["Menu coverage unknown", "This menu was not verified for the selected scope."];
  if (!["ok", "degraded"].includes(coverage.status)) return messages[coverage.status];
  if (hasCategoryOfferings && query.trim()) {
    return ["No matching offerings", "This category has offerings, but none match the current food search."];
  }
  if (hasMenuOfferings) return ["No offerings in this category", "The verified menu has no listed items in this category."];
  return messages[coverage.status];
}

export function easternDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).reduce((result, item) => ({ ...result, [item.type]: item.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function freshnessState(data, now = new Date()) {
  const checked = data.coverage
    .map(row => row.menu_last_checked_at)
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(value => !Number.isNaN(value.valueOf()));
  const latest = checked.length ? new Date(Math.max(...checked.map(value => value.valueOf()))) : null;
  const today = easternDate(now);
  const inWindow = data.window?.start <= today && today <= data.window?.end;
  const ageHours = latest ? (now.valueOf() - latest.valueOf()) / 3_600_000 : null;
  return {
    latest,
    stale: !inWindow || latest === null || ageHours > 36,
    ageHours,
    inWindow,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, options = { weekday: "long", month: "short", day: "numeric" }) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(date);
}

function formatTimestamp(value) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

function titleCase(value) {
  return String(value ?? "").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function displayStation(value) {
  return !value || normalize(value) === "none" ? "Unlabeled station" : value;
}

function nutritionRows(nutrition) {
  const entries = Object.entries(nutrition?.nutrients || {});
  entries.sort(([left], [right]) => {
    const leftRank = rank(left, NUTRIENT_PRIORITY);
    const rightRank = rank(right, NUTRIENT_PRIORITY);
    return leftRank - rightRank || left.localeCompare(right);
  });
  return entries.map(([name, value]) => {
    const raw = value?.raw === "" || value?.raw == null ? "Not reported" : value.raw;
    const daily = value?.daily_value_percent == null ? "" : ` · ${value.daily_value_percent}% DV`;
    return `<tr><th scope="row">${escapeHtml(NUTRIENT_LABELS[name] || titleCase(name))}</th><td>${escapeHtml(raw)}${escapeHtml(daily)}</td></tr>`;
  }).join("");
}

function foodCard(row, nutrition) {
  const calories = rawNutrient(nutrition, "calories");
  const protein = rawNutrient(nutrition, "protein");
  const availability = nutritionAvailability(row, nutrition);
  const warning = availability === "retained"
    ? '<span class="availability-badge">Retained nutrition</span>'
    : availability === "unavailable"
      ? '<span class="availability-badge">Nutrition unavailable</span>'
      : "";
  const reason = row.nutrition_unavailable_reason
    ? escapeHtml(row.nutrition_unavailable_reason.replaceAll("_", " "))
    : "the source did not provide a complete label";
  const allergenStatements = extractAllergenStatements(nutrition?.ingredients);
  const allergenCopy = allergenStatements.length
    ? `<p class="allergen-copy"><strong>Source allergen statement:</strong> ${escapeHtml(allergenStatements.join("; "))}</p>`
    : `<p class="ingredients">No separate allergen statement was provided. Review the ingredient list when available.</p>`;
  const nutritionContent = nutrition
    ? `${availability === "retained" ? `<p class="allergen-copy">The latest nutrition check was unavailable (${reason}); these values are retained from the earlier fetch shown below.</p>` : ""}<table class="nutrient-table"><tbody>${nutritionRows(nutrition)}</tbody></table>`
    : `<p class="allergen-copy">Nutrition is unavailable for this offering: ${reason}.</p>`;
  return `
    <article class="food-card">
      <div class="food-main">
        <div class="food-name-row">
          <h6>${escapeHtml(row.item_name)}</h6>
          ${warning}
        </div>
        <p class="serving">${escapeHtml(row.serving_size || nutrition?.serving_size?.raw || "Serving not reported")}</p>
        <div class="macro-row">
          <span class="macro"><strong>Calories</strong> ${escapeHtml(calories)}</span>
          <span class="macro"><strong>Protein</strong> ${escapeHtml(protein)}</span>
        </div>
      </div>
      <details>
        <summary>Nutrition &amp; source details</summary>
        <div class="details-body">
          <section class="detail-section"><h6>Full nutrition</h6>${nutritionContent}</section>
          <section class="detail-section"><h6>Ingredients &amp; allergens</h6>${allergenCopy}${nutrition?.ingredients ? `<p class="ingredients">${escapeHtml(nutrition.ingredients)}</p>` : ""}</section>
          <section class="detail-section">
            <h6>Freshness</h6>
            <dl class="timestamp-list">
              <div><dt>Menu checked</dt><dd>${escapeHtml(formatTimestamp(row.menu_last_checked_at))}</dd></div>
              <div><dt>Nutrition fetched</dt><dd>${escapeHtml(formatTimestamp(row.nutrition_last_fetched_at))}</dd></div>
              ${row.nutrition_last_checked_at ? `<div><dt>Nutrition checked</dt><dd>${escapeHtml(formatTimestamp(row.nutrition_last_checked_at))}</dd></div>` : ""}
            </dl>
          </section>
        </div>
      </details>
    </article>`;
}

function checkboxChip(name, value, label, checked) {
  const id = `${name}-${value.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return `<label class="chip" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function coverageMessage(row) {
  const scope = `${formatDate(row.date, { month: "short", day: "numeric" })} · ${LOCATION_LABELS[row.location] || titleCase(row.location)}${row.meal ? ` · ${row.meal}` : ""}`;
  const messages = {
    unavailable: "No matching menu was published. This does not necessarily mean the hall is closed.",
    empty: "The source explicitly published this menu with no items.",
    degraded: "The food listing is complete, but some source nutrition is unavailable.",
    partial: "Some collection work failed; retained data may be incomplete.",
    failed: "The menu could not be verified during collection.",
  };
  return `<div class="notice ${escapeHtml(row.status)}"><strong>${escapeHtml(scope)}</strong><span>${escapeHtml(messages[row.status] || row.reason || row.status)}</span></div>`;
}

function orderedEntries(map, priorities = []) {
  return [...map.entries()].sort(([left], [right]) =>
    rank(left, priorities) - rank(right, priorities) || normalize(left).localeCompare(normalize(right))
  );
}

function renderStationBlocks(stations, data) {
  return [...stations.entries()]
    .sort(([left], [right]) => stationGroupRank(left) - stationGroupRank(right) || normalize(left).localeCompare(normalize(right)))
    .map(([station, rows]) => {
      const cards = rows.map(row => foodCard(row, row.nutrition_ref ? data.nutrition[row.nutrition_ref] : null)).join("");
      const context = [LOCATION_LABELS[rows[0].location], stationCategory(station, rows[0].location)];
      return `<section class="station-block"><p class="station-name"><span class="station-context">${context.map(escapeHtml).join(" · ")} · </span>${escapeHtml(displayStation(station))}</p><div class="food-grid">${cards}</div></section>`;
    }).join("");
}

function renderLocationBlock(location, stations, data, nested = false) {
  const itemCount = [...stations.values()].reduce((total, rows) => total + rows.length, 0);
  const tag = nested ? "h6" : "h5";
  return `<section class="location-block" data-location="${escapeHtml(location)}"><div class="group-heading"><${tag}>${escapeHtml(LOCATION_LABELS[location] || titleCase(location))}</${tag}><span>${itemCount} item${itemCount === 1 ? "" : "s"}</span></div>${renderStationBlocks(stations, data)}</section>`;
}

function groupStations(rows) {
  const stations = new Map();
  for (const row of rows) {
    const station = row.station || "Unlabeled station";
    if (!stations.has(station)) stations.set(station, []);
    stations.get(station).push(row);
  }
  return stations;
}

function renderCompare(data, state) {
  const results = document.querySelector("#compare-results");
  const count = document.querySelector("#compare-count");
  const issue = comparisonScopeIssue(state);
  if (issue) {
    count.textContent = "Select a comparison scope";
    results.innerHTML = `<div class="empty-state compare-scope-prompt"><strong>Comparison needs one date and one meal</strong><span>${escapeHtml(issue)}</span></div>`;
    return;
  }

  const meal = [...state.meals][0];
  const halls = LOCATION_PRIORITY.filter(location => state.halls.has(location));
  const columnClass = `compare-columns-${halls.length}`;
  const categories = CATEGORY_PRIORITY.filter(category => state.categories.has(category));
  const scopeRows = data.occurrences.filter(row => row.date === state.date && row.meal === meal && state.halls.has(row.location));
  const filtered = filterOccurrences(data.occurrences, state);
  count.textContent = `${filtered.length.toLocaleString()} offering${filtered.length === 1 ? "" : "s"}`;

  if (!categories.length) {
    results.innerHTML = '<div class="empty-state"><strong>No categories selected</strong><span>Open Advanced filters and choose at least one food category.</span></div>';
    return;
  }

  const header = halls.map(hall => `<div class="compare-hall-heading" data-location="${escapeHtml(hall)}"><strong>${escapeHtml(LOCATION_LABELS[hall] || titleCase(hall))}</strong></div>`).join("");
  const sections = categories.map(category => {
    const cells = halls.map(hall => {
      const menuRows = scopeRows.filter(row => row.location === hall);
      const categoryRows = menuRows.filter(row => stationCategory(row.station, row.location) === category);
      const rows = filtered.filter(row => row.location === hall && stationCategory(row.station, row.location) === category);
      const coverage = scopedCoverage(data.coverage, state.date, meal, hall);
      const message = comparisonCellMessage({
        coverage,
        hasMenuOfferings: menuRows.length > 0,
        hasCategoryOfferings: categoryRows.length > 0,
        hasSearchMatch: rows.length > 0,
        query: state.query,
      });
      const body = rows.length
        ? renderStationBlocks(groupStations(rows), data)
        : `<div class="compare-cell-state ${escapeHtml(coverage?.status || "unknown")}"><strong>${escapeHtml(message[0])}</strong><span>${escapeHtml(message[1])}</span></div>`;
      return `<div class="compare-cell" data-location="${escapeHtml(hall)}" data-category="${escapeHtml(category)}">${body}</div>`;
    }).join("");
    return `<section class="compare-category" data-category="${escapeHtml(category)}"><h3>${escapeHtml(category)}</h3><div class="compare-category-grid">${cells}</div></section>`;
  }).join("");

  results.innerHTML = `
    <div class="compare-context"><strong>${escapeHtml(formatDate(state.date))} · ${escapeHtml(meal)}</strong><span>Categories align across the selected dining halls. Original station names remain inside each column.</span></div>
    <p class="compare-scroll-cue">Scroll sideways to compare more dining halls <span aria-hidden="true">→</span></p>
    <div class="compare-key"><div class="active-category" aria-hidden="true"><span></span></div><div class="key-clip"><div class="comparison-board ${columnClass}"><div class="compare-hall-row">${header}</div></div></div></div>
    <div class="comparison-scroll" tabindex="0" aria-label="Dining hall comparison table">
      <div class="comparison-board ${columnClass}">
        ${sections}
      </div>
    </div>`;
  const scroller = results.querySelector(".comparison-scroll");
  scroller.addEventListener("scroll", () => {
    results.querySelector(".key-clip").scrollLeft = scroller.scrollLeft;
  }, {passive: true});
}

function renderResults(data, state) {
  document.querySelector("#results-heading").textContent = state.date === "all"
    ? dateOptionLabel("all", data.window) : "Weekly results";
  const results = document.querySelector("#results");
  const count = document.querySelector("#result-count");
  const filtered = filterOccurrences(data.occurrences, state);
  const coverage = relevantCoverage(data.coverage, state);
  renderCoverage(coverage);
  count.textContent = `${filtered.length.toLocaleString()} offering${filtered.length === 1 ? "" : "s"}`;
  results.setAttribute("aria-busy", "false");
  if (!filtered.length) {
    const [heading, detail] = emptyStateMessage(state, coverage);
    results.innerHTML = `<div class="empty-state"><strong>${escapeHtml(heading)}</strong><span>${escapeHtml(detail)}</span></div>`;
    return;
  }

  const grouped = groupOccurrences(filtered, state.groupBy);
  const sections = [];
  for (const [date, meals] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    let body = "";
    for (const [meal, groups] of orderedEntries(meals, MEAL_PRIORITY)) {
      let mealBody = "";
      if (state.groupBy === "category") {
        for (const [category, locations] of orderedEntries(groups, CATEGORY_PRIORITY)) {
          const locationHtml = orderedEntries(locations, LOCATION_PRIORITY)
            .map(([location, stations]) => renderLocationBlock(location, stations, data, true)).join("");
          mealBody += `<section class="category-block" data-category="${escapeHtml(category)}"><div class="category-heading"><h5>${escapeHtml(category)}</h5></div>${locationHtml}</section>`;
        }
      } else {
        mealBody = orderedEntries(groups, LOCATION_PRIORITY)
          .map(([location, stations]) => renderLocationBlock(location, stations, data)).join("");
      }
      body += `<section class="meal-block" data-meal="${escapeHtml(meal)}"><div class="meal-heading"><h4>${escapeHtml(meal)}</h4></div>${mealBody}</section>`;
    }
    sections.push(`<section class="date-section"><header class="date-heading"><h3>${escapeHtml(formatDate(date))}</h3><span>${escapeHtml(date)}</span></header><div class="date-body">${body}</div></section>`);
  }
  results.innerHTML = sections.join("");
}

function renderViews(data, state) {
  renderResults(data, state);
  renderCompare(data, state);
}

function selectView(state, view) {
  state.view = view;
  for (const name of ["browse", "compare"]) {
    const active = name === view;
    const tab = document.querySelector(`#${name}-tab`);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    document.querySelector(`#${name}-view`).hidden = !active;
  }
}

function renderCoverage(coverage) {
  const section = document.querySelector("#coverage-notices");
  const list = document.querySelector("#coverage-list");
  const jump = document.querySelector("#coverage-jump");
  const jumpCount = document.querySelector("#coverage-jump-count");
  const summaryCount = document.querySelector("#coverage-summary-count");
  const noteworthy = coverage.filter(row => row.status !== "ok");
  if (!noteworthy.length) {
    section.classList.add("hidden");
    section.open = false;
    jump.classList.add("hidden");
    list.innerHTML = "";
    jumpCount.textContent = "";
    summaryCount.textContent = "";
    return;
  }
  list.innerHTML = noteworthy.sort((left, right) => left.date.localeCompare(right.date) || compareOccurrences(left, right)).map(coverageMessage).join("");
  const label = `${noteworthy.length} note${noteworthy.length === 1 ? "" : "s"}`;
  jumpCount.textContent = `(${noteworthy.length})`;
  summaryCount.textContent = label;
  jump.classList.remove("hidden");
  section.classList.remove("hidden");
}

function renderPublication(data, now = new Date()) {
  const banner = document.querySelector("#publication-banner");
  const freshness = document.querySelector("#freshness-card");
  const state = freshnessState(data, now);
  const warnings = data.publication?.warnings || [];
  const summary = ["Menu status"];
  if (state.stale) summary.push("Stale data");
  if (data.publication?.status !== "complete") summary.push(data.publication?.status || "Unknown completeness");
  document.querySelector("#status-summary").textContent = summary.join(" · ");
  const messages = [];
  if (data.publication?.status !== "complete" || warnings.length) {
    messages.push(`<strong>Published with ${escapeHtml(data.publication?.status || "unknown")} completeness.</strong> ${escapeHtml(warnings.map(item => item.message).join(" ") || "Review the menu availability notes below.")}`);
  }
  if (state.stale) {
    messages.push(`<strong>This weekly data is stale.</strong> The newest successful menu check is ${escapeHtml(formatTimestamp(state.latest?.toISOString()))}.`);
  }
  if (messages.length) {
    banner.className = "banner warning";
    banner.innerHTML = messages.join(" ");
  } else {
    banner.className = "banner hidden";
    banner.innerHTML = "";
  }
  const statusClass = state.stale ? "warning-dot" : data.publication?.status === "complete" ? "" : "warning-dot";
  freshness.innerHTML = `<span class="status-dot ${statusClass}"></span><div><strong>${state.stale ? "Stale weekly data" : "Weekly menus checked"}</strong><span>${escapeHtml(data.window.start)} through ${escapeHtml(data.window.end)} · latest menu check ${escapeHtml(formatTimestamp(state.latest?.toISOString()))}</span></div>`;
}

function advancedCheckbox(name, value, label, checked, note = "") {
  const id = `${name}-${value.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return `<label class="advanced-check" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}><span><strong>${escapeHtml(label)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}</span></label>`;
}

export function hallSelectionValue(halls) {
  if (halls.size === LOCATION_PRIORITY.length && LOCATION_PRIORITY.every(hall => halls.has(hall))) return "all";
  if (halls.size === 1) return [...halls][0];
  return "custom";
}

export function uniqueCategoryLocations(occurrences) {
  const locations = new Map(CATEGORY_PRIORITY.map(category => [category, new Set()]));
  for (const row of occurrences) locations.get(stationCategory(row.station, row.location)).add(row.location);
  return locations;
}

export function createInitialState(data, now = new Date()) {
  return {
    date: initialDate(data.window, now, data.occurrences),
    meals: new Set(["Lunch"]),
    halls: new Set(LOCATION_PRIORITY),
    categories: new Set(CATEGORY_PRIORITY),
    groupBy: "hall",
    view: "browse",
    query: "",
  };
}

function renderDateOptions(data, state, now) {
  const dates = inclusiveWindowDates(data.window);
  document.querySelector("#date-select").innerHTML = ["all", ...dates]
    .map(date => `<option value="${date}">${escapeHtml(dateOptionLabel(date, data.window, now, state.date))}</option>`).join("");
  document.querySelector("#date-select").value = state.date;
}

function syncHallControls(state) {
  const selection = hallSelectionValue(state.halls);
  const select = document.querySelector("#hall-select");
  const customOption = select.querySelector('option[value="custom"]');
  customOption.textContent = selection === "custom" ? `Custom · ${state.halls.size} halls` : "Custom selection";
  select.value = selection;
  document.querySelectorAll('input[name="custom-hall"]').forEach(input => {
    input.checked = state.halls.has(input.value);
    input.disabled = state.halls.size === 1 && input.checked;
  });
}

function syncAdvancedSummary(state) {
  const parts = [];
  if (hallSelectionValue(state.halls) === "custom") parts.push(`Custom · ${state.halls.size} halls`);
  if (state.groupBy === "category") parts.push("Grouped by category");
  if (state.categories.size !== CATEGORY_PRIORITY.length) parts.push(`${state.categories.size} categories`);
  document.querySelector("#advanced-summary").textContent = parts.join(" · ");
}

function initializeFilters(data, state, now) {
  const meals = [...new Set(["Lunch", ...data.occurrences.map(row => row.meal), ...data.coverage.map(row => row.meal).filter(Boolean)])]
    .sort((left, right) => rank(left, MEAL_PRIORITY) - rank(right, MEAL_PRIORITY) || left.localeCompare(right));
  renderDateOptions(data, state, now);
  document.querySelector("#meal-filters").innerHTML = meals.map(meal => checkboxChip("meal", meal, meal, state.meals.has(meal))).join("");
  document.querySelector("#hall-select").innerHTML = [
    '<option value="all">All halls</option>',
    ...LOCATION_PRIORITY.map(hall => `<option value="${hall}">${escapeHtml(LOCATION_LABELS[hall])}</option>`),
    '<option value="custom">Custom selection</option>',
  ].join("");
  document.querySelector("#hall-filters").innerHTML = LOCATION_PRIORITY
    .map(hall => advancedCheckbox("custom-hall", hall, LOCATION_LABELS[hall], true)).join("");

  const categoryLocations = uniqueCategoryLocations(data.occurrences);
  document.querySelector("#category-filters").innerHTML = CATEGORY_PRIORITY.map(category => {
    const locations = categoryLocations.get(category);
    const note = locations.size === 1
      ? `Only at ${LOCATION_LABELS[[...locations][0]] || titleCase([...locations][0])} in this exported week`
      : "";
    return advancedCheckbox("category", category, category, true, note);
  }).join("");
  syncHallControls(state);
  syncAdvancedSummary(state);
}

function bindFilters(data, state, nowProvider) {
  const toolbar = document.querySelector(".hall-toolbar");
  const updateOffset = () => {
    const top = parseFloat(getComputedStyle(toolbar).top) || 0;
    document.documentElement.style.setProperty("--toolbar-bottom", (toolbar.offsetHeight + top) + "px");
    updateCategory();
  };
  function updateCategory() {
    const key = document.querySelector(".compare-key");
    if (state.view !== "compare" || !key) return;
    const edge = key.getBoundingClientRect().bottom;
    const sections = [...document.querySelectorAll(".compare-category")];
    const active = sections.find(section => section.getBoundingClientRect().bottom > edge);
    const label = active && active.querySelector("h3").getBoundingClientRect().bottom <= edge
      ? active.dataset.category : "";
    const badge = key.firstElementChild;
    if (label && badge.textContent !== label) badge.firstElementChild.textContent = label;
    badge.classList.toggle("is-visible", Boolean(label));
  }
  new ResizeObserver(updateOffset).observe(toolbar);
  window.addEventListener("scroll", updateCategory, {passive: true});
  const positions = {browse: 0, compare: null};
  function switchView(view) {
    if (view === state.view) return;
    positions[state.view] = window.scrollY;
    selectView(state, view);
    const resultsTop = document.querySelector(".results-section").getBoundingClientRect().top + window.scrollY;
    window.scrollTo({top: positions[view] ?? Math.min(window.scrollY, resultsTop - toolbar.offsetHeight - 12), behavior: "instant"});
    updateCategory();
  }
  const advancedPanel = document.querySelector("#advanced-filters");
  const advancedToggle = document.querySelector("#advanced-toggle");
  const openAdvanced = focusSelector => {
    advancedPanel.hidden = false;
    document.body.classList.add("advanced-open");
    advancedToggle.setAttribute("aria-expanded", "true");
    const target = focusSelector ? document.querySelector(focusSelector) : document.querySelector("#advanced-close");
    target?.focus({ preventScroll: true });
  };
  const closeAdvanced = ({ restoreFocus = true } = {}) => {
    advancedPanel.hidden = true;
    document.body.classList.remove("advanced-open");
    advancedToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) advancedToggle.focus({ preventScroll: true });
  };
  const refresh = () => {
    syncHallControls(state);
    syncAdvancedSummary(state);
    renderViews(data, state);
    updateCategory();
  };
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    tab.addEventListener("click", () => switchView(tab.id === "compare-tab" ? "compare" : "browse"));
    tab.addEventListener("keydown", event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const view = tab.id === "browse-tab" ? "compare" : "browse";
      switchView(view);
      document.querySelector(`#${view}-tab`).focus();
    });
  });
  document.querySelector("#food-search").addEventListener("input", event => { state.query = event.target.value; refresh(); });
  document.querySelector("#date-select").addEventListener("change", event => { state.date = event.target.value; refresh(); });
  document.querySelector("#meal-filters").addEventListener("change", event => {
    if (event.target.name !== "meal") return;
    event.target.checked ? state.meals.add(event.target.value) : state.meals.delete(event.target.value);
    refresh();
  });
  document.querySelector("#hall-select").addEventListener("change", event => {
    if (event.target.value === "all") state.halls = new Set(LOCATION_PRIORITY);
    else if (LOCATION_PRIORITY.includes(event.target.value)) state.halls = new Set([event.target.value]);
    else {
      openAdvanced('input[name="custom-hall"]');
    }
    refresh();
  });
  document.querySelector("#hall-filters").addEventListener("change", event => {
    if (event.target.name !== "custom-hall") return;
    if (!event.target.checked && state.halls.size === 1) {
      event.target.checked = true;
      return;
    }
    event.target.checked ? state.halls.add(event.target.value) : state.halls.delete(event.target.value);
    refresh();
  });
  document.querySelector("#grouping-filters").addEventListener("change", event => {
    if (event.target.name !== "grouping") return;
    state.groupBy = event.target.value;
    refresh();
  });
  document.querySelector("#category-filters").addEventListener("change", event => {
    if (event.target.name !== "category") return;
    event.target.checked ? state.categories.add(event.target.value) : state.categories.delete(event.target.value);
    refresh();
  });
  advancedToggle.addEventListener("click", () => {
    if (advancedPanel.hidden) openAdvanced();
    else closeAdvanced();
  });
  document.querySelector("#advanced-close").addEventListener("click", () => closeAdvanced());
  advancedPanel.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAdvanced();
    }
  });
  document.querySelector("#coverage-jump").addEventListener("click", event => {
    event.preventDefault();
    const section = document.querySelector("#coverage-notices");
    section.open = true;
    section.scrollIntoView({ block: "start" });
    document.querySelector("#coverage-heading").focus({ preventScroll: true });
  });
  document.querySelector("#reset-filters").addEventListener("click", () => {
    state.query = "";
    const resetNow = nowProvider();
    state.date = initialDate(data.window, resetNow, data.occurrences);
    state.halls = new Set(LOCATION_PRIORITY);
    state.categories = new Set(CATEGORY_PRIORITY);
    state.groupBy = "hall";
    document.querySelector("#food-search").value = "";
    renderDateOptions(data, state, resetNow);
    document.querySelectorAll('input[name="meal"]').forEach(input => {
      input.checked = input.value === "Lunch";
      input.checked ? state.meals.add(input.value) : state.meals.delete(input.value);
    });
    document.querySelectorAll('input[name="category"]').forEach(input => { input.checked = true; });
    document.querySelector('input[name="grouping"][value="hall"]').checked = true;
    closeAdvanced({ restoreFocus: false });
    renderPublication(data, resetNow);
    refresh();
  });
}

export async function startApp(fetcher = fetch, nowProvider = () => new Date()) {
  const response = await fetcher("./menus.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Weekly menu request failed (${response.status})`);
  const data = await response.json();
  if (data.schema_version !== 3 || !Array.isArray(data.occurrences) || typeof data.nutrition !== "object") {
    throw new Error("Weekly menu has an unsupported format");
  }
  const getNow = typeof nowProvider === "function" ? nowProvider : () => nowProvider;
  const now = getNow();
  const state = createInitialState(data, now);
  initializeFilters(data, state, now);
  bindFilters(data, state, getNow);
  renderPublication(data, now);
  renderViews(data, state);
  return { data, state };
}

if (typeof document !== "undefined") {
  startApp().catch(error => {
    const banner = document.querySelector("#publication-banner");
    banner.className = "banner error";
    banner.innerHTML = `<strong>Could not load the weekly menu.</strong> ${escapeHtml(error.message)}`;
    const results = document.querySelector("#results");
    results.setAttribute("aria-busy", "false");
    results.innerHTML = '<div class="empty-state"><strong>Menu data is unavailable</strong><span>Confirm the local server is running and try refreshing the page.</span></div>';
    const freshness = document.querySelector("#freshness-card");
    freshness.innerHTML = '<span class="status-dot error-dot"></span><div><strong>Data unavailable</strong><span>The weekly JSON could not be loaded.</span></div>';
  });
}
