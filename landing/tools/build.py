import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = "assets/img/"

NAV = [
    ("index.html", "Home", []),
    ("destinations.html", "Destinations", [("Northern Tanzania", "destinations.html#northern"), ("Southern Tanzania", "destinations.html#southern"), ("The Coast", "destinations.html#coast"), ("Mountains", "destinations.html#mountains")]),
    ("safaris.html", "Safaris", [("All safaris", "safaris.html"), ("Luxury", "safaris.html?f=luxury"), ("Midrange", "safaris.html?f=midrange"), ("Family", "safaris.html?f=family"), ("Honeymoon", "safaris.html?f=honeymoon")]),
    ("group-safari.html", "Group Safari", [("3 Day Joining Safari", "group-safari.html#joining"), ("What is included", "group-safari.html#included")]),
    ("kilimanjaro.html", "Kilimanjaro", [("Climbing routes", "kilimanjaro.html#routes"), ("Why climb with us", "kilimanjaro.html#why")]),
    ("contact.html", "Contact Us", []),
]


def head(title, desc):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} | Lengai Trails Expeditions</title>
<meta name="description" content="{desc}">
<link rel="icon" href="assets/logo-t.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
'''


def header(active):
    links = []
    for href, label, subs in NAV:
        cls = []
        if href == active:
            cls.append("is-active")
        if subs:
            menu = "".join(f'<a href="{h}">{t}</a>' for t, h in subs)
            links.append(f'<div class="nav__item"><a href="{href}" class="dd {" ".join(cls)}">{label}</a><div class="submenu">{menu}</div></div>')
        else:
            links.append(f'<a href="{href}" class="{" ".join(cls)}">{label}</a>')
    nav = "\n      ".join(links)
    def top(href, label):
        return f'<a href="{href}" class="hide-m">{label}</a>'
    return f'''<!-- Top bar -->
<div class="topbar">
  <div class="wrap topbar__in">
    <div class="topbar__l">
      <a href="tel:+255000000000">&#9742; +255 000 000 000</a>
      <a href="mailto:info@lengaitrails.com">&#9993; info@lengaitrails.com</a>
      <span class="sep"></span>
      {top("accommodations.html", "Accommodations")}{top("blogs.html", "Blogs")}{top("about.html", "About Us")}{top("reviews.html", "Reviews")}
    </div>
    <div class="topbar__r hide-m">
      <span>Follow Lengai Trails Expeditions</span>
      <a class="soc" href="#" aria-label="Facebook">f</a><a class="soc" href="#" aria-label="Instagram">ig</a><a class="soc" href="#" aria-label="TikTok">tt</a>
    </div>
  </div>
</div>

<!-- Header -->
<header class="header">
  <div class="wrap header__in">
    <a class="brand" href="index.html" aria-label="Lengai Trails Expeditions home"><img src="assets/logo-light.png" alt="Lengai Trails Expeditions"></a>
    <nav class="nav" id="nav" aria-label="Main">
      {nav}
    </nav>
    <div class="header__r">
      <button class="iconbtn" aria-label="Search">&#9906;</button>
      <span class="lang">EN &#9662;</span>
      <a class="btn btn--gold btn--sm" href="contact.html">Book Now</a>
      <button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
'''


FOOTER = '''<!-- Footer -->
<footer class="footer">
  <div class="wrap footer__in">
    <div class="footer__brand"><img src="assets/logo-light.png" alt="Lengai Trails Expeditions"><p class="tagline">Your path to golden memories begins here</p><p>Private safaris, Kilimanjaro climbs and Zanzibar holidays, planned by a locally owned team in Arusha.</p></div>
    <div><h4>Useful links</h4><a href="index.html">Home</a><a href="safaris.html">Safaris</a><a href="destinations.html">Destinations</a><a href="accommodations.html">Accommodations</a><a href="group-safari.html">Group Safari</a><a href="kilimanjaro.html">Kilimanjaro</a><a href="reviews.html">Reviews</a><a href="about.html">About Us</a><a href="contact.html">Contact</a></div>
    <div><h4>Safari packages</h4><a href="safaris.html">Tanzania safari packages</a><a href="safaris.html?f=luxury">Luxury safari Tanzania</a><a href="safaris.html?f=midrange">Midrange safari Tanzania</a><a href="safaris.html?f=family">Family safari Tanzania</a><a href="safaris.html?f=honeymoon">Honeymoon safari Tanzania</a><a href="group-safari.html">Group joining safaris</a></div>
    <div><h4>Contact us</h4><span>Arusha, Tanzania</span><span>+255 000 000 000</span><span>info@lengaitrails.com</span></div>
  </div>
  <div class="footer__bar"><div class="wrap">&copy; <span id="yr">2026</span> Lengai Trails Expeditions. All rights reserved.</div></div>
