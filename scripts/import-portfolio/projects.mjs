/**
 * The first four projects, gathered from francisdes.com (Sanjo, Teeta and
 * the Crums website) and eldhosekuriyan.com (Crums branding and Izanagi).
 * Everything here can be edited in Studio › Portfolio after the import.
 *
 * `cover` opens the case study; `thumbnail`, when set, is shown on the
 * project's tile instead of it. Blocks: { label, text } is a text block
 * (Markdown) under a section label; { media } is one to three
 * files side by side, with an optional caption. A file is a URL, or
 * { url, alt } when it has alt text.
 */

const FRANCIS = "https://francisdes.com/images/uploads/";
const ELDHO = "https://framerusercontent.com/";

const f = (name, alt) => ({ url: FRANCIS + name, alt });
const e = (path, alt) => ({ url: ELDHO + path, alt });
/** A text block: its section label (shown as "01 / The challenge"), a heading and the body. */
const text = (label, heading, body) => ({ label, text: `## ${heading}\n\n${body}` });
/** A text block without a heading, under a label. */
const note = (label, body) => ({ label, text: body });

export const PROJECTS = [
  {
    slug: "sanjo-construction",
    title: "Sanjo Construction",
    client: "Sanjo Construction Inc.",
    year: 2025,
    services: ["Branding", "Art Direction", "Motion Graphics"],
    summary: "A modular identity for a GTA home renovation company with 19+ years of word-of-mouth reputation.",
    cover: f("sanjo-logo.webm"),
    blocks: [
      text("The challenge",
        "A strong reputation, a dated brand",
        "Sanjo has spent 19+ years renovating homes across the GTA, from kitchens and basements to decks and full remodels. Their reputation was built on word of mouth, but their brand hadn’t kept up: a dated logo and nothing that told homeowners why Sanjo over anyone else.",
      ),
      {
        media: [
          f("sanjo-logo-before.png", "Sanjo's previous logo: red and black traditional lettering"),
          f("sanjo-logo-after.png", "New SANJO wordmark built from square modules"),
        ],
        caption: "Before and after",
      },
      text("The idea",
        "Every renovation starts with a floor plan",
        "The SANJO wordmark is built the same way: each letter sits in its own square, like rooms or structural modules laid out on a blueprint.",
      ),
      { media: [f("grid.webp", "SANJO wordmark built on a modular square grid")] },
      text("One system",
        "Modules that rearrange to fit",
        "Because the six modules (five letters plus “CONSTRUCTION”) are the same size, the wordmark rearranges to fit the space without being redrawn.",
      ),
      {
        media: [f("sanjo-lockups.png", "Three SANJO lockups on a square grid: horizontal, vertical and stacked")],
        caption:
          "Horizontal (6 × 1) for cards and signage · Vertical (2 × 3) for van doors and banners · Stacked (3 × 2) for caps and social",
      },
      { media: [f("grid-animation.webm")] },
      text("Typography",
        "Built from the same material",
        "The wordmark is paired with Jagerlay, whose wide, heavy capitals carry the same block-like weight, so the type and the logo feel built from the same material.",
      ),
      { media: [f("type-motion.webm")] },
      text("Colour",
        "Sanjo’s purple, made into a system",
        "Purple was Sanjo’s own choice, built into a four-colour palette that works across print, motion and signage, and sets Sanjo apart from the orange and navy common in renovation branding.",
      ),
      { media: [f("colour-palette.webm")] },
      text("Motion",
        "A name that builds itself",
        "The letters move like modules being placed on a plan, scattering and snapping back into their squares. The sequence was storyboarded and its timing tested frame by frame in Procreate before it went to the animator.",
      ),
      {
        media: [f("sanjo-storyboard.png", "Hand-drawn storyboard frames for the SANJO letter animation")],
        caption: "Storyboard for the letter animation, drawn frame by frame",
      },
      { media: [f("sanjo-animatic.webm"), f("sanjo_letters.webm")], caption: "Procreate animatic (left) · Final animation (right)" },
      text("In use",
        "From the business card to the billboard",
        "The system carries from stationery and merchandise to bold, type-led posters built on Sanjo’s own promises.",
      ),
      {
        media: [
          f("sanjo-business-card.webp", "Deep purple business cards with the SANJO CONSTRUCTION wordmark"),
          f("cap.webp", "Purple cap with the stacked SANJO logo"),
        ],
      },
      { media: [f("3-frames.webm")] },
      { media: [f("tiles.webm")] },
      note("Status", "Proposed identity, 2025. Not yet rolled out. Letter animation by a freelance animator."),
    ],
  },

  {
    slug: "crums",
    title: "Crums",
    client: "Crums",
    year: 2025,
    services: ["Naming", "Branding", "Packaging", "Art Direction", "Motion Graphics", "Photography", "Web Design"],
    summary:
      "Name, identity and packaging for a startup bringing South Indian snacks to a new generation, and the online shop that sells all 14 flavours.",
    cover: e("images/giYyQWLiaZXWah2ssyNEE45Ke0.png"),
    // Only on the tile; the case study still opens with the cover.
    thumbnail: e("assets/nhRkMlKfWTPXpLDfYC3zX5MMao.mp4"),
    blocks: [
      text("The brand",
        "Fourteen flavours, one pouch",
        "Crums is a startup bringing the flavours of South Indian snacks to a new generation. But with 14 snack variations, traditional packaging was too costly. The challenge? Cut costs without sacrificing a fresh, exciting brand presence.",
      ),
      { media: [e("assets/0RPL0Snc5brx6YYlg1s6uHW2eyo.mp4")] },
      { media: [e("images/PIq0J5VYasQX2E4blJisRgmV84.png")] },
      { media: [e("assets/9D81wD6wZ8ArAowj5uzGx3Y6c.mp4")] },
      { media: [e("images/OYTbPAisyVovinqCmN5LrCKxeMg.png")] },
      { media: [e("assets/WddZbsJ9yGCyC5f6eKU9f8uTpg.mp4")] },
      { media: [e("images/Vj9jRSLHG7QwcC4Vp3Cv7GCCTUs.png")] },
      { media: [e("images/7ZJr9AVf7Fw1Lm1Dl4vdNmGZBM.png")] },
      { media: [e("images/sYO1sYIyQYNGgaN3tTLA0rbuWc.png")] },
      { media: [e("assets/EPsGoSEmUsMy5VdM0pCe9CkbnGM.mp4")] },
      text("The website",
        "The website: one brand, fourteen flavours",
        "The pouch and its colour-coded flavour stickers solved the range on the shelf. The website needed to do the same online: show the whole range clearly, keep each flavour distinct, and make ordering quick.",
      ),
      text("The homepage",
        "Built around the best-sellers",
        "The homepage leads with a hero product and goes straight into best-sellers, then a flavour slider, shop-by-category, Kerala specials, the brand story and best picks, so first-time visitors see what to buy within the first scroll.",
      ),
      { media: [f("website-scroll_mokup.webm")] },
      {
        media: [
          f(
            "crums-homepage-full.jpg",
            "Full Crums homepage design: hero, best-sellers, flavour slider, categories, Kerala specials, brand story, best picks and footer",
          ),
        ],
        caption: "The full homepage design",
      },
      text("Every flavour",
        "Stickers, on screen",
        "Each flavour has its own hero slide, carrying the pack’s sticker labels (100% natural, vegan, sweet, salt, spice) onto the screen, so the site feels like the packaging.",
      ),
      { media: [f("slides-varients.webm")] },
      { media: [f("product-names.webm")] },
      text("Search",
        "Search that works like a shop counter",
        "With so many flavours, search sits at the top of every page, live and quick, with the cart count always in view.",
      ),
      { media: [f("search.webm")] },
      text("Details",
        "Small pieces of the same system",
        "Rounded green-and-yellow controls for search, cart and navigation echo the pack’s sticker shapes, alongside a favicon built from the wordmark’s C.",
      ),
      {
        media: [
          f("favicon01.jpg", "Browser tab showing the Crums favicon"),
          f("elements.jpg", "Crums search bar, cart icon and yellow arrow buttons on green"),
        ],
        caption: "Favicon (left) · UI elements (right)",
      },
      note("Credits", "Brand identity and packaging by Eldhose Kuriyan. Website design by Francis Xavier, built by the client’s team. Designed in 2025; the site is no longer live."),
    ],
  },

  {
    slug: "izanagi",
    title: "Izanagi Events",
    client: "Izanagi Events",
    year: 2024,
    services: ["Branding", "Publicity Design", "Print & Digital", "Motion Graphics", "Photography"],
    summary:
      "A bold identity for an events company bringing top Indian artists to Canada, built to stand out beside every artist it works with.",
    cover: e("assets/s7UQMKGd0b9qmY7yHRqt36ssB2I.mp4"),
    blocks: [
      text("The challenge",
        "Lost in the spotlight",
        "Izanagi Events was making noise in the entertainment industry, bringing top Indian artists to Canada for concerts and music festivals. But there was one problem—their brand was getting lost in the spotlight. Each artist had their own personal branding, making it tough for Izanagi to stand out. They needed an identity that would stay bold and recognizable, no matter who they collaborated with.",
      ),
      { media: [e("assets/M80Z0IU77nEUasfHXGum2yuws.mp4")] },
      { media: [e("images/gRYN6CitYcj9vDAEqqUg9suoKI.png")] },
      { media: [e("assets/yxHXKC0s8fdlSti7cDXUaI8edE.mp4")] },
      { media: [e("images/1RYnumzQs0ewRZQ88dBBxJPCQ0.png")] },
      { media: [e("assets/RviWTt3a0HMYPxS1iI79vDo15k.mp4")] },
      { media: [e("images/klLGLgYdQvuKQB4Gq1ObJgYDth4.webp")] },
      { media: [e("assets/pCyQr6yFPtZwnJftesyQ0sWtcU.mp4")] },
      { media: [e("images/wek6uReJJY5eCSMRuHJcJwPKRs.webp")] },
      { media: [e("images/zmGIXY7G6G9d0ws5CakPtbZ8.png")] },
      { media: [e("assets/8o87jvLElFOwkFISsSp5YpbtdXw.mp4")] },
    ],
  },

  {
    slug: "teeta",
    title: "Teeta",
    client: "Teeta",
    year: 2024,
    services: ["Naming", "Branding", "Art Direction", "Motion Graphics"],
    summary: "Naming and identity for a café in Kochi, built around one idea: food is the common factor.",
    cover: f("teeta-logo-portrait.webm"),
    blocks: [
      text("The name",
        "A common factor, and something to eat",
        "Teeta was named together with the client. In maths, theta (θ) is a common factor, the thing that connects everything else. In Malayalam, തീറ്റ (theeta) is an informal word for eating. Together they make a name that’s playful, local and easy to remember.",
      ),
      { media: [f("teeta-naming.png", "The Greek letter theta plus the Malayalam word theeta equals the Teeta wordmark")] },
      text("The wordmark",
        "Both halves of the name, in the logo",
        "The first “e” is drawn like θ, a loop for the common factor. The second is a smiling face, the look of someone enjoying a good meal. The wordmark works as a single line or a stacked block, with a round seal for smaller spaces. Alongside it sits a set of hand-drawn food icons, drawn in Procreate and mixed into patterns or paired with the logo.",
      ),
      {
        media: [
          f("teeta-logo-sheet.jpg", "Teeta wordmark in horizontal and stacked layouts, with a round seal reading “cos teeta is a common factor”"),
        ],
      },
      { media: [f("teeta-icons.png", "Five hand-drawn food icons in red: a drink, a crab, fries, a sandwich and a fried egg")] },
      {
        media: [f("cover.jpg", "Teeta wordmark surrounded by a pattern of food icons on red")],
        caption: "Pattern includes some food icons sourced from Pinterest",
      },
      text("Where it started",
        "From the café’s sign to a refined wordmark",
        "Teeta opened with the original logo, which already had θ, here as the “a”, and the looped “e”. The wordmark was later refined: θ moved into the first “e”, the second “e” gained a smile, and the letterforms became softer and friendlier.",
      ),
      {
        media: [
          f("teeta-logo-original.png", "Original Teeta logo with theta as the final letter"),
          f("teeta-logo-refined.png", "Refined Teeta wordmark with a theta-shaped e, a smiling e and a red full stop"),
        ],
        caption: "Original logo, used in Kochi (left) · Refined wordmark (right)",
      },
      text("The line",
        "“Cos Teeta is a common factor”",
        "The naming idea became the café’s voice. Wrapped around a soft, round seal, the line appeared on the shop sign and carries onto coasters, cups and the back of the staff tees.",
      ),
      { media: [f("coz-teeta_long.webm")] },
      {
        media: [
          f("coaster-mockup.jpg", "Coaster with the round Teeta seal under a glass"),
          f("t-shirt-03.png", "Chef’s t-shirt with “Cos teeta is a common factor” printed on the back"),
        ],
      },
      text("Colour",
        "Chilli, charcoal and cream",
        "A warm chilli red (`#E94A38`), a charcoal (`#2C2926`) and a soft cream (`#FFF8F3`). Bold enough for signage, warm enough for food.",
      ),
      { media: [f("teeta-colour-palette.webm"), f("tote-bag.jpg", "Cream tote bag printed with the Teeta wordmark in red")] },
      text("Food and posters",
        "The menu as posters",
        "The copy is as playful as the name. Lines like “Eat eat and eat” and “Chicken grilled with hummus” turn the menu into posters, built on Teeta’s own food photography.",
      ),
      {
        media: [
          f("teeta-poster-banana.jpg", "Poster of banana pancakes over a repeated Teeta wordmark on red"),
          f("teeta-food-mango-shake.jpg", "Mango shake in a tall glass with a paper straw"),
        ],
      },
      {
        media: [
          f("teeta-food-sandwich.jpg", "Toasted meat sandwich with fries and a dip"),
          f("teeta-food-wrap.jpg", "Chicken wraps with a yoghurt dip on a red plate"),
        ],
        caption: "Food photography courtesy of Teeta",
      },
      text("In use",
        "From the counter to the street",
        "The identity carries across packaging and merchandise, from takeaway cups to staff tees and caps.",
      ),
      { media: [f("free-coffee-cups-mockup.jpg", "Takeaway coffee cups with the Teeta seal and wordmark")] },
      {
        media: [
          f("t-shirt02.jpg", "Staff member wearing a white tee with the round Teeta seal on the back"),
          f("teeta-cap.jpg", "Red cap with the Teeta wordmark"),
        ],
      },
      text("Social", "Type-led, food-first", "Bold type posters and photo tiles for Instagram, built from the same wordmark, seal and colours."),
      { media: [f("posters01.webm")] },
      { media: [f("social-media-tiles.webm")], caption: "Social media concepts. Photography is AI-generated for illustration." },
      note("Status", "Teeta opened in Kochi in 2024 with the original logo and the “cos teeta is…” line, and has since closed. The wordmark shown here is a later refinement; the logo animation was produced with AI tools."),
    ],
  },
];
