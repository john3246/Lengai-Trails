# Builds landing/data/new-packages.json: 11 extra trips (luxury, balloon, migration, Kilimanjaro), original wording.
import json, pathlib

INC_S = ["Private 4x4 safari vehicle with pop-up roof", "English-speaking professional driver-guide", "National park, conservation and crater fees", "Accommodation and meals as listed in the itinerary", "Airport transfers", "Bottled drinking water on game drives", "Government taxes and VAT"]
EXC_S = ["International flights and visa fees", "Travel and medical insurance (required for Tanzania)", "Alcoholic and soft drinks", "Tips for your guide and camp staff", "Personal expenses and souvenirs", "Optional activities not listed in the itinerary"]
QUOTE = "Final price depends on group size, travel dates and accommodation level. Request a quote with your dates."


def D(day, title, body, meals, stay=None):
    m = {"Meals": meals}
    if stay:
        m["Accommodation"] = stay
    return {"day": day, "title": title, "body": [body], "meta": m}


def safari(slug, title, days, sub, tags, img, price, overview, hl, itin, inc_extra=(), note=QUOTE):
    return {"slug": slug, "title": title, "category": "safari", "subcategory": sub, "tags": tags, "type": "Private", "days": days,
            "overview": overview, "highlights": hl, "itinerary": itin, "inclusions": list(inc_extra) + INC_S, "exclusions": EXC_S,
            "notes": [note], "price_tiers": [], "price_single": price, "price_from": price,
            "price_note": "From, per person, based on two travellers sharing.", "image": img, "source": "web-import-v1", "sort": 600}


P = []
P.append(safari("4-day-luxury-tanzania-safari", "4 Day Luxury Tanzania Safari", 4, "Luxury", ["luxury", "fly-out"], "assets/img/tarangire-13-card.webp", 3000,
 ["A short, comfortable northern-circuit safari for travellers who want premium lodges and the Serengeti without a long itinerary. You game-drive Tarangire among elephants and baobabs, spend a night in the Serengeti, then fly back to Arusha."],
 ["Tarangire elephants and baobabs", "Central Serengeti predators", "Scenic flight back to Arusha"],
 [D(1, "Arrival in Arusha", "We meet you at Kilimanjaro or Arusha airport and take you to a luxury hotel in Arusha. In the evening your guide runs a safari briefing.", "Dinner", "Luxury hotel, Arusha"),
  D(2, "Tarangire National Park", "A full day of game driving through Tarangire, known for large elephant herds, baobab groves and the Tarangire River. Lunch is a picnic in the park.", "Breakfast, Lunch, Dinner", "Luxury lodge or camp, Tarangire"),
  D(3, "Serengeti National Park", "Drive through the Ngorongoro Conservation Area and descend to the plains. An afternoon game drive around Seronera looks for lions, leopards and cheetahs.", "Breakfast, Lunch, Dinner", "Luxury lodge, Serengeti"),
  D(4, "Final game drive and flight to Arusha", "A last early drive in the central Serengeti, then a scheduled flight back to Arusha for your onward travel.", "Breakfast, Lunch box")],
 ["Domestic flight from the Serengeti to Arusha"]))

P.append(safari("5-day-luxury-wildebeest-migration-safari", "5 Day Luxury Wildebeest Migration Safari (Serengeti Focus)", 5, "Luxury", ["luxury", "migration"], "assets/img/serengeti-04-card.webp", 4500,
 ["Five days built around the Serengeti and the Great Migration, with three nights inside the park so your guide can follow the herds. The trip starts in Tarangire and finishes with a morning in Ngorongoro Crater."],
 ["Three nights in the Serengeti", "Follow the migration herds", "Half day in Ngorongoro Crater"],
 [D(1, "Arrival and transfer to Tarangire", "After airport pickup you drive through Maasai country to Tarangire for an afternoon game drive along the river among elephant herds and baobabs.", "Lunch, Dinner", "Luxury lodge, Tarangire"),
  D(2, "Central Serengeti", "Cross the Ngorongoro Conservation Area to the Serengeti and start the Seronera game drive, a stronghold for resident big cats.", "Breakfast, Lunch, Dinner", "Luxury lodge, Serengeti"),
  D(3, "Full-day migration safari", "Your guide positions the vehicle wherever the herds are, whether river crossings, open plains or northern routes, with chances to see lions, cheetahs and hyenas.", "Breakfast, Lunch, Dinner", "Luxury camp, Serengeti"),
  D(4, "Extended Serengeti exploration", "A flexible day across kopjes, river valleys and grassland, following wildlife movements.", "Breakfast, Lunch, Dinner", "Luxury camp, Serengeti"),
  D(5, "Ngorongoro Crater and departure", "After an early breakfast you descend into the crater for a half-day game drive, then transfer to Arusha or Kilimanjaro airport after lunch.", "Breakfast, Lunch")]))

