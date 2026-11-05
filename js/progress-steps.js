/**
 * A checklist of steps shown while work runs: each step is waiting,
 * running (with a spinner), done or failed. Knows nothing about cards.
 */
export class ProgressSteps {
  /**
   * Replaces the list's contents with the given steps, all waiting.
   *
   * @param {HTMLOListElement | HTMLUListElement} list
   * @param {string[]} labels
   */
  constructor(list, labels) {
    this.items = labels.map((label) => Object.assign(document.createElement('li'), { textContent: label }));
    list.replaceChildren(...this.items);
    list.hidden = false;
  }

  /** @param {number} index */
  start(index) {
    this.#set(index, 'running');
  }

  /**
   * @param {number} index
   * @param {string} [label] replaces the step's text, e.g. to add a result
   */
  done(index, label) {
    this.#set(index, 'done', label);
  }

  /**
   * @param {number} index
   * @param {string} [label]
   */
  fail(index, label) {
    this.#set(index, 'failed', label);
  }

  /**
   * Runs `work` as step `index`: shows the spinner, then done or failed.
   *
   * @template T
   * @param {number} index
   * @param {() => Promise<T>} work
   * @returns {Promise<T>}
   */
  async run(index, work) {
    this.start(index);
    try {
      const result = await work();
      this.done(index);
      return result;
    } catch (error) {
      this.fail(index);
      throw error;
    }
  }

  #set(index, state, label) {
    const item = this.items[index];
    item.className = state;
    if (label) item.textContent = label;
  }
}
