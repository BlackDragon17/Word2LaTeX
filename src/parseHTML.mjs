import clipboard from "clipboardy";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ParseResult from "./ParseResult.mjs";

const sectionNames = ["chapter", "section", "subsection", "subsubsection"];

/**
 * Returns a new string, cleaned of excess whitespaces and newlines.
 *
 * @param {string} val string to clean.
 * @returns {string} new cleaned string.
 */
function cleanString(val) {
    return val.replaceAll("\n", " ")
        .replace(/\s{2,}/g, " ");
}

/**
 * Produces a Latex heading with a label.
 *
 * @param {string} headingType the heading type to use (see {@link sectionNames}).
 * @param {string} heading the heading text.
 * @param {string|null} label the heading label. Only added if not null.
 * @return {string} a heading in Latex syntax with a label.
 */
function getHeadingString(headingType, heading, label) {
    let result = `\\${headingType}{${heading.trim()}}`;
    if (label) {
        result += ` \\label{${label.trim()}}`;
    }
    result += "\n\n";
    return result;
}

/**
 * Iterates over the paragraph elements at the root of the document.
 *
 * @param {NodeList<HTMLParagraphElement>} rootParagraphs list of document root paragraph elements.
 * @returns {string} final latex string.
 */
function parseRootParagraphs(rootParagraphs) {
    let finalLatex = "";

    for (const paragraph of rootParagraphs) {
        finalLatex += parseElementContent(paragraph, true).text;
    }

    finalLatex = finalLatex.replace(/\n\n$/, "");

    return finalLatex;
}

/**
 * Parses the content of an HTMLElement. Root of the recursion tree.
 *
 * @param {HTMLElement} element element to parse.
 * @param {boolean} isRoot whether the current element is a root element.
 * @returns {ParseResult} content of the parsed element.
 */
function parseElementContent(element, isRoot = false) {
    const result = new ParseResult();

    for (let i = 0; i < element.childNodes.length; i++) {
        const resultPart = parseNodeContent(element.childNodes[i]);

        result.text += resultPart.text;
        if (result.fontSize < resultPart.fontSize) {
            result.fontSize = resultPart.fontSize;
        }
    }

    const elementFontSize = +element.style.fontSize?.slice(0, -2);
    if (elementFontSize && elementFontSize > result.fontSize) {
        result.fontSize = elementFontSize;
    }

    if (isRoot) {
        return parseRootParagraph(element, result);
    }
    if (!result.text) {
        return result;
    }

    switch (element.nodeName) {
        case "I":
            result.text = `\\textit{${result.text}}`;
            return result;

        case "B":
            if (result.fontSize < 12) {
                result.text = `\\textbf{${result.text}}`;
            }
            return result;

        default:
            return result;
    }
}

/**
 * Logic for parsing the root paragraph elements.
 *
 * @param {HTMLParagraphElement} element element to parse.
 * @param {ParseResult} result the result object built from the paragraph's child nodes.
 * @returns {ParseResult} the final result.
 */
function parseRootParagraph(element, result) {
    result.text = result.text.trim();

    if (!result.text) {
        return result;
    }

    // Handle headings
    switch (result.fontSize) {
        case 18:
            result.text = getHeadingString(
                "chapter",
                result.text.replace(/^Chapter \d+:? /, ""),
                result.text.match(/(?<=^Chapter )\d+(?=:? \w)/)?.[0]
            );
            return result;
        case 16:
            result.text = getHeadingString(
                "section",
                result.text.replace(/^\d+(\.\d+)* /, ""),
                result.text.match(/^\d+(\.\d+)*(?= \w)/)?.[0]
            );
            return result;
        case 14:
            result.text = getHeadingString(
                "subsection",
                result.text.replace(/^\d+(\.\d+)* /, ""),
                result.text.match(/^\d+(\.\d+)*(?= \w)/)?.[0]
            );
            return result;
        case 12:
            result.text = getHeadingString(
                "subsubsection",
                result.text.replace(/^\d+(\.\d+)* /, ""),
                null
            );
            return result;
    }

    // Handle unsorted lists
    switch (element.className) {
        case "MsoListParagraphCxSpFirst":
            result.text = result.text.replace("·", "");
            result.text = cleanString(result.text);
            result.text = `\\begin{itemize}\n\\item ${result.text}\n`;
            return result;
        case "MsoListParagraphCxSpMiddle":
            result.text = result.text.replace("·", "");
            result.text = cleanString(result.text);
            result.text = `\\item ${result.text}\n`;
            return result;
        case "MsoListParagraphCxSpLast":
            result.text = result.text.replace("·", "");
            result.text = cleanString(result.text);
            result.text = `\\item ${result.text}\n\\end{itemize}\n\n`;
            return result;
    }

    result.text += "\n\n";
    return result;
}

