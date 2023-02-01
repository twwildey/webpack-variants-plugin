export function isEmptyObj(obj) {
    for (let key in obj) {
        return false;
    }

    return true;
}

export function mergeObj(dest, src) {
    for (let key in src) {
        dest[key] = src[key];
    }

    return dest;
}

export function sortObj(src) {
    const dest = {};
    const keys = Object.keys(src);

    keys.sort();
    keys.forEach(function(key) {
        dest[key] = src[key];
    });

    return dest;
}

/**
 *  lower and upper are inclusive indicies
 */
export function firstIndexOfPrefix(array, prefix, lower, upper) {
    lower = (lower === undefined) ? 0 : lower;
    upper = (upper === undefined) ? (array.length - 1) : upper;

    const prefixLen = prefix.length;
    let resolved = -1;
    while (lower != upper) {
        const pivot = Math.floor((upper + lower) / 2);
        const value = array[pivot].substring(0, prefixLen);

        if (prefix < value) {
            upper = pivot;
        } else if (prefix > value) {
            lower = pivot + 1;
        } else {
            resolved = upper = pivot;
        }
    }

    const value = array[upper].substring(0, prefixLen);
    return (prefix === value) ? upper : resolved;
}

/**
 *  lower and upper are inclusive indicies
 */
export function lastIndexOfPrefix(array, prefix, lower, upper) {
    lower = (lower === undefined) ? 0 : lower;
    upper = (upper === undefined) ? (array.length - 1) : upper;

    const prefixLen = prefix.length;
    let resolved = -1;
    while (lower != upper) {
        const pivot = Math.floor((upper + lower) / 2);
        const value = array[pivot].substring(0, prefixLen);

        if (prefix < value) {
            upper = pivot;
        } else if (prefix > value) {
            lower = pivot + 1;
        } else {
            resolved = pivot;
            lower = pivot + 1;
        }
    }

    const value = array[upper].substring(0, prefixLen);
    return (prefix === value) ? upper : resolved;
}

export function iterateEntryImports(entryValue, callback) {
    entryValue.import.forEach(callback);
}
