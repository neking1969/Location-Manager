import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-west-2' });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = 'shards-budgets';

const BUDGET_CATEGORIES = [
  "Site Fees", "Addl. Site Fees", "Site Personnel", "Permits",
  "Addl. Labor", "Equipment", "Parking", "Fire", "Police", "Security"
];

const STANDARD_LINE_ITEMS = {
  "Site Fees": [
    { name: "Prep Days", defaultRate: 12500 },
    { name: "Shoot Days", defaultRate: 25000 },
    { name: "Wrap Days", defaultRate: 12500 },
    { name: "Hold Days", defaultRate: 12500 },
  ],
  "Addl. Site Fees": [
    { name: "Furniture/Artwork Removal", defaultRate: 1000 },
    { name: "Piano Moving Fee", defaultRate: 500 },
    { name: "Damage Deposit", defaultRate: 2500 },
    { name: "Key/Access Fee", defaultRate: 250 },
  ],
  "Site Personnel": [
    { name: "Site Rep (w/ Service)", defaultRate: 750 },
    { name: "Electrician", defaultRate: 1250 },
    { name: "Building Engineer", defaultRate: 800 },
  ],
  "Permits": [
    { name: "Permit Service Fee", defaultRate: 1500 },
    { name: "Permit Fee", defaultRate: 3000 },
    { name: "Neighbor Signatures", defaultRate: 750 },
    { name: "Notification", defaultRate: 750 },
    { name: "Posting Fees", defaultRate: 1200 },
    { name: "Curb Lane Closure", defaultRate: 950 },
    { name: "Fire Spot Check (City)", defaultRate: 220 },
    { name: "Flagmen", defaultRate: 1500 },
  ],
  "Addl. Labor": [
    { name: "A/C Operator (Timecard Submit)", defaultRate: 800 },
    { name: "Layout Tech (Timecard Submit)", defaultRate: 650 },
    { name: "Bathroom Attendant", defaultRate: 360 },
  ],
  "Equipment": [
    { name: "Port-A-Potty", defaultRate: 1250 },
    { name: "Restroom Services", defaultRate: 220 },
    { name: "Dumpsters", defaultRate: 250 },
    { name: "Maps", defaultRate: 95 },
    { name: "Signs & Cones", defaultRate: 200 },
    { name: "Layout Board", defaultRate: 4000 },
    { name: "Cleaning", defaultRate: 750 },
    { name: "Restoration", defaultRate: 500 },
    { name: "Changing Trailers", defaultRate: 1100 },
    { name: "Glo Bug", defaultRate: 175 },
    { name: "A/C Unit (Incl. Delivery)", defaultRate: 2750 },
    { name: "Propane Space Heater", defaultRate: 125 },
    { name: "Box Heater", defaultRate: 225 },
  ],
  "Parking": [
    { name: "Trucks and Basecamp Parking", defaultRate: 5000 },
    { name: "Over Weekend Parking", defaultRate: 5000 },
    { name: "Crew Parking", defaultRate: 2500 },
  ],
  "Fire": [
    { name: "LA County Fire Officer", defaultRate: 2450 },
    { name: "Fire Safety Officer", defaultRate: 1800 },
  ],
  "Police": [
    { name: "LAPD", defaultRate: 2120 },
    { name: "Motor Rental", defaultRate: 150 },
    { name: "Sheriff Deputy", defaultRate: 1950 },
  ],
  "Security": [
    { name: "Shoot Day", defaultRate: 400 },
    { name: "Prep Day", defaultRate: 400 },
    { name: "Wrap Day", defaultRate: 400 },
    { name: "Overnight Security", defaultRate: 400 },
    { name: "Weekend Guards", defaultRate: 400 },
    { name: "Supervisor", defaultRate: 420 },
  ],
};

const CATEGORY_DISTRIBUTION = {
  "Site Fees": 0.53, "Addl. Site Fees": 0.015, "Site Personnel": 0.01,
  "Permits": 0.10, "Addl. Labor": 0.025, "Equipment": 0.13,
  "Parking": 0.055, "Fire": 0.03, "Police": 0.05, "Security": 0.035,
};