P.append(safari("7-day-luxury-big-five-wildebeest-migration-safari", "7 Day Luxury Big Five & Wildebeest Migration Safari", 7, "Luxury", ["luxury", "migration", "big-five"], "assets/img/tarangire-15-card.webp", 5900,
 ["A full northern-circuit safari in luxury lodges, covering Tarangire, three nights in the Serengeti, Ngorongoro Crater and Lake Manyara. Timed for the Big Five and the migration herds."],
 ["Tarangire, Serengeti, Ngorongoro and Manyara", "Three nights in the Serengeti", "Crater-rim lodge at sunset"],
 [D(1, "Arrival in Arusha", "Airport pickup, hotel transfer and an evening briefing with your guide.", "Dinner", "Hotel, Arusha"),
  D(2, "Tarangire National Park", "A full day among elephants and baobabs with a picnic lunch in the park.", "Breakfast, Lunch, Dinner", "Luxury lodge, Tarangire"),
  D(3, "Into the Serengeti", "Travel via the Ngorongoro Conservation Area. The first game drive concentrates on predators and migration herds.", "Breakfast, Lunch, Dinner", "Luxury lodge, Serengeti"),
  D(4, "Full-day Serengeti safari", "A flexible day over plains, river valleys and kopjes to maximise sightings.", "Breakfast, Lunch, Dinner", "Luxury camp, Serengeti"),
  D(5, "Serengeti to Ngorongoro", "A morning game drive, then on to a crater-rim lodge in time for sunset over the caldera.", "Breakfast, Lunch, Dinner", "Crater-rim lodge, Ngorongoro"),
  D(6, "Ngorongoro Crater and Lake Manyara", "Half a day on the crater floor, a picnic lunch, then the drive to Lake Manyara.", "Breakfast, Lunch, Dinner", "Lodge, Lake Manyara"),
  D(7, "Lake Manyara and return to Arusha", "A morning game drive for flamingos, elephants and tree-climbing lions, then transfer to Arusha for your flight.", "Breakfast, Lunch")]))

P.append(safari("4-day-luxury-serengeti-hot-air-balloon-safari", "4 Day Luxury Serengeti Hot Air Balloon Safari", 4, "Luxury", ["luxury", "balloon"], "assets/img/serengeti-03-card.webp", 3500,
 ["Fly over the Serengeti plains at sunrise in a hot air balloon, land to a champagne bush breakfast, and add game drives and a morning in Ngorongoro Crater."],
 ["Sunrise balloon flight", "Champagne bush breakfast", "Ngorongoro Crater game drive"],
 [D(1, "Arrival and Central Serengeti game drive", "Transfer from the airport across the Ngorongoro Highlands to the Serengeti, with an afternoon game drive.", "Lunch, Dinner", "Luxury camp or lodge, Serengeti"),
  D(2, "Balloon safari and full-day game drive", "Leave before dawn for a balloon flight over the plains, then a champagne breakfast in the bush and a full day of game driving.", "Breakfast, Lunch, Dinner", "Luxury camp, Serengeti"),
  D(3, "Serengeti morning drive and transfer to Ngorongoro", "An early game drive over kopjes and river valleys, then the drive to a lodge on the crater rim.", "Breakfast, Lunch, Dinner", "Crater-rim lodge, Ngorongoro"),
  D(4, "Ngorongoro Crater and departure", "Descend early for a half-day game drive, picnic lunch, then return to Arusha or Kilimanjaro airport.", "Breakfast, Lunch")],
 ["Serengeti hot air balloon flight with champagne bush breakfast"],
 "Balloon flights depend on weather. " + QUOTE))

