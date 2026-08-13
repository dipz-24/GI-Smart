const fs = require("fs");
const readline = require("readline");

const INPUT = "data/en.openfoodfacts.org.products.csv";
const OUTPUT = "data/openfoodfacts_sample.csv";
const MAX_ROWS = 3000;

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity,
  });

  const out = fs.createWriteStream(OUTPUT);
  let headerCols = null;
  let headerIndexes = {};
  let written = 0;
  let lineNum = 0;

  const wantedCols = [
    "product_name", "categories_en", "energy-kcal_100g",
    "carbohydrates_100g", "proteins_100g", "fat_100g", "fiber_100g",
  ];

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headerCols = line.split("\t");
      wantedCols.forEach((c) => {
        headerIndexes[c] = headerCols.indexOf(c);
      });
      out.write(wantedCols.join(",") + "\n");
      continue;
    }
    if (written >= MAX_ROWS) break;

    const cols = line.split("\t");
    const name = cols[headerIndexes["product_name"]];
    const kcal = cols[headerIndexes["energy-kcal_100g"]];

    if (!name || !kcal) continue;

    const row = wantedCols.map((c) => {
      const val = cols[headerIndexes[c]] || "";
      return '"' + val.replace(/"/g, '""') + '"';
    });
    out.write(row.join(",") + "\n");
    written++;
  }

  out.end();
  console.log("Sampled", written, "rows with usable data out of", lineNum, "total lines scanned.");
}

run();