</footer>

<script src="js/main.js"></script>
</body>
</html>
'''


def phero(h1, sub, img, crumb):
    return f'''<section class="phero">
  <img class="phero__bg" src="{IMG}{img}" alt="">
  <div class="phero__shade"></div>
  <div class="wrap phero__in">
    <p class="crumb"><a href="index.html">Home</a> / {crumb}</p>
    <h1>{h1}</h1>
    <p>{sub}</p>
  </div>
</section>
'''


def sechead(eyebrow, title, right=""):
    r = f"<div>{right}</div>" if right.startswith("<a") else (f"<p>{right}</p>" if right else "")
    return f'<div class="sec__head"><div><p class="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{r}</div>'


def trip(img, meta, title, route, price=None, cat="", extra=""):
    p = f'<p class="from">From <strong>USD {price}</strong> / person</p>' if price else '<p class="from">Price on request</p>'
    return (f'<article class="trip" data-cat="{cat}"><div class="trip__img"><img src="{IMG}{img}" alt="" loading="lazy"></div>'
            f'<div class="trip__b"><p class="meta">{meta}</p>{p}<h3>{title}</h3><p class="route">{route}</p>{extra}'
            f'<a class="link" href="contact.html">Request a quote &rarr;</a></div></article>')


def cta(title="Start planning your Tanzania trip", text="Share your dates, group size and interests. A travel consultant in Arusha will reply with a tailor-made itinerary and a clear, all-inclusive price."):
    return f'''<section class="cta"><div class="wrap cta__in"><div><h2>{title}</h2><p>{text}</p></div><a class="btn btn--dark" href="contact.html">Request a free quote</a></div></section>
'''


def page(fname, active, title, desc, body):
    html = head(title, desc) + header(active) + '\n<main id="main">\n' + body + '</main>\n\n' + FOOTER
    (ROOT / fname).write_text(html, encoding="utf-8")


# ---------- Destinations ----------
def dest_block(id_, eyebrow, title, text, img, items, flip=False):
    li = "".join(f"<li><strong>{n}</strong><span>{d}</span></li>" for n, d in items)
    return f'''<section class="sec{" sec--mist" if flip else ""}" id="{id_}"><div class="wrap dsplit{" dsplit--flip" if flip else ""}">
  <div class="dsplit__img"><img src="{IMG}{img}" alt="{title}" loading="lazy"></div>
  <div class="dsplit__t"><p class="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p><ul class="plist">{li}</ul><a class="btn btn--dark btn--sm" href="safaris.html">View safaris</a></div>