const budgets = [
  {
    id: "EP101", episode: "Episode 101", total: 3050428, date: "2025-10-31", status: "locked", locations: [
      { name: "Debbie's House Sunset Blvd", total: 476540 },
      { name: "Village Theater - Westwood", total: 559168 },
      { name: "Buckley Courtyard / Parking Lot- 101 and 102", total: 265635 },
      { name: "Galleria Mall", total: 334475 },
      { name: "Matt's Pool House/Keller Residence (101 & 102)", total: 203725 },
      { name: "Latchford House", total: 209400 },
      { name: "Supermarket - Beachwood Village", total: 84285 },
      { name: "Galleria Parking Lot/Driving", total: 48880 },
      { name: "Ext. Mullholland Drive & Ext. LA- Driving", total: 55840 },
      { name: "Ext. Valley Vista- Driving", total: 62800 },
      { name: "Ext. LA- Bel Air Mansion", total: 64285 },
      { name: "The Stables", total: 84425 },
      { name: "Woodland Hills Tennis Court", total: 52660 },
      { name: "Ext. Ventura Blvd/Int. Brets Car- Driving", total: 98390 },
      { name: "Tower Records", total: 52730 },
      { name: "Bret's House", total: 317990 },
      { name: "High School Party (Summer Night)", total: 25595 },
      { name: "3rd Floor Parking Garage (Pico Blvd)", total: 53605 },
    ],
  },
  {
    id: "EP102", episode: "Episode 102", total: 799975, date: "2025-11-05", status: "active", locations: [
      { name: "Melrose Video Bar", total: 244420 },
      { name: "Int. Hancock Park House/BH Home", total: 101150 },
      { name: "Parking Lot by the Ocean/Remote Beach/ PCH Driving", total: 79355 },
      { name: "Brentwood Home", total: 84955 },
      { name: "West Hollywood Bungalow", total: 84505 },
      { name: "Suburban House", total: 74230 },
      { name: "Palace Theater", total: 93130 },
      { name: "Ext. Melrose Video Bar", total: 38230 },
    ],
  },
  {
    id: "EP104", episode: "Episode 104", total: 1389689, date: "2025-12-09", status: "locked", locations: [
      { name: "Le Dome", total: 213985 },
      { name: "Buckley - Gymnasium & Assembly", total: 120115 },
      { name: "Ext. LA Street (Richard Ramirez)", total: 60235 },
      { name: "Moonlight Roller Rink", total: 141565 },
      { name: "Benedict Canyon House", total: 149479 },
      { name: "Ext Malibu Remote Beach", total: 86480 },
      { name: "Ext Secret Street", total: 38230 },
      { name: "Ext Sherman Oaks- (4 way intersection)", total: 54120 },
      { name: "Buckley Courtyard / Parking Lot- 104", total: 241385 },
      { name: "Matt's Pool House/Keller Residence-104", total: 173630 },
      { name: "Ext. Mullholland Drive (WOODLEY AVE)", total: 67235 },
      { name: "Hotel Cortez (Upholstery)", total: 43230 },
      { name: "Ext. Roller Rink Alley", total: 0 },
    ],
  },
  {
    id: "EP105", episode: "Episode 105", total: 821355, date: "2026-01-06", status: "active", locations: [
      { name: "Susan's House", total: 631625 },
      { name: "Ext. Warehouse (Erotica Studios)", total: 15365 },
      { name: "Ryan's House", total: 174365 },
    ],
  },
  {
    id: "EP106", episode: "Episode 106", total: 120795, date: "2026-01-16", status: "active", locations: [
      { name: "Sunset Las Palmas - Stage - Dance Off", total: 120795 },
    ],
  },
  {
    id: "EP107", episode: "Episode 107", total: 1071535, date: "2026-01-30", status: "active", locations: [
      { name: "Police Station", total: 147420 },
      { name: "Buckley", total: 272460 },
      { name: "School Bleachers, Football Field & Hallway (Verdugo Hills High)", total: 261095 },
      { name: "Kellner Residence", total: 196705 },
      { name: "Ext. Playground - Crime Scene", total: 37635 },
      { name: "Int. School - Classroom, Classroom #2, Ext School Courtyard, Ext. School Hallway", total: 153670 },
      { name: "Int. Sound Stage (Sunset Las Palmas)", total: 2550 },
    ],
  },
  {
    id: "EP108", episode: "Episode 108", total: 1095555, date: "2026-02-03", status: "active", locations: [
      { name: "Police Station", total: 147420 },
      { name: "Buckley", total: 272460 },
      { name: "School Bleachers, Football Field & Hallway (Verdugo Hills High)", total: 285115 },
      { name: "Kellner Residence", total: 196705 },
      { name: "Ext. Playground - Crime Scene", total: 37635 },
      { name: "Int. School - Classroom, Classroom #2, Ext School Courtyard, Ext. School Hallway", total: 153670 },
      { name: "Int. Sound Stage (Sunset Las Palmas)", total: 2550 },
    ],
  },
];