P.append(safari("6-day-luxury-great-migration-river-crossing-safari", "6 Day Luxury Great Migration River Crossing Safari (Northern Serengeti)", 6, "Luxury", ["luxury", "migration"], "assets/img/serengeti-04-card.webp", 4800,
 ["Stay two nights in the northern Serengeti close to the Mara River crossing points, the best place to see the migration from July to October. The route starts at Lake Manyara and ends in Ngorongoro Crater."],
 ["Two nights near the Mara River", "Best from July to October", "Lake Manyara and Ngorongoro Crater"],
 [D(1, "Lake Manyara National Park", "Airport pickup, then an afternoon game drive for flamingos, elephants and tree-climbing lions.", "Lunch, Dinner", "Luxury lodge, Lake Manyara"),
  D(2, "Journey to the northern Serengeti", "A long scenic drive through the Ngorongoro highlands and the central Serengeti into the northern migration zone.", "Breakfast, Lunch, Dinner", "Luxury camp, Northern Serengeti"),
  D(3, "Mara River crossing safari", "A full day following the herds along the Mara River, positioned near active crossing points.", "Breakfast, Lunch, Dinner", "Luxury camp, Northern Serengeti"),
  D(4, "More migration action", "A second full day at the northern hotspots for more chances to see crossings and predators.", "Breakfast, Lunch, Dinner", "Luxury camp, Northern Serengeti"),
  D(5, "Serengeti to the Ngorongoro rim", "A last morning game drive, then the drive south to a crater-rim lodge for sunset over the caldera.", "Breakfast, Lunch, Dinner", "Crater-rim lodge, Ngorongoro"),
  D(6, "Ngorongoro Crater and departure", "Half a day on the crater floor for rhinos, lions, elephants and flamingos, then a picnic lunch and transfer to the airport.", "Breakfast, Lunch")],
 [], "River crossings cannot be guaranteed; they depend on the herds. " + QUOTE))

P.append(safari("5-day-midrange-migration-safari", "5 Day Midrange Migration Safari", 5, "Midrange", ["midrange", "migration"], "assets/img/serengeti-04-card.webp", 2000,
 ["A midrange five-day safari timed for the July to October migration, with nights in Tarangire, Central Serengeti and the northern Serengeti near the Mara River."],
 ["Mara River migration viewing", "Tarangire elephants", "Ngorongoro Crater finale"],
 [D(1, "Tarangire National Park", "Drive from Arusha for an afternoon game drive for elephants and other wildlife along the Tarangire River.", "Lunch, Dinner", "Midrange lodge, Tarangire"),
  D(2, "Central Serengeti", "Enter via Naabi Hill Gate and game-drive Seronera, a hub for predators and migrating herds.", "Breakfast, Lunch, Dinner", "Tented camp, Central Serengeti"),
  D(3, "Northern Serengeti", "Head north to the Mara River, where your guide tracks herd movements and crossing activity.", "Breakfast, Lunch, Dinner", "Migration camp, Northern Serengeti"),
  D(4, "Back to Central Serengeti", "Spend the morning on migration viewing in the north, then drive south with game viewing along the way.", "Breakfast, Lunch, Dinner", "Tented camp, Central Serengeti"),
  D(5, "Ngorongoro Crater", "Descend about 600 metres for a full crater game drive with a picnic lunch, then return to Arusha.", "Breakfast, Lunch")],
 ["Binoculars and a wildlife guidebook"], "An optional hot air balloon flight can be added. " + QUOTE))

P.append(safari("3-day-serengeti-hot-air-balloon-safari", "3 Day Serengeti Hot Air Balloon Safari", 3, "Balloon", ["balloon", "luxury"], "assets/img/serengeti-02.webp", 1900,
 ["A quick Serengeti break built around a sunrise balloon flight and a champagne breakfast in the bush, with game drives either side. You drive in and out from Arusha."],
 ["Sunrise balloon flight", "Champagne bush breakfast", "Full-day Serengeti game drive"],
 [D(1, "Arrival and Central Serengeti", "An early start from Arusha through the Ngorongoro Conservation Area into the Serengeti, with an afternoon game drive for lions, elephants, giraffes and zebras.", "Lunch, Dinner", "Tented camp or lodge, Central Serengeti"),
  D(2, "Sunrise balloon safari and full game drive", "Travel to the launch site before dawn for a balloon flight, then a champagne breakfast in the bush and a full day of game driving.", "Breakfast, Lunch, Dinner", "Lodge or tented camp, Central Serengeti"),
  D(3, "Final game drive and return to Arusha", "An early game drive, breakfast, and the scenic drive back to Arusha with hotel or airport drop-off in the afternoon.", "Breakfast, Lunch")],
 ["Serengeti hot air balloon flight with champagne bush breakfast"],
 "Balloon flights depend on weather. " + QUOTE))