</div></section>
'''

dest = phero("Tanzania destinations", "The Northern Circuit for the classic Big Five, the south for wilderness without the crowds, and the coast for white sand and Swahili history.", "ngorongoro-01.webp", "Destinations")
dest += dest_block("northern", "Northern Tanzania", "The Northern Circuit", "Tanzania&rsquo;s most popular safari route: huge herds, the world&rsquo;s largest intact caldera and big-cat country, all within reach of Arusha.", "ngorongoro-09-card.webp", [("Serengeti", "Endless plains and the Great Migration"), ("Ngorongoro Crater", "A wildlife-packed volcanic caldera"), ("Tarangire", "Giant baobabs and elephant herds"), ("Lake Manyara", "Tree-climbing lions and flamingos")])
dest += dest_block("southern", "Southern Tanzania", "Wilderness without the crowds", "Boat safaris, walking safaris and open bush with far fewer vehicles. Ideal for a second visit or a quieter trip.", "ruaha-05-card.webp", [("Nyerere National Park", "Boats, walks and the wild south"), ("Ruaha", "Rugged country and big lion prides"), ("Mikumi", "Easy-access savanna close to Dar es Salaam")], True)
dest += dest_block("coast", "The Coast", "Zanzibar &amp; the Indian Ocean", "End your safari with white sand beaches, the lanes of Stone Town and spice farms on Zanzibar.", "zanzibar-08-card.webp", [("Stone Town", "Swahili history and winding lanes"), ("Beaches", "Quiet white sand and warm water"), ("Spice farms", "Taste and smell the Spice Island")])
dest += dest_block("mountains", "Mountains", "Kilimanjaro &amp; beyond", "Africa&rsquo;s highest peak and fully supported climbs on six routes, with experienced mountain guides.", "kilimanjaro-01-card.webp", [("Kilimanjaro", "Marangu, Machame, Lemosho, Rongai, Umbwe, Northern Circuit"), ("Acclimatisation", "Itineraries built to give you the best chance of the summit")], True)
dest += cta()
page("destinations.html", "destinations.html", "Tanzania Destinations", "Explore Tanzania by region: the Northern Circuit, the south, Zanzibar and the coast, and Kilimanjaro.", dest)

# ---------- Safaris ----------
packages = [
    ("serengeti-03-card.webp", "8 Days / 7 Nights", "8 Day Luxury Tanzania Safari &amp; Zanzibar Beach Escape", "Arusha &middot; Tarangire &middot; Serengeti &middot; Ngorongoro &middot; Zanzibar", "7,800", "luxury"),
    ("tarangire-01-card.webp", "4 Days / 3 Nights", "4 Day Midrange Private Safari", "Tarangire &middot; Serengeti &middot; Ngorongoro", "1,800", "midrange"),
    ("ngorongoro-02-card.webp", "6 Days / 5 Nights", "6 Day Family Tour Tanzania 2026&ndash;2027", "Arusha &middot; Lake Manyara &middot; Serengeti &middot; Ngorongoro", "2,275", "family"),
    ("zanzibar-08-card.webp", "7 Days / 6 Nights", "7 Day Ndutu &amp; Zanzibar Honeymoon Safari 2026&ndash;2027", "Arusha &middot; Tarangire &middot; Ndutu &middot; Ngorongoro &middot; Zanzibar", "3,200", "honeymoon"),
    ("tarangire-13-card.webp", "5 Days &middot; Christmas", "5 Day Tanzania Christmas Safari 2026", "Tarangire &middot; Serengeti &middot; Ngorongoro", "2,986", "midrange"),
    ("giraffe-sunset-silhouette-28-card.webp", "6 Days &middot; New Year", "6 Day Tanzania New Year Holiday Safari 2027", "Tarangire &middot; Serengeti &middot; Ngorongoro", "2,512", "midrange"),
    ("tarangire-15-card.webp", "7 Days &middot; Family", "7 Day Tanzania Family Safari Adventure", "Tarangire &middot; Serengeti &middot; Ngorongoro", "2,005", "family"),
    ("zanzibar-21-card.webp", "10 Days &middot; Honeymoon", "10 Day Tanzania Honeymoon Safari &amp; Zanzibar Escape", "Tarangire &middot; Serengeti &middot; Ngorongoro &middot; Zanzibar", "4,476", "honeymoon"),
    ("zanzibar-04-card.webp", "8 Days &middot; Luxury", "8 Day Fly Out Luxury Tanzania Safari &amp; Zanzibar Holiday", "Ngorongoro &middot; Serengeti &middot; Zanzibar", "6,185", "luxury"),
    ("ngorongoro-09-card.webp", "6 Days &middot; Mid-range", "6-Day MidRange Tanzania Safari", "Tarangire &middot; Serengeti &middot; Ngorongoro", "2,737", "midrange"),
]
cards = "".join(trip(*p) for p in packages)
chips = "".join(f'<button class="chip{" is-on" if k == "all" else ""}" data-f="{k}">{l}</button>' for k, l in [("all", "All"), ("luxury", "Luxury"), ("midrange", "Midrange"), ("family", "Family"), ("honeymoon", "Honeymoon")])
saf = phero("Tanzania safari packages", "Private Tanzania safaris planned by a locally owned team in Arusha, with one clear price that shows exactly what is included.", "serengeti-04.webp", "Safaris")
saf += f'<section class="sec"><div class="wrap">{sechead("Safaris", "Choose your Tanzania adventure", "Every itinerary can be adjusted to your dates, budget and pace.")}<div class="chips" id="chips">{chips}</div><div class="grid g4" id="tripgrid">{cards}</div></div></section>\n'
saf += cta()
page("safaris.html", "safaris.html", "Tanzania Safari Packages", "Browse luxury, midrange, family and honeymoon Tanzania safari packages with clear per-person prices.", saf)

# ---------- Group safari ----------
grp = phero("Join a group safari", "Share the experience, not the cost. Fixed departures through the Northern Circuit with a professional guide.", "ngorongoro-01.webp", "Group Safari")
grp += f'''<section class="sec" id="joining"><div class="wrap dsplit">
  <div class="dsplit__img"><img src="{IMG}tarangire-01-card.webp" alt="" loading="lazy"></div>
  <div class="dsplit__t"><p class="eyebrow">Open 2026&ndash;2027</p><h2>3 Day Affordable Joining Safari</h2>
  <p class="pillrow"><span class="pill-meta">3 days / 2 nights</span><span class="pill-meta">From USD 800</span></p>
  <p>A three-day shared safari from Arusha covering Tarangire, Ngorongoro Crater, and Lake Manyara. You travel in a shared 4x4 with a professional English-speaking guide and stay two nights in lodge accommodation.</p>
  <div class="btns"><a class="btn btn--gold btn--sm" href="contact.html">Book this safari</a><a class="btn btn--dark btn--sm" href="contact.html">View open departures</a></div></div>
