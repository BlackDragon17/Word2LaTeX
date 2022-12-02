import clipboard from "clipboardy";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

function cleanString(val) {
    return val.replaceAll("\n", " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function parseElementContent(element) {
    const result = {text: "", fontSize: 0};

    for (let i = 0; i < element.childNodes.length; i++) {
        const isLastNode = i === element.childNodes.length - 1;
        const resultPart = parseNodeContent(element.childNodes[i], isLastNode);
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

    if (!result.text) {
        return result;
    }
    switch (element.nodeName) {
        case "I":
            result.text = `\\textit{${result.text}}`;
            break;

        case "B":
            if (result.fontSize < 12) {
                result.text = `\\textbf{${result.text}}`;
            }
            break;

        case "P":
            switch (result.fontSize) {
                case 18:
                    result.text = result.text.replace(/Chapter \d+: /, "\\chapter{");
                    result.text += "}";
                    break;
                case 16:
                    result.text = result.text.replace(/(\d.)+\d /, "\\section{");
                    result.text += "}";
                    break;
                case 14:
                    result.text = result.text.replace(/(\d.)+\d /, "\\subsection{");
                    result.text += "}";
                    break;
                case 12:
                    result.text = `\\subsubsection{${result.text}}`;
                    break;
            }

            result.text += "\n\n";
            break;
    }
    return result;
}

function parseNodeContent(node, isLastNode) {
    let result = {text: "", fontSize: 0};

    if (node.nodeType === window.Node.TEXT_NODE) {
        result.text = cleanString(node.data);
        result.text = result.text.replaceAll(/\[\w+(, \w+)*\]/g, (match) => `\\cite{${match.slice(1, -1)}}`);
        result.text = result.text.replaceAll(" – ", "\\textemdash{}");
    } else if (node.nodeType === window.Node.ELEMENT_NODE) {
        result = parseElementContent(node);
    }

    if (isLastNode || result.text[result.text.length - 1] === "(") {
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

let latex = "";
const paragraphs = window.document.querySelectorAll("html > body > p");
for (const paragraph of paragraphs) {
    latex = latex.concat(parseElementContent(paragraph).text);
}

// console.log("Final latex:");
// console.log(latex);

clipboard.writeSync(latex);
