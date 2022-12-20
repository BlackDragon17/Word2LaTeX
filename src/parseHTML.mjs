import clipboard from "clipboardy";
import { readFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import { execa } from "execa";
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

    const childResults = [];
    for (let i = 0; i < element.childNodes.length; i++) {
        childResults[i] = parseNode(element.childNodes[i]);

        if (childResults[i - 1]?.trimNext) {
            childResults[i].text = childResults[i].text.trimStart();
        }
        result.text += childResults[i].text;

        if (result.fontSize < childResults[i].fontSize) {
            result.fontSize = childResults[i].fontSize;
        }

        result.parsedInnerFootnoteRef = childResults[i].parsedInnerFootnoteRef || result.parsedInnerFootnoteRef;
    }

    const elementFontSize = +element.style.fontSize?.slice(0, -2);
    if (elementFontSize && elementFontSize > result.fontSize) {
        result.fontSize = elementFontSize;
    }

    if (isRoot) {
        return parseRootElement(element, result);
    }

    if (element.nodeName === "BR") {
        result.text = "\\\\\n";
        result.trimNext = true;
        return result;
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
            if (element.className === "MsoFootnoteReference") {
                if (!result.parsedInnerFootnoteRef) {
                    result.parsedInnerFootnoteRef = true;
                    return result;
                }
                result.text = globalThis.footnotes[result.text.trim()] || "";
                result.parsedInnerFootnoteRef = false;
                return result;
            }

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
        result.text = result.text.replaceAll("#", "\\#");
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

/**
 * Extracts the index number and content of a footnote element and saves it to `globalThis.footnotes`.
 *
 * @param {HTMLParagraphElement} element a footnote element as found in the list at the bottom of a Word HTML file.
 */
function parseFootnoteElement(element) {
    let index = "";
    let content = "";
    for (const childEl of element.children) {
        const indexEl = childEl.querySelector("span[class='MsoFootnoteReference']");
        if (indexEl) {
            // Since innerText is not implemented in JSDOM 20.0, we use textContent instead
            index = indexEl.textContent.trim();
            continue;
        } else if (!index) {
            continue;
        }

        content += parseFootnoteContent(childEl);
    }

    if (!index || !content) {
        return;
    }
    content = `\\footnote{${content}}`;

    globalThis.footnotes[index] = content;
}

/**
 * Parses the content of the footnote, which may consist of nested elements.
 *
 * @param {HTMLElement} element a content element inside the footnote paragraph.
 * @returns {string} the string content of the element in LaTeX markup.
 */
function parseFootnoteContent(element) {
    let content = "";

    for (const childEl of element.children) {
        content += parseFootnoteContent(childEl);
    }

    if (element.children.length <= 0) {
        switch (element.nodeName) {
            case "SPAN":
                content += element.textContent;
                break;
            case "A":
                content += `\\url{${element.textContent}}`;
                break;
        }
    }

    return content;
}


const tempFilePath = "./tempHtmlFile.html";

await execa("pwsh", ["-NoLogo", "-File", "./GetClipboard.ps1", "-TempFilePath", tempFilePath]);

const htmlFile = readFileSync(tempFilePath, {encoding: "utf8"});
if (!htmlFile) {
    throw new Error("No Word-HTML file generated!");
}
rmSync(tempFilePath);

const {window} = new JSDOM(htmlFile);

globalThis.footnotes = {};
const footnoteElements = window.document.querySelectorAll("html > body div[style='mso-element:footnote'] > p[class='MsoFootnoteText']");
if (footnoteElements.length > 0) {
    for (const footnoteEl of footnoteElements) {
        parseFootnoteElement(footnoteEl);
    }
}

const paragraphs = window.document.querySelectorAll("html > body > p, html > body > span");
const latex = parseRootParagraphs(paragraphs);

clipboard.writeSync(latex);