/**
 * Parses the content of a child-node. Leaf of the recursion tree when Node = Text.
 *
 * @param {Node} node node to parse.
 * @returns {ParseResult} content of the parsed node.
 */
function parseNodeContent(node) {
    let result = new ParseResult();

    if (node.nodeType === window.Node.TEXT_NODE) {
        result.text = cleanString(node.data);
        // make en dash into em dash with no spaces
        result.text = result.text.replaceAll(" – ", "\\textemdash{}");
        // make `[xyz]` into `\cite{xyz}`
        result.text = result.text.replaceAll(/\[\w+(-\w+)*(, \w+(-\w+)*)*\]/g, match => `\\cite{${match.slice(1, -1)}}`);
        // make `figure xyz` into `figure \ref{fig:xyz}`
        result.text = result.text.replaceAll(
            /(?<=[Ff]igures? )(\w+(-\w+)*(\.\w+)?)((, (\w+(-\w+)*(\.\w+)?))*(,? (and|or) (\w+(-\w+)*(\.\w+)?)))?/g,
            match => handleFigures(match)
        );
        // make `section xyz` into `section \ref{xyz}`
        result.text = result.text.replaceAll(/(?<=(section|chapter) )\d+(\.\d+)*/g, match => `\\ref{${match}}`);
    } else if (node.nodeType === window.Node.ELEMENT_NODE) {
        result = parseElementContent(node);
    }

    return result;
}

/**
 * Turns mentions of one or more figures into \ref{fig:}'s accordingly.
 * Note that for more than 2 figures, usage of the Oxford comma is expected.
 *
 * @param {string} match mentions of figures.
 * @return {string} mentions of figures with latex syntax.
 */
function handleFigures(match) {
    // handle 1 figure and set joinWord
    let joinWord = "";
    if (match.includes(" and ")) {
        joinWord = "and";
    } else if (match.includes(" or ")) {
        joinWord = "or";
    } else {
        return `\\ref{fig:${match}}`;
    }

    // handle >2 figures
    if (match.includes(",")) {
        return match.split(",").reduce((accumulator, currentValue, currentIndex, array) => {
            if (currentIndex === array.length - 1) {
                const joinLess = currentValue.replace(`${joinWord} `, "").trim();
                return accumulator + `${joinWord} \\ref{fig:${joinLess}}`;
            }
            return accumulator + `\\ref{fig:${currentValue.trim()}}, `;
        }, "");
    }

    // handle 2 figures and catch accidental detection of a sectionName
    const figures = match.split(` ${joinWord} `);
    if (sectionNames.some(name => figures.includes(name))) {
        return `\\ref{fig:${figures[0].trim()}} ${joinWord} ${figures[1].trim()}`
    }
    return figures.map((figure) => `\\ref{fig:${figure.trim()}}`).join(` ${joinWord} `);
}

const filePath = process.argv[2];
if (!filePath) {
    throw new Error("No HTML temp file path given!");
}

const htmlFile = readFileSync(filePath, {encoding: "utf8"});
const {window} = new JSDOM(htmlFile);

const paragraphs = window.document.querySelectorAll("html > body > p");
const latex = parseRootParagraphs(paragraphs);

clipboard.writeSync(latex);