P.append(safari("5-day-midrange-serengeti-ngorongoro-safari", "5 Day Midrange Safari: Serengeti & Ngorongoro Crater", 5, "Midrange", ["midrange"], "assets/img/ngorongoro-09-card.webp", 2050,
 ["Three nights in the Serengeti and a night on the Ngorongoro rim: a simple midrange route that puts the time where the wildlife is."],
 ["Three nights in the Serengeti", "Seronera big cats", "Ngorongoro Crater floor"],
 [D(1, "Arusha to the Serengeti", "Drive through the Ngorongoro highlands with a picnic lunch, then an afternoon game drive.", "Lunch, Dinner", "Midrange camp, Serengeti"),
  D(2, "Full-day Serengeti game drive", "Track big cats and seasonal herds with a bush picnic lunch.", "Breakfast, Lunch, Dinner", "Midrange camp, Serengeti"),
  D(3, "Serengeti exploration", "Morning and afternoon drives, for example in the Seronera Valley, depending on animal movement.", "Breakfast, Lunch, Dinner", "Midrange camp, Serengeti"),
  D(4, "Serengeti to Ngorongoro", "A morning game drive, then transfer to the conservation area and an afternoon at a crater-rim lodge.", "Breakfast, Lunch, Dinner", "Crater-rim lodge, Ngorongoro"),
  D(5, "Crater safari and return", "An early descent for a half-day game drive, then lunch and the drive back to Arusha.", "Breakfast, Lunch")]))


def trek(slug, title, days, img, tiers, route, overview, itin):
    t = [{"pax": p, "usd": u} for p, u in tiers]
    return {"slug": slug, "title": title, "category": "trekking", "type": "", "days": days, "overview": overview, "highlights": route,
            "itinerary": itin,
            "inclusions": ["National park, camping or hut and rescue fees plus 18% VAT", "Certified English-speaking head guide, assistant guides, cook and porters", "Mountain tents, sleeping mats, mess tent and toilet tent", "All meals on the mountain and purified drinking water", "Emergency oxygen, pulse oximeter and first-aid kit", "Airport transfers and trailhead transport", "Pre-climb briefing and gear check"],
            "exclusions": ["International and domestic flights", "Tanzania visa fees", "Crew tips (suggested USD 250 to 350 per climber)", "Personal gear (rental available)", "Travel and medical insurance with high-altitude evacuation cover", "Alcohol and personal items"],
            "notes": ["Prices fall as the group grows. Confirm your quote with your dates."], "price_tiers": t, "price_single": None,
            "price_from": min(u for _, u in tiers), "price_note": "Price per person by group size.", "image": img, "source": "web-import-v1", "sort": 700}


def day(n, title, body, elev, camp, meals="Breakfast, Lunch, Dinner"):
    m = {"Meals": meals, "Accommodation": camp}
    if elev:
        m["Elevation"] = elev
    return {"day": n, "title": title, "body": [body], "meta": m}


TIERS = [(1, 4092), (2, 3647), (3, 3495), (4, 3475), (5, 3350), (6, 3297), (7, 3231)]
start = [day(0, "Arrival in Tanzania", "Arrive at Kilimanjaro airport, transfer to Arusha and meet your guide for a briefing and gear check.", None, "Hotel, Arusha", "Dinner"),
 day(1, "Arusha to Londorossi Gate and Big Tree Camp", "Drive to the western gate, register, and walk through humid rainforest to camp.", "Gate 2,100 m", "Big Tree Camp"),
 day(2, "Big Tree Camp to Shira 1 Camp", "Climb out of the forest into open moorland.", None, "Shira 1 Camp"),
 day(3, "Shira 1 to Shira 2 Camp", "A gentle crossing of the Shira Plateau with views of Mount Meru.", "About 3,500 m", "Shira 2 Camp"),
 day(4, "Shira 2 to Moir Camp", "Move to a quieter area with optional ridge walks for acclimatisation.", None, "Moir Camp")]
end10 = [day(10, "Mweka Camp to Mweka Gate", "Walk down through the rainforest, collect your summit certificate and return to Arusha for a celebration dinner.", None, "Hotel, Arusha")]

