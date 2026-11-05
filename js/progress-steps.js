/**
 * A checklist of steps shown while work runs: each step is waiting,
 * running (with a spinner), done or failed. Knows nothing about cards.
 */
export class ProgressSteps {
  /**
   * Empties the list and shows it.
   *
   * @param {HTMLOListElement | HTMLUListElement} list
   */
  constructor(list) {
    this.list = list;
    list.replaceChildren();
    list.hidden = false;
  }

  /**
   * Adds a waiting step to the end of the list.
   *
   * @param {string} label
   * @returns {Step}
   */
  add(label) {
    const item = Object.assign(document.createElement('li'), { textContent: label });
    this.list.append(item);
    return new Step(item);
  }
}

export class Step {
  /** @param {HTMLLIElement} item */
  constructor(item) {
    this.item = item;
  }

  start() {
    this.#set('running');
  }

  /** @param {string} [label] replaces the step's text, e.g. to add a result */
  done(label) {
    this.#set('done', label);
  }

  /** @param {string} [label] */
  fail(label) {
    this.#set('failed', label);
  }

  /**
   * Runs `work` as this step: shows the spinner, then done or failed.
   *
   * @template T
   * @param {() => Promise<T>} work
   * @returns {Promise<T>}
   */
  async run(work) {
    this.start();
    try {
      const result = await work();
      this.done();
      return result;
    } catch (error) {
      this.fail();
      throw error;
    }
  }

  #set(state, label) {
    this.item.className = state;
    if (label) this.item.textContent = label;
  }
}
