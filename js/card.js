/**
 * The shared shape every parser produces and the Card Kingdom writer consumes.
 *
 * @typedef {'normal' | 'foil' | 'etched'} Finish
 *
 * @typedef {object} Card
 * @property {string} name
 * @property {string} setCode         e.g. "MKC"
 * @property {string} [setName]       ManaBox/Scryfall set name, used only as a fallback
 * @property {string} collectorNumber e.g. "4"
 * @property {Finish} finish
 * @property {number} quantity
 * @property {string} [scryfallId]    identifies the exact printing
 */

/** @type {readonly Finish[]} */
export const FINISHES = Object.freeze(['normal', 'foil', 'etched']);

/**
 * @param {string} value
 * @returns {Finish | undefined}
 */
export function toFinish(value) {
  const finish = value.trim().toLowerCase();
  return FINISHES.includes(finish) ? /** @type {Finish} */ (finish) : undefined;
}