P.append(trek("10-day-mount-kilimanjaro-climbing-via-lemosho-route-day-summit", "10 Day Mount Kilimanjaro Climb via Lemosho Route (Daylight Summit)", 10, "assets/img/kilimanjaro-04-card.webp", TIERS,
 ["Lemosho route", "Daylight summit", "Uhuru Peak, 5,895 m"],
 ["A slow, scenic Lemosho ascent from the west with extra acclimatisation days and a daylight summit push to Uhuru Peak. The long schedule raises summit success rates."],
 start + [day(5, "Moir Camp to Barranco Camp via Lava Tower", "Climb to Lava Tower, then descend into the Barranco Valley to sleep lower.", "Lava Tower 4,630 m", "Barranco Camp"),
  day(6, "Barranco to Karanga Camp", "Climb the Barranco Wall, then cross ridges and valleys.", None, "Karanga Camp"),
  day(7, "Karanga to Barafu Camp", "Walk through alpine desert to base camp and rest early. An optional upgrade stays at Kosovo Camp.", "Barafu 4,640 m", "Barafu Camp"),
  day(8, "Summit day: Uhuru Peak", "Start at dawn, climb in daylight to the roof of Africa, then descend to Barafu.", "Summit 5,895 m", "Barafu Camp"),
  day(9, "Barafu to Mweka Camp", "Descend through alpine desert and moorland into forest.", None, "Mweka Camp")] + end10))

P.append(trek("10-day-mount-kilimanjaro-climbing-via-northern-circuit-route-day-summit", "10 Day Mount Kilimanjaro Climb via Northern Circuit (Daylight Summit)", 10, "assets/img/kilimanjaro-08-card.webp", TIERS,
 ["Northern Circuit", "Quietest side of the mountain", "Uhuru Peak, 5,895 m"],
 ["The Northern Circuit is Kilimanjaro's longest and most gradual route, looping around the quiet northern slopes. It suits climbers who want the best acclimatisation and the fewest crowds."],
 start + [day(5, "Moir Camp to Buffalo Camp", "A quiet northern section with views toward Kenya.", None, "Buffalo Camp"),
  day(6, "Buffalo Camp to Third Cave Camp", "A sheltered acclimatisation stage.", None, "Third Cave Camp"),
  day(7, "Third Cave Camp to School Hut", "Climb through alpine desert and rest early before the summit push.", "School Hut 4,750 m", "School Hut"),
  day(8, "School Hut to Uhuru Peak", "Summit in daylight, then descend to Barafu Camp to recover.", "Summit 5,895 m", "Barafu Camp"),
  day(9, "Barafu to Mweka Camp", "Descend through alpine terrain back into the forest.", None, "Mweka Camp")] + end10))

hike = trek("1-day-kilimanjaro-day-hike-via-lemosho-route", "1 Day Kilimanjaro Day Hike via Lemosho Route", 1, "assets/img/kilimanjaro-06-card.webp", [(1, 530), (2, 450), (4, 390), (6, 320)],
 ["No camping", "Shira Plateau views", "Lemosho route"],
 ["A one-day walk on the western side of Kilimanjaro for people who want the mountain without a multi-day climb. You hike from Londorossi Gate through montane forest to the Shira Plateau at about 3,600 m."],
 [day(1, "Londorossi Gate to the Shira Plateau", "Early pickup from Arusha or Moshi (2.5 to 3.5 hours), breakfast, then a demanding hike through forest to the plateau. Stop for lunch there or continue toward Shira 1 Camp and Lion Gorge, then return to the gate and transfer back.", "Up to 3,600 m", "None, return same day", "Breakfast, Lunch box")])
hike["inclusions"] = ["Pickup and drop-off", "English-speaking driver", "Professional trekking guide", "Lunch box and water", "Park fees and taxes"]
hike["exclusions"] = ["Personal items and hiking gear", "Guide gratuities", "Extra transfers after the trek", "Travel insurance (required for Tanzania)"]
hike["price_note"] = "Price per person by group size (1, 2 to 3, 4 to 5, 6 to 7)."
P.append(hike)

out = pathlib.Path(__file__).resolve().parent.parent / "landing" / "data" / "new-packages.json"
out.write_text(json.dumps(P, indent=2, ensure_ascii=False), encoding="utf-8")
print(len(P), "packages ->", out)
