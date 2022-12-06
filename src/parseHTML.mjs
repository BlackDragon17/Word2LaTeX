import clipboard from "clipboardy";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ParseResult from "./ParseResult.mjs";

const openingChars = ["(", "“"];
const closingChars = [")", ",", ".", ";", "”"];

/**
 * Returns a new string, cleaned of excess whitespaces and newlines.
 *
 * @param {string} val string to clean.
 * @returns {string} new cleaned string.
 */
function cleanString(val) {
    return val.replaceAll("\n", " ")
        .replace(/\s{2,}/g, " ")
        .trim();
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
        const isLastNode = i === element.childNodes.length - 1;
        const resultPart = parseNodeContent(element.childNodes[i], isLastNode);

        if (result.text && resultPart.text && closingChars.some(char => char === resultPart.text[0])) {
            result.text = result.text.trimEnd();
        }
        result.text += resultPart.text;

        if (result.fontSize < resultPart.fontSize) {
            result.fontSize = resultPart.fontSize;
        }
    }

    result.text = cleanString(result.text);
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
    if (!result.text) {
        return result;
    }

    // Handle headings
    switch (result.fontSize) {
        case 18:
            result.text = result.text.replace(/Chapter \d+: /, "\\chapter{");
            result.text += "}\n\n";
            return result;
        case 16:
            result.text = result.text.replace(/(\d.)+\d /, "\\section{");
            result.text += "}\n\n";
            return result;
        case 14:
            result.text = result.text.replace(/(\d.)+\d /, "\\subsection{");
            result.text += "}\n\n";
            return result;
        case 12:
            result.text = `\\subsubsection{${result.text}}\n\n`;
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
 * @param {boolean} isLastNode whether this is the last child-node of the parent element.
 * @returns {ParseResult} content of the parsed node.
 */
function parseNodeContent(node, isLastNode) {
    let result = new ParseResult();

    if (node.nodeType === window.Node.TEXT_NODE) {
        result.text = cleanString(node.data);
        result.text = result.text.replaceAll(/\[\w+(, \w+)*\]/g, match => `\\cite{${match.slice(1, -1)}}`);
        result.text = result.text.replaceAll(" – ", "\\textemdash{}");
        result.text = result.text.replaceAll(/(?<=[Ff]igure )\w[\w-.]+/g, match => `\\ref{fig:${match}}`);
    } else if (node.nodeType === window.Node.ELEMENT_NODE) {
        result = parseElementContent(node);
    }

    if (isLastNode || openingChars.some(char => char === result.text[result.text.length - 1])) {
        return result;
    }

    result.text += " ";
    return result;
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