</div></section>
<section class="sec sec--mist" id="included"><div class="wrap">{sechead("What you get", "Shared vehicle &middot; Lodge nights")}
<div class="grid g4">
<div class="info"><h3>Three Northern Circuit parks</h3><p>Tarangire, Ngorongoro Crater and Lake Manyara in three days.</p></div>
<div class="info"><h3>Shared 4x4 and guide</h3><p>A professional English-speaking guide and a well maintained safari vehicle.</p></div>
<div class="info"><h3>Two nights in lodges</h3><p>Lodge accommodation with meals as per the itinerary.</p></div>
<div class="info"><h3>Fees included</h3><p>Park and crater fees are included in the price.</p></div>
</div></div></section>
<section class="sec"><div class="wrap">{sechead("Itinerary", "Your three days")}
<div class="days">
<div class="day"><span>Day 1</span><h3>Arusha to Tarangire</h3><p>Morning pick-up, game drive among baobabs and elephant herds, overnight at a lodge.</p></div>
<div class="day"><span>Day 2</span><h3>Lake Manyara &amp; Ngorongoro</h3><p>Early drive via Lake Manyara toward the crater highlands, overnight on the rim.</p></div>
<div class="day"><span>Day 3</span><h3>Ngorongoro Crater</h3><p>Descend into the crater for a full game drive, then return to Arusha.</p></div>
</div></div></section>
'''
grp += cta("Ready to join a group safari?", "Tell us your preferred dates and how many travellers. We will confirm the next open departure.")
page("group-safari.html", "group-safari.html", "Group Joining Safaris", "Affordable shared Tanzania safaris from Arusha covering Tarangire, Ngorongoro and Lake Manyara.", grp)

# ---------- Kilimanjaro ----------
routes = [
    ("kilimanjaro-06-card.webp", "6 Days / 5 Nights", "6 Day Mount Kilimanjaro Climbing Adventure via Marangu Route", "Kilimanjaro National Park", "1,910"),
    ("kilimanjaro-04-card.webp", "7 Days / 6 Nights", "7 Day Mount Kilimanjaro Climbing Adventure via Machame Route", "Kilimanjaro National Park", "2,762"),
    ("kilimanjaro-08-card.webp", "8 Days / 7 Nights", "8 Day Mount Kilimanjaro Trekking Adventure via Lemosho Route", "Kilimanjaro National Park", "3,136"),
    ("kilimanjaro-01-card.webp", "Rongai Route", "Mount Kilimanjaro via Rongai Route", "Kilimanjaro National Park", None),
    ("kilimanjaro-06-card.webp", "Umbwe Route", "Mount Kilimanjaro via Umbwe Route", "Kilimanjaro National Park", None),
    ("kilimanjaro-04-card.webp", "Northern Circuit", "Mount Kilimanjaro via Northern Circuit", "Kilimanjaro National Park", None),
]
kc = "".join(trip(r[0], r[1], r[2], r[3], r[4]) for r in routes)
kil = phero("Climb Kilimanjaro", "Fully supported climbs on six routes, with experienced mountain guides and itineraries built for acclimatisation.", "kilimanjaro-01.webp", "Kilimanjaro")
kil += f'<section class="sec" id="routes"><div class="wrap">{sechead("Mountain climbing &amp; treks", "Kilimanjaro climbing routes", "Marangu, Machame, Lemosho, Rongai, Umbwe and the Northern Circuit.")}<div class="grid g3">{kc}</div></div></section>\n'
kil += f'''<section class="sec sec--mist" id="why"><div class="wrap">{sechead("Why climb with us", "Built for the summit")}
<div class="grid g4">
<div class="info"><h3>Experienced guides</h3><p>Mountain guides who know every route and every weather window.</p></div>
<div class="info"><h3>Acclimatisation first</h3><p>Itineraries designed to give your body time to adjust.</p></div>
<div class="info"><h3>Fully supported</h3><p>Porters, cooks, tents and park fees handled for you.</p></div>
<div class="info"><h3>Safari add-on</h3><p>Pair your climb with a safari or a Zanzibar beach finish.</p></div>
</div></div></section>
'''
kil += cta("Plan your Kilimanjaro climb", "Tell us your dates and fitness level and we will recommend the best route.")
page("kilimanjaro.html", "kilimanjaro.html", "Kilimanjaro Climbing", "Fully supported Mount Kilimanjaro climbs on Marangu, Machame, Lemosho, Rongai, Umbwe and Northern Circuit routes.", kil)

# ---------- Accommodations ----------
acc = phero("Accommodations", "Carefully chosen lodges and camps to match your budget and the way you like to travel.", "serengeti-02.webp", "Accommodations")
tiers = [
    ("selous-01.webp", "Budget", "Budget lodges &amp; camps", "Clean, comfortable and well located, so more of your budget goes into the safari itself."),
    ("tarangire-17.webp", "Midrange", "Midrange lodges", "Comfortable rooms, good food and great locations inside or beside the national parks."),
    ("serengeti-04.webp", "Luxury", "Luxury lodges &amp; tented camps", "Spacious suites, private verandas and exceptional service deep in the wilderness."),
    ("zanzibar-04-card.webp", "Beach", "Zanzibar beach stays", "End your trip with a beachfront resort on the Indian Ocean."),
]
tc = "".join(f'<article class="trip"><div class="trip__img"><img src="{IMG}{i}" alt="" loading="lazy"></div><div class="trip__b"><p class="meta">{m}</p><h3>{t}</h3><p class="route">{d}</p><a class="link" href="contact.html">Ask about options &rarr;</a></div></article>' for i, m, t, d in tiers)
acc += f'<section class="sec"><div class="wrap">{sechead("Stay", "Where you will sleep", "We match lodges to your budget and itinerary, with one clear price.")}<div class="grid g4">{tc}</div></div></section>\n' + cta()
page("accommodations.html", "", "Accommodations", "Budget, midrange and luxury lodges and camps for your Tanzania safari, plus Zanzibar beach stays.", acc)

# ---------- Blogs ----------
guides = [
    ("serengeti-04.webp", "Tanzania safari guide", "When to go, which parks, what it costs"),
    ("selous-04.webp", "Fly-in safaris", "Bush flights, baggage limits, when they pay off"),
    ("serengeti-02.webp", "Serengeti balloon safari", "What to expect and how to book"),
    ("tarangire-17.webp", "Photographic safari", "Best parks, months and vehicle set-up"),
    ("selous-01.webp", "Camping safari", "What it is really like in the bush"),
    ("selous-05.webp", "Nyerere National Park", "Boats, walks and the wild south"),
]
gc = "".join(f'<a class="bcard" href="#"><img src="{IMG}{i}" alt="" loading="lazy"><div><p class="meta">Safari guide</p><h3>{t}</h3><p>{d}</p><span class="link">Read guide &rarr;</span></div></a>' for i, t, d in guides)
blg = phero("Safari guides &amp; blog", "Plan smarter with our Tanzania safari guides.", "tarangire-17.webp", "Blogs")
blg += f'<section class="sec"><div class="wrap">{sechead("Guides", "Plan smarter with our Tanzania safari guides")}<div class="grid g3">{gc}</div></div></section>\n' + cta()
page("blogs.html", "", "Safari Guides & Blog", "Tanzania safari guides: when to go, fly-in safaris, balloon safaris, photographic and camping safaris.", blg)

# ---------- About ----------
abt = phero("About us", "A Tanzanian company, built on local knowledge.", "ngorongoro-02-card.webp", "About Us")
abt += f'''<section class="sec"><div class="wrap dsplit">
  <div class="dsplit__t"><p class="eyebrow">Our story</p><h2>Locally owned, based in Arusha</h2>
  <p>Lengai Trails Expeditions is a locally owned tour operator based in Arusha. We plan private and small group safaris, Kilimanjaro climbs and Zanzibar stays around your dates, budget and pace.</p>
  <p>Named after Ol Doinyo Lengai, the Maasai &ldquo;Mountain of God&rdquo;, we believe the best journeys follow the trail less taken, with professional driver-guides, well maintained 4x4 vehicles, carefully chosen lodges and one clear price that shows exactly what is included.</p>
  <a class="btn btn--dark btn--sm" href="contact.html">Talk to our team</a></div>
  <div class="dsplit__img"><img src="{IMG}kilimanjaro-01-card.webp" alt="" loading="lazy"></div>
