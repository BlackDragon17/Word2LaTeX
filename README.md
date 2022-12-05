# Word2LaTeX

Quick and dirty Word to LaTeX snippet in-clipboard converter. Requires Windows, Powershell 7.2+, and Node 14+.

## Usage

1. Copy a text fragment from a Word document
2. Run `RunMe.ps1` (useful to create a shortcut for quick access)
3. Paste into a LaTeX editor

## Features

- Supports italics, bold, and unordered lists
- Makes paragraphs with font sizes 18, 16, 14, 12 into chapters, sections, subsections, and subsubsections respectively
- Replaces Word dashes with em-dashes, "\[citation\]" with "\cite{citation}", and "figure abc" with "figure \ref{fig:abc}"
