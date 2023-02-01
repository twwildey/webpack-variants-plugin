import path from 'path';
import { mergeObj } from './utils.js';
import {
    VARIANTS_URI_DELIMITER,
    VARIANTS_URI_PART_PREFIX
} from './constants.js';

export class MatchSet {
    constructor(resolvedArray, variantSet, sourceModule) {
        !!resolvedArray && resolvedArray.push(this);

        Object.defineProperty(this, '__variantSet__', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: variantSet
        });

        Object.defineProperty(this, '__variantSetLength__', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: Object.keys(variantSet).length
        });

        Object.defineProperty(this, '__sourceModule__', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: sourceModule
        });
    }
}

export function buildVariantRegexForFilename(filenamePath) {
    const extension = path.extname(filenamePath);
    const fileName = path.basename(filenamePath, extension);
    const fileNameLen = fileName.length;

    const variantRegexStr = "^" + fileName + "(\\.[\\w\\=\\:]+)*" + (extension ? "\\" + extension + "$" : "$");
    const variantRegex = new RegExp(variantRegexStr, 'g');

    return {
        extension: extension,
        fileName: fileName,
        fileNameLen: fileNameLen,
        variantRegex: variantRegex
    };
}

export function buildVariantSet(variantsURI) {
    const variantsArray = variantsURI.split(/\.|\&/);
    const variantSet = {};

    variantsArray[0] && variantsArray.forEach(function(variant) {
        const keyValueArray = variant.split('=');
        const key = keyValueArray[0];
        variantSet[key] = (keyValueArray.length > 1) ? keyValueArray[1] : true;
    });

    return variantSet;
}

export function mergeVariantSet(dest, src) {
    for (let key in src) {
        const destVal = dest[key];
        const srcVal = src[key];
        if (destVal) {
            if (destVal !== srcVal) {
                return false;
            }
        } else {
            dest[key] = srcVal;
        }
    }

    return dest;
}

export function reduceVariantSet(variantSet, reducing) {
    const reduced = mergeObj({}, variantSet);

    for (let key in variantSet) {
        const reducingValue = reducing[key];
        if (reducingValue) {
            if (variantSet[key] !== reducingValue) {
                return false;
            }

            delete reduced[key];
        }
    }

    return reduced;
}

export function variantsPriorityMinIdx(varaintSet, variantsPriority) {
    let minVal = Infinity;
    let minIdx = null;

    for (let key in varaintSet) {
        variantsPriority.forEach(function(variantPriority) {
            if (key.match(variantPriority.variantMatcher)) {
                const { priority } = variantPriority;
                if (priority < minVal) {
                    minVal = priority;
                    minIdx = key;
                }
            }
        });
    }

    return minIdx;
}

export function serializeVariantSetToURI(variantSet, delimiter = '.') {
    return Object.keys(variantSet).map((variantKey) => {
        return variantKey + '=' + variantSet[variantKey];
    }).join(delimiter);
}

export function buildVaraintsPriority(priorityArray) {
    return priorityArray.filter(function(variantMatcher) {
        if (typeof variantMatcher !== 'string') {
            console.error(`Invalid type passed in \`priority\`: ${JSON.stringify(variantMatcher)} - ignoring from \`priority\` array`);
            return false;
        }

        return true;
    }).map(function(variantMatcher, idx) {
        return {
            variantMatcher: new RegExp(`^${variantMatcher}$`),
            priority: idx,
        };
    });
}

export function reduceVariantSetByPriority(variantSet, variantsPriority) {
    const reduced = mergeObj({}, variantSet);

    for (let key in reduced) {
        variantsPriority.forEach(function(variantPriority) {
            if (key.match(variantPriority.variantMatcher)) {
                delete reduced[key];
            }
        });
    }

    return reduced;
}

export function prioritizeVariantSet(first, second, variantsPriority) {
    let firstMinKey = variantsPriorityMinIdx(first, variantsPriority);
    let secondMinKey = variantsPriorityMinIdx(second, variantsPriority);

    if (firstMinKey !== secondMinKey) {
        firstMinKey = (firstMinKey === null) ? '\xFF' : firstMinKey;
        secondMinKey = (secondMinKey === null) ? '\xFF' : secondMinKey;
        return (firstMinKey < secondMinKey) ? true : false;
    }

    if (firstMinKey === null) {
        return (secondMinKey === null) ? true : false;
    } else if (secondMinKey === null) {
        return false;
    }

    first = mergeObj({}, first);
    second = mergeObj({}, second);
    delete first[firstMinKey];
    delete second[secondMinKey];

    return prioritizeVariantSet(first, second, variantsPriority);
}

export function extractQueryFromURI(filenamePath) {
    const requestQueryIdx = filenamePath.lastIndexOf(VARIANTS_URI_DELIMITER);
    if (requestQueryIdx < 0) {
        return undefined
    }

    let uriQuery = filenamePath.substring(requestQueryIdx);
    const requestHashIdx = uriQuery.indexOf('#');
    if (requestHashIdx >= 0) {
        uriQuery = uriQuery.substring(0, requestHashIdx);
    }

    return uriQuery;
}

// Assumes query is prefixed with '?'
export function extractWebpackVariantsFromQuery(query) {
    if ((typeof query !== 'string') || (query.length <= 1)) {
        return undefined;
    }

    const variantSet = buildVariantSet(query.substring(1));
    for (let key in variantSet) {
        if (!key.startsWith(VARIANTS_URI_PART_PREFIX)) {
            delete variantSet[key];
        }
    }

    return variantSet;
}

const VARIANTS_URI_PART_PREFIX_LEN = VARIANTS_URI_PART_PREFIX.length;
export function extractRawVariantsFromWebpackVariants(variantSet) {
    const newVariantSet = {};
    for (let key in variantSet) {
        newVariantSet[key.substring(VARIANTS_URI_PART_PREFIX_LEN)] = variantSet[key];
    }

    return newVariantSet;
}

/**
 *  variantSet should not already be represented in matchSet
 */
export function addVariantSetToMatchSet(matchSet, resolvedArray, variantSet, sourceModule) {
    let current = matchSet;
    let prev = null;
    let lastKey = null;

    for (let key in variantSet) {
        prev = current;
        current = prev[key] = prev[key] || {};
        lastKey = key;

        const value = variantSet[key];
        if (value !== true) {
            prev = current;
            current = prev[value] = prev[value] || {};
            lastKey = value;
        }
    }

    if (!lastKey) {
        return mergeObj(new MatchSet(resolvedArray, variantSet, sourceModule), current);
    }

    prev[lastKey] = mergeObj(new MatchSet(resolvedArray, variantSet, sourceModule), current);
    return matchSet;
}

export function mergeMatchSet(dest, src, resolvedArray) {
    if (!(dest instanceof MatchSet) && (src instanceof MatchSet)) {
        dest = mergeObj(new MatchSet(resolvedArray, src.__variantSet__, src.__sourceModule__), dest);
    }

    for (let key in src) {
        const destVal = dest[key];
        dest[key] = mergeMatchSet(destVal ? destVal : {}, src[key], resolvedArray);
    }

    return dest;
}

export function testMatchSet(matchSet, variantSet) {
    for (let key in variantSet) {
        matchSet = matchSet[key];
        if (!matchSet) {
            return false;
        }

        const value = variantSet[key];
        if (value !== true) {
            matchSet = matchSet[value];
            if (!matchSet) {
                return false;
            }
        }
    }

    return (matchSet instanceof MatchSet);
}