function normalizeLocationId(name) {
  return name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').substring(0, 80);
}

let liCounter = 0;

function generateLineItems(budgetId, locationId, locationTotal) {
  const items = [];
  let remaining = locationTotal;

  BUDGET_CATEGORIES.forEach((catName, catIndex) => {
    const isLast = catIndex === BUDGET_CATEGORIES.length - 1;
    const catTotal = isLast ? remaining : Math.round(locationTotal * CATEGORY_DISTRIBUTION[catName]);
    remaining -= catTotal;

    const standardItems = STANDARD_LINE_ITEMS[catName] || [];
    let itemRemaining = catTotal;

    standardItems.forEach((template, itemIndex) => {
      if (itemRemaining <= 0) return;
      const isLastItem = itemIndex === standardItems.length - 1;
      const qty = catName === "Site Fees" ? Math.ceil(Math.random() * 3 + 1) : 1;
      let subtotal;
      if (isLastItem) {
        subtotal = Math.max(0, itemRemaining);
      } else {
        subtotal = Math.min(itemRemaining, Math.round(template.defaultRate * qty));
      }
      if (subtotal > 0) {
        const rate = qty > 0 ? Math.round(subtotal / qty) : subtotal;
        items.push({
          PK: budgetId,
          SK: `LI#${locationId}#seed-${++liCounter}`,
          category: catName,
          name: template.name,
          quantity: qty,
          rate,
          units: 1,
          subtotal
        });
        itemRemaining -= subtotal;
      }
    });
  });

  return items;
}

async function writeBatch(items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: batch.map(item => ({ PutRequest: { Item: item } }))
      }
    }));
  }
}

async function main() {
  console.log('Seeding budget data to DynamoDB...');
  let totalItems = 0;
  let totalLineItems = 0;
  let totalLocations = 0;

  for (const budget of budgets) {
    const allItems = [];

    // META record
    allItems.push({
      PK: budget.id,
      SK: 'META',
      episode: budget.episode,
      title: '',
      date: budget.date,
      status: budget.status,
      total: budget.total,
      locationCount: budget.locations.length,
    });

    // Location + line item records
    for (const loc of budget.locations) {
      const locationId = normalizeLocationId(loc.name);
      allItems.push({
        PK: budget.id,
        SK: `LOC#${locationId}`,
        name: loc.name,
        total: loc.total,
        address: '',
        contactName: '',
        notes: '',
      });
      totalLocations++;

      if (loc.total > 0) {
        const lineItems = generateLineItems(budget.id, locationId, loc.total);
        allItems.push(...lineItems);
        totalLineItems += lineItems.length;
      }
    }

    console.log(`  ${budget.episode}: ${budget.locations.length} locations, ${allItems.length - 1 - budget.locations.length} line items`);
    await writeBatch(allItems);
    totalItems += allItems.length;
  }

  console.log(`\nDone! Wrote ${totalItems} total items:`);
  console.log(`  ${budgets.length} budgets`);
  console.log(`  ${totalLocations} locations`);
  console.log(`  ${totalLineItems} line items`);
}

main().catch(console.error);
