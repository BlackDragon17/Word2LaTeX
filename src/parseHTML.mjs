import clipboard from "clipboardy";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ParseResult from "./ParseResult.mjs";
import { cleanString, getHeadingString, getRefRegex, handleRefMatches } from "./util.mjs";

/**
 * Iterates over the paragraph elements at the root of the document.
 *
 * @param {NodeList<HTMLParagraphElement>} rootParagraphs list of document root paragraph elements.
 * @returns {string} final latex string.
 */
function parseRootParagraphs(rootParagraphs) {
    let finalLatex = "";

    for (const paragraph of rootParagraphs) {
        finalLatex += parseElement(paragraph, true).text;
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
function parseElement(element, isRoot = false) {
    const result = new ParseResult();

    for (let i = 0; i < element.childNodes.length; i++) {
        const resultPart = parseNode(element.childNodes[i]);

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
        return parseRootElement(element, result);
    }

    if (!result.text || result.text === " ") {
        result.text = "";
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

        case "SPAN":
            if (element.style.fontFamily === "Consolas") {
                result.text = `\\texttt{${result.text}}`;
            }
            return result;

        default:
            return result;
    }
}

/**
 * Parses the content of a child-node. Leaf of the recursion tree when Node = Text.
 *
 * @param {Node} node node to parse.
 * @returns {ParseResult} content of the parsed node.
 */
function parseNode(node) {
    let result = new ParseResult();

    if (node.nodeType === window.Node.TEXT_NODE) {
        result.text = cleanString(node.data);
    } else if (node.nodeType === window.Node.ELEMENT_NODE) {
        result = parseElement(node);
    }

    return result;
}

/**
 * Logic for parsing the root content elements.
 *
 * @param {HTMLElement} element element to parse.
 * @param {ParseResult} result the result object built from the paragraph's child nodes.
 * @returns {ParseResult} the final result.
 */
function parseRootElement(element, result) {
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


    // If not a heading, apply text transformations:

    // Make en dash into em dash with no spaces
    result.text = result.text.replaceAll(" – ", "\\textemdash{}");

    // Make `[xyz]` into `\cite{xyz}`
    result.text = result.text.replaceAll(/\[\w+(-\w+)*(, \w+(-\w+)*)*\]/g, match => `\\cite{${match.slice(1, -1)}}`);

    // Make `figure abc.png` into `figure \ref{fig:abc.png}`
    const figureRegex = getRefRegex("[Ff]igures?", String.raw`\w+(-\w+)*\.\w+`, "g");
    result.text = result.text.replaceAll(figureRegex, match => handleRefMatches(match, "fig"));

    // Make `section 1.2.3` into `section \ref{1.2.3}`
    const sectionRegex = getRefRegex("([Ss]ections?|[Cc]hapters?)", String.raw`\d+(\.\d+)*`, "g");
    result.text = result.text.replaceAll(sectionRegex, match => handleRefMatches(match));

    // Make `listing abc-xyz` into `listing \ref{listing:abc-xyz}`
    const listingRegex = getRefRegex("[Ll]istings?", String.raw`\w+(-\w+)+`, "g");
    result.text = result.text.replaceAll(listingRegex, match => handleRefMatches(match, "listing"));

    // Replace `_` with `\_` (outside of citations and refs) so that Latex doesn't think it's a math formula
    result.text = result.text.replaceAll(/(?<!\\(cite|ref){[\w.,:\- ]+)_/g, "\\_");


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

const filePath = process.argv[2];
if (!filePath) {
    throw new Error("No HTML temp file path given!");
}

const htmlFile = readFileSync(filePath, {encoding: "utf8"});
const {window} = new JSDOM(htmlFile);

const paragraphs = window.document.querySelectorAll("html > body > p, html > body > span");
const latex = parseRootParagraphs(paragraphs);

clipboard.writeSync(latex);
