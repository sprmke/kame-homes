const fs = require('fs');

function nonSymlinkFiles(files) {
  return files.filter((file) => {
    try {
      return !fs.lstatSync(file).isSymbolicLink();
    } catch {
      return false;
    }
  });
}

/** lint-staged splits the command string on whitespace, so paths must be quoted. */
function quote(file) {
  return `"${file}"`;
}

function prettierWrite(files) {
  const filtered = nonSymlinkFiles(files);
  return filtered.length ? [`prettier --write ${filtered.map(quote).join(' ')}`] : [];
}

module.exports = {
  'ui/**/*.{ts,tsx,js,jsx}': (files) => {
    const relativeFiles = files.map((file) => quote(file.replace(/^ui\//, ''))).join(' ');
    return [`cd ui && eslint --fix ${relativeFiles}`];
  },
  'ui/**/*.{json,css,md}': prettierWrite,
  '*.{json,md,mdc}': prettierWrite,
};
