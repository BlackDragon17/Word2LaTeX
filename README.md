# Word2LaTeX

Quick and dirty Word to LaTeX snippet in-clipboard converter. Requires Windows 10+, Powershell 7.2+, and Node 14+.

## Usage

1. Copy a text fragment from a Word document
2. Run `RunMe.ps1` (useful to create a shortcut for quick access)
3. Paste into a LaTeX editor

## Features

- Supports italics, bold, and unordered lists
- Makes paragraphs with font sizes 18, 16, 14, 12 into chapters, sections, subsections, and subsubsections respectively
    - If a section is numbered (e.g., "_1.1 Introduction_"), the number is set as the section's `\label{}`
- Replaces Word en–dashes with LaTeX em—dashes and `[citation]` with `\cite{citation}`
- Links to figures: "_figure a and b_" becomes `figure \ref{fig:a} and \ref{fig:b}`
- Links to sections: "_section 1.1_" becomes `section \ref{1.1}`
