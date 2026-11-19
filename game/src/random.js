// Seeded PRNG (mulberry32): one counter drives every draw, so the city,
// traffic and pedestrians are identical on every load for a given seed.
const STEP = 0x6d2b79f5, SCALE = 4294967296;

function scramble(word) {
  const mixed = Math.imul(word ^ (word >>> 15), word | 1);
  return mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61));
}

export const createRandom = (seed) => {
  let counter = seed >>> 0;
  const draw = () => {
    counter = (counter + STEP) >>> 0;
    const word = scramble(counter);
    return ((word ^ (word >>> 14)) >>> 0) / SCALE;
  };
  const between = (low, high) => low + draw() * (high - low);
  const whole = (low, high) => Math.floor(low + draw() * (high - low + 1));
  const oneOf = (list) => list[Math.floor(draw() * list.length)];
  const maybe = (probability) => draw() < probability;
  return { next: draw, range: between, int: whole, pick: oneOf, chance: maybe };
};