</div></section>
<section class="sec sec--mist"><div class="wrap">{sechead("What we stand for", "Our promise")}
<div class="grid g4">
<div class="info"><h3>Local knowledge</h3><p>Guides who grew up in the places you will visit.</p></div>
<div class="info"><h3>Clear pricing</h3><p>One price that shows exactly what is included.</p></div>
<div class="info"><h3>Tailor-made</h3><p>Every trip planned around your dates, budget and pace.</p></div>
<div class="info"><h3>Responsible travel</h3><p>Small groups and fair support for local communities.</p></div>
</div></div></section>
<section class="sec"><div class="wrap">{sechead("Meet the team", "The people planning your trip", "Team profiles will be added here.")}
<div class="grid g4">
<div class="member"><div class="avatar">LT</div><h3>Founder &amp; Director</h3><p>Name to be added</p></div>
<div class="member"><div class="avatar">LT</div><h3>Travel Consultant</h3><p>Name to be added</p></div>
<div class="member"><div class="avatar">LT</div><h3>Head Guide</h3><p>Name to be added</p></div>
<div class="member"><div class="avatar">LT</div><h3>Operations Manager</h3><p>Name to be added</p></div>
</div></div></section>
''' + cta()
page("about.html", "", "About Us", "Lengai Trails Expeditions is a locally owned tour operator based in Arusha, Tanzania.", abt)

# ---------- Reviews ----------
revs = [
    ("Great experience", "We had great time. Everything was organised well, we had no worries. The communication with the office was very easy and good all along.", "Tal, Israel &middot; visited July 2026"),
    ("Very attentive and considerate", "Everything went smoothly from the very first contact through to the end of the safari. They took the time to brief me properly and ensured everything was clear.", "Verified traveller"),
    ("Amazing experience, like a trip with the best friends", "It was a super organized trip, all that we wanted was included, we didn&rsquo;t have to worry about anything. They are very friendly and professional.", "Verified traveller"),
    ("An unforgettable experience", "While in Tanzania I wanted to see a bit of the country and the visit would not be complete without a safari. The whole team was helpful from start to finish.", "Verified traveller"),
    ("Delivered an experience beyond our expectations", "The safari exceeded our expectations. We were well taken care of at all times and the staff went above and beyond to make our trip truly unforgettable.", "Verified traveller"),
    ("Welcoming and supportive, an excellent host", "Very communicative, super on time, and went above and beyond to make sure we were alright. It all felt very reliable.", "Verified traveller"),
]
rc = "".join(f'<article class="review"><p class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</p><h3>{t}</h3><p>{b}</p><p class="who">{w}</p></article>' for t, b, w in revs)
rev = phero("Guest reviews", "Independent reviews from Tripadvisor, Google and SafariBookings.", "serengeti-03-card.webp", "Reviews")
rev += f'<section class="sec"><div class="wrap"><div class="rhead"><aside class="score"><p class="eyebrow">SafariBookings reviews</p><p class="score__n">5.0</p><p class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</p><p>33 reviews on SafariBookings</p></aside><div><p class="eyebrow">Guest reviews</p><h2>What our travellers say</h2><p class="rtxt">Our guests tell the story best. Read what they say about their guides, their lodges and the moments that made their trip.</p></div></div><div class="grid g3">{rc}</div></div></section>\n' + cta()
page("reviews.html", "", "Guest Reviews", "Read independent guest reviews of safaris and climbs in Tanzania.", rev)

# ---------- Contact ----------
con = phero("Contact us", "Share your dates, group size and interests. A travel consultant in Arusha will reply with a tailor-made itinerary and a clear, all-inclusive price.", "tarangire-13-card.webp", "Contact Us")
con += '''<section class="sec"><div class="wrap contact">
  <form class="form" id="quoteForm" novalidate>
    <h2>Request a free quote</h2>
    <div class="row"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label></div>
    <div class="row"><label>Phone / WhatsApp<input name="phone"></label><label>Travel dates<input name="dates" placeholder="e.g. July 2027"></label></div>
    <div class="row"><label>Interest<select name="interest"><option>Safari</option><option>Kilimanjaro climb</option><option>Group joining safari</option><option>Zanzibar holiday</option><option>Safari + Zanzibar</option></select></label><label>Travellers<input name="pax" type="number" min="1" value="2"></label></div>
    <label>Tell us about your trip<textarea name="msg" rows="4"></textarea></label>
    <button class="btn btn--gold" type="submit">Send request</button>
    <p class="note" id="formNote" role="status"></p>
  </form>
  <aside class="cinfo">
    <h3>Get in touch</h3>
    <p><strong>Office</strong><br>Arusha, Tanzania</p>
    <p><strong>Phone / WhatsApp</strong><br>+255 000 000 000</p>
    <p><strong>Email</strong><br>info@lengaitrails.com</p>
    <p><strong>Hours</strong><br>Monday to Saturday, 8:00 to 18:00 (EAT)</p>
  </aside>
