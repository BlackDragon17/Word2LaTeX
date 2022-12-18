/**
 * DTO for results of parsing HTML elements.
 */
export default class ParseResult {
    /**
     * Creates a new {@link ParseResult}.
     *
     * @param {string} [text]
     * @param  {number} [fontSize]
     */
    constructor(text = "", fontSize = 0) {
        this.text = text;
        this.fontSize = fontSize;
        this.trimNext = false;
    }
}
