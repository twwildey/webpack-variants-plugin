import { mergeObj } from './utils.js';

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

export function hasVariantsInURI(variantsURI) {
    return (!!variantsURI && variantsURI.indexOf('=') >= 0);
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

export function objMin(obj, variantsPriority) {
    let minVal = Infinity;
    let minIdx = null;

    for (let key in obj) {
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

export function buildVaraintsPriority(priorityArray) {
    return priorityArray.map(function(variantMatcher, idx) {
        return {
            variantMatcher: (variantMatcher instanceof RegExp) ? variantMatcher : new RegExp(`^${variantMatcher}$`),
            priority: idx,
        };
    });
}

export function prioritizeVariantSet(first, second, variantsPriority) {
    let firstMinKey = objMin(first, variantsPriority);
    let secondMinKey = objMin(second, variantsPriority);

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
