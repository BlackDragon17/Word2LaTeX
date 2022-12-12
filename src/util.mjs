/**
 * Returns a new string, cleaned of excess whitespaces and newlines.
 *
 * @param {string} val string to clean.
 * @returns {string} new cleaned string.
 */
export function cleanString(val) {
    return val.replaceAll("\n", " ")
        .replace(/\s{2,}/g, " ");
}

/**
 * Produces a Latex heading with a label.
 *
 * @param {string} headingType the heading type to use.
 * @param {string} heading the heading text.
 * @param {string|null} label the heading label. Only added if not null.
 * @return {string} a heading in Latex syntax with a label.
 */
export function getHeadingString(headingType, heading, label) {
    let result = `\\${headingType}{${heading.trim()}}`;
    if (label) {
        result += ` \\label{${label.trim()}}`;
    }
    result += "\n\n";
    return result;
}

/**
 * Turns mentions of one or more figures into \ref{fig:}'s accordingly.
 * Note that for more than 2 figures, usage of the Oxford comma is expected.
 *
 * @param {string} match mentions of figures.
 * @return {string} mentions of figures with latex syntax.
 */
export function handleFigures(match) {
    // Handle 1 figure and set joinWord
    let joinWord = "";
    if (match.includes(" and ")) {
        joinWord = "and";
    } else if (match.includes(" or ")) {
        joinWord = "or";
    } else {
        return `\\ref{fig:${match}}`;
    }

    // Handle >2 figures
    if (match.includes(",")) {
        return match.split(",").reduce((accumulator, currentValue, currentIndex, array) => {
            if (currentIndex === array.length - 1) {
                const joinLess = currentValue.replace(`${joinWord} `, "").trim();
                return accumulator + `${joinWord} \\ref{fig:${joinLess}}`;
            }
            return accumulator + `\\ref{fig:${currentValue.trim()}}, `;
        }, "");
    }

    // Handle 2 figures
    return match.split(` ${joinWord} `).map(figure => `\\ref{fig:${figure.trim()}}`).join(` ${joinWord} `);
}
