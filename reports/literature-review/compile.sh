#!/bin/zsh

# Compile LaTeX to PDF and clean metadata files.
# Usage: ./compile.sh

set -e

# Target base name
BASE="literature-review"

echo "=== Running pdflatex (Pass 1) ==="
pdflatex -interaction=nonstopmode "${BASE}.tex"

if [ -f "${BASE}.aux" ]; then
    echo "=== Running bibtex ==="
    bibtex "${BASE}"
fi

echo "=== Running pdflatex (Pass 2) ==="
pdflatex -interaction=nonstopmode "${BASE}.tex"

echo "=== Running pdflatex (Pass 3) ==="
pdflatex -interaction=nonstopmode "${BASE}.tex"

echo "=== Cleaning auxiliary files ==="
EXTS=(aux log out toc lof lot bbl blg pyg nav snm synctex.gz fls fdb_latexmk)
for ext in "${EXTS[@]}"; do
    rm -f "${BASE}.${ext}"
done

echo "=== Compilation Complete. Cleaned metadata. ==="
ls -l "${BASE}.pdf"
