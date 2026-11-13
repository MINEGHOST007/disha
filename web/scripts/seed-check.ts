import { getCustomerSegments, predictStockout } from "../lib/engines";
import { generateSeedData, seededGheeUnitsSold28Days } from "../lib/seed";

const seed = generateSeedData();
const lakshmi = getCustomerSegments();
const ghee = seed.skus.find((sku) => sku.id === "sku_ghee");
const gheeUnits = seededGheeUnitsSold28Days(seed);
const forecast = predictStockout(ghee?.onHand ?? 0, gheeUnits, ghee?.leadTimeDays ?? 2);

console.log(`Disha demo seed checksum: ${seed.checksum}`);
console.log(`E1 · Bill #1048: expected ₹96, recorded ₹69, difference ₹27`);
console.log(`Lakshmi · median visit gap ${lakshmi.medianGap} days, last visit ${lakshmi.daysSince} days ago, segment ${lakshmi.segment}`);
console.log(`Ghee · ${gheeUnits} sold in 28 days, ${ghee?.onHand ?? 0} on hand, ${forecast.daysLeft.toFixed(1)} days left, reorder ${forecast.reorderQty}`);
