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
 * Creates the regex for matching 1-n oxford-comma seperated values.
 *
 * @param {string} keywordMatcher regex as string for the keyword which begins the matching, e.g. "[Ff]igures?".
 * @param {string} valueMatcher regex as string for the values to be matched.
 * @param {string} [flags] which flags to add to the final regex.
 * @returns {RegExp} regex for match 1-n of the values after the keyword.
 */
export function getRefRegex(keywordMatcher, valueMatcher, flags) {
    if (!keywordMatcher || !valueMatcher) {
        throw new Error("Bad parameters!");
    }

    if (flags) {
        return RegExp(`(?<=${keywordMatcher} )(${valueMatcher})((, ${valueMatcher})*(,? (and|or) ${valueMatcher}))?`, flags);
    }
    return RegExp(`(?<=${keywordMatcher} )(${valueMatcher})((, ${valueMatcher})*(,? (and|or) ${valueMatcher}))?`);
}

/**
 * Turns mentions of one or more labels into \ref{}'s accordingly.
 * Note that when mentioning more than 2 labels, usage of the Oxford comma is expected.
 * E.g., "figures a1.png, a2.png, and a3.png".
 *
 * @param {string} match mentions of figures.
 * @param {string} [prefix] the prefix to include in the label reference.
 * @return {string} label references in latex syntax.
 */
export function handleRefMatches(match, prefix) {
    const prefixColon = prefix ? prefix + ":" : "";

    // Handle 1 value and set joinWord
    let joinWord = "";
    if (match.includes(" and ")) {
        joinWord = "and";
    } else if (match.includes(" or ")) {
        joinWord = "or";
    } else {
        return `\\ref{${prefixColon}${match}}`;
    }

    // Handle >2 values
    if (match.includes(",")) {
        return match.split(",").reduce((accumulator, currentValue, currentIndex, array) => {
            if (currentIndex === array.length - 1) {
                const joinWordLess = currentValue.replace(`${joinWord} `, "").trim();
                return accumulator + `${joinWord} \\ref{${prefixColon}${joinWordLess}}`;
            }
            return accumulator + `\\ref{${prefixColon}${currentValue.trim()}}, `;
        }, "");
    }

    // Handle 2 values
    return match.split(` ${joinWord} `).map(figure => `\\ref{${prefixColon}${figure.trim()}}`).join(` ${joinWord} `);
}
