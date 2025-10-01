// server/utils/sorting.js

const compareFolderNumbers = (a, b) => {
    // Ensure inputs are strings to safely call split
    const safeA = a ? a.toString() : '';
    const safeB = b ? b.toString() : '';

    const partsA = safeA.split('.').map(part => parseInt(part, 10));
    const partsB = safeB.split('.').map(part => parseInt(part, 10));

    if (partsA[0] !== partsB[0]) {
        return partsA[0] - partsB[0];
    }

    const subA = partsA.length > 1 ? partsA[1] : 0;
    const subB = partsB.length > 1 ? partsB[1] : 0;
    return subA - subB;
};

module.exports = {
  compareFolderNumbers,
};