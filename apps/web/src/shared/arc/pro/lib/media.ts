/**
 * Shared demo media. Files live in `public/media/`, credits in `public/media/CREDITS.md`.
 * People are seeded gradient avatars from `npm run avatars` (400 px squares);
 * photos are 1600 px on the long side.
 */

export interface MediaPerson {
  id: string;
  name: string;
  role?: string;
  src: string;
}

export interface MediaPhoto {
  id: string;
  alt: string;
  src: string;
  width: number;
  height: number;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

export function mediaUrl(path: `/media/${string}`) {
  return basePath + path;
}

export const people = [
  { id: "emma-collins", name: "Emma Collins", role: "Product designer", src: mediaUrl("/media/people/emma-collins.svg") },
  { id: "marcus-johnson", name: "Marcus Johnson", role: "Frontend engineer", src: mediaUrl("/media/people/marcus-johnson.svg") },
  { id: "jasmine-brooks", name: "Jasmine Brooks", role: "Design lead", src: mediaUrl("/media/people/jasmine-brooks.svg") },
  { id: "olivia-bennett", name: "Olivia Bennett", role: "Platform engineer", src: mediaUrl("/media/people/olivia-bennett.svg") },
  { id: "sofia-ramirez", name: "Sofia Ramirez", role: "Operations lead", src: mediaUrl("/media/people/sofia-ramirez.svg") },
  { id: "ryan-sullivan", name: "Ryan Sullivan", role: "Account executive", src: mediaUrl("/media/people/ryan-sullivan.svg") },
  { id: "hannah-walsh", name: "Hannah Walsh", role: "Customer success", src: mediaUrl("/media/people/hannah-walsh.svg") },
  { id: "chloe-nguyen", name: "Chloe Nguyen", role: "Data analyst", src: mediaUrl("/media/people/chloe-nguyen.svg") },
  { id: "ava-mitchell", name: "Ava Mitchell", role: "Marketing manager", src: mediaUrl("/media/people/ava-mitchell.svg") },
  { id: "daniel-kim", name: "Daniel Kim", role: "Backend engineer", src: mediaUrl("/media/people/daniel-kim.svg") },
  { id: "jordan-reyes", name: "Jordan Reyes", role: "Support specialist", src: mediaUrl("/media/people/jordan-reyes.svg") },
  { id: "mateo-alvarez", name: "Mateo Alvarez", role: "Mobile engineer", src: mediaUrl("/media/people/mateo-alvarez.svg") },
  { id: "tyler-hayes", name: "Tyler Hayes", role: "Sales lead", src: mediaUrl("/media/people/tyler-hayes.svg") },
  { id: "andre-williams", name: "Andre Williams", role: "Finance partner", src: mediaUrl("/media/people/andre-williams.svg") },
  { id: "nathan-cole", name: "Nathan Cole", role: "Engineering manager", src: mediaUrl("/media/people/nathan-cole.svg") },
  { id: "diane-foster", name: "Diane Foster", role: "Chief operating officer", src: mediaUrl("/media/people/diane-foster.svg") },
] as const satisfies readonly MediaPerson[];

export const photos = [
  { id: "lounge-chair", alt: "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor", src: mediaUrl("/media/photos/lounge-chair.jpg"), width: 1280, height: 1600 },
  { id: "table-lamp", alt: "A white mushroom table lamp glowing beside books and a small vase", src: mediaUrl("/media/photos/table-lamp.jpg"), width: 1600, height: 900 },
  { id: "linen-throw", alt: "Folded natural linen throws with fringed edges in soft window light", src: mediaUrl("/media/photos/linen-throw.jpg"), width: 1067, height: 1600 },
  { id: "glass-carafe", alt: "A hand pouring water from a ribbed glass carafe into tumblers", src: mediaUrl("/media/photos/glass-carafe.jpg"), width: 1280, height: 1600 },
  { id: "stoneware-cups", alt: "Two speckled stoneware cups with a lid on a pale table", src: mediaUrl("/media/photos/stoneware-cups.jpg"), width: 1067, height: 1600 },
  { id: "stacked-bowls", alt: "Two stacked speckled ceramic bowls against a dark wall", src: mediaUrl("/media/photos/stacked-bowls.jpg"), width: 1600, height: 1067 },
  { id: "ceramic-lamp", alt: "A sculptural ceramic lamp with a linen shade on a walnut sideboard", src: mediaUrl("/media/photos/ceramic-lamp.jpg"), width: 1067, height: 1600 },
  { id: "living-room", alt: "A bright living room with timber beams, arched windows, and cream sofas", src: mediaUrl("/media/photos/living-room.jpg"), width: 1200, height: 1600 },
  { id: "sunroom", alt: "A sunroom with a round dining table, plants, and windows on three sides", src: mediaUrl("/media/photos/sunroom.jpg"), width: 1600, height: 1067 },
  { id: "home-office", alt: "A home office with a wooden desk and deep green walls", src: mediaUrl("/media/photos/home-office.jpg"), width: 1600, height: 1200 },
  { id: "reading-chair", alt: "A grey armchair and ottoman with a knit throw in a dark green room", src: mediaUrl("/media/photos/reading-chair.jpg"), width: 1600, height: 900 },
  { id: "bedroom", alt: "A made bed with striped linen pillows against an oak headboard", src: mediaUrl("/media/photos/bedroom.jpg"), width: 1067, height: 1600 },
  { id: "restaurant", alt: "A warm restaurant dining room with woven pendant lights and a tree", src: mediaUrl("/media/photos/restaurant.jpg"), width: 1067, height: 1600 },
  { id: "wine-bar", alt: "A glass carafe of red wine on a bar table in low evening light", src: mediaUrl("/media/photos/wine-bar.jpg"), width: 1600, height: 1067 },
  { id: "concert-hall", alt: "Curved stainless steel panels of the Walt Disney Concert Hall against a blue sky", src: mediaUrl("/media/photos/concert-hall.jpg"), width: 1600, height: 1143 },
  { id: "curved-facade", alt: "A white tiled building facade with curved balconies", src: mediaUrl("/media/photos/curved-facade.jpg"), width: 1600, height: 1067 },
  { id: "pool-house", alt: "A modern glass house beside a long pool under a clear sky", src: mediaUrl("/media/photos/pool-house.jpg"), width: 1600, height: 900 },
  { id: "terracotta-waves", alt: "Wavy terracotta walls rising toward a blue sky", src: mediaUrl("/media/photos/terracotta-waves.jpg"), width: 1067, height: 1600 },
  { id: "mountain-ridges", alt: "Layered mountain ridges under a warm evening sky", src: mediaUrl("/media/photos/mountain-ridges.jpg"), width: 1600, height: 1068 },
  { id: "alpine-lake", alt: "A calm alpine lake reflecting a rocky peak at golden hour", src: mediaUrl("/media/photos/alpine-lake.jpg"), width: 1067, height: 1600 },
  { id: "coastline", alt: "A long coastline with waves rolling onto a beach below green cliffs", src: mediaUrl("/media/photos/coastline.jpg"), width: 1200, height: 1600 },
  { id: "sea-at-dusk", alt: "A calm sea at dusk with a low island on the horizon", src: mediaUrl("/media/photos/sea-at-dusk.jpg"), width: 1067, height: 1600 },
  { id: "lisbon-tram", alt: "A yellow tram on a street lined with historic buildings in Lisbon", src: mediaUrl("/media/photos/lisbon-tram.jpg"), width: 1600, height: 1064 },
  { id: "lisbon-bridge", alt: "The 25 de Abril Bridge crossing the Tagus in Lisbon", src: mediaUrl("/media/photos/lisbon-bridge.jpg"), width: 1600, height: 1166 },
  { id: "lisbon-rooftops", alt: "Terracotta rooftops of Lisbon running down to the river", src: mediaUrl("/media/photos/lisbon-rooftops.jpg"), width: 1280, height: 1600 },
  { id: "salmon-dinner", alt: "Seared salmon with a bright herb salsa and a glass of red wine", src: mediaUrl("/media/photos/salmon-dinner.jpg"), width: 1067, height: 1600 },
  { id: "chef-plating", alt: "A chef spooning sauce onto a plated dish in a dark kitchen", src: mediaUrl("/media/photos/chef-plating.jpg"), width: 1600, height: 1600 },
] as const satisfies readonly MediaPhoto[];

export type PersonId = (typeof people)[number]["id"];
export type PhotoId = (typeof photos)[number]["id"];

/** Looks up a person by id. */
export function person(id: PersonId): MediaPerson {
  return people.find(entry => entry.id === id)!;
}

/** Looks up a photo by id. */
export function photo(id: PhotoId): MediaPhoto {
  return photos.find(entry => entry.id === id)!;
}

/** Square 400 px avatar path for a person id, for `src` props. */
export const avatar = (id: PersonId) => person(id).src;

/** 800 × 1000 portrait of the same avatar, for image-led layouts. */
export const portrait = (id: PersonId) => mediaUrl(`/media/people/portrait/${id}.svg`);

/** The first `count` people, for avatar stacks and lists. */
export const peopleSample = (count: number) => people.slice(0, count);