</div></section>
<section class="sec sec--mist"><div class="wrap wrap--narrow"><div class="sec__head sec__head--center"><div><p class="eyebrow">FAQ</p><h2>Frequently asked questions</h2></div></div>
<details class="faq" open><summary>Where is Lengai Trails Expeditions based?</summary><p>We are a locally owned company based in Arusha, Tanzania.</p></details>
<details class="faq"><summary>Are your safaris private?</summary><p>Yes. Every itinerary can be private, and fixed-date joining safaris are available for a lower per-person price.</p></details>
<details class="faq"><summary>How quickly will you reply?</summary><p>A travel consultant replies with a tailor-made itinerary and a clear price, usually within one working day.</p></details>
<details class="faq"><summary>Do I need travel insurance?</summary><p>Yes, we recommend comprehensive travel insurance that covers medical care and evacuation.</p></details>
</div></section>
'''
page("contact.html", "contact.html", "Contact Us", "Contact Lengai Trails Expeditions in Arusha for a free, tailor-made Tanzania safari quote.", con)

# ---------- Sync index.html header/footer ----------
idx = (ROOT / "index.html").read_text(encoding="utf-8")
idx = re.sub(r"<!-- Top bar -->.*?</header>\n", lambda m: header("index.html"), idx, flags=re.S)
idx = re.sub(r"<!-- Footer -->.*?</footer>\n", lambda m: FOOTER.split("<script")[0], idx, flags=re.S)
for old, new in [('href="#featured"', 'href="safaris.html"'), ('href="#kilimanjaro"', 'href="kilimanjaro.html"'), ('href="#regions"', 'href="destinations.html"'), ('href="#group"', 'href="group-safari.html"'), ('href="#contact"', 'href="contact.html"'), ('href="#reviews"', 'href="reviews.html"'), ('href="#about"', 'href="about.html"'), ('href="#guides"', 'href="blogs.html"')]:
    idx = idx.replace(old, new)
(ROOT / "index.html").write_text(idx, encoding="utf-8")
print("built")
