import {
    isEmptyObj,
    mergeObj,
    sortObj,
} from './utils.js';

import {
    addVariantSetToMatchSet,
    mergeMatchSet,
    mergeVariantSet,
    prioritizeVariantSet,
    reduceVariantSet,
    testMatchSet
} from './MatchSet.js';

/**
 *  ModuleVariantClosure assumes the variants of moduleNode are sorted by size (largest to smallest)
 */
export default class ModuleVariantClosure {
    constructor(moduleNode, parent) {
        const variantSet = moduleNode.variantSet || {};
        const parentTransitiveVariantSet = (parent && parent.transitiveVariantSet) || {};
        let reducedVariantSet = reduceVariantSet(variantSet, parentTransitiveVariantSet);

        if (reducedVariantSet === false) {
            this.invalid = true;
            return;
        }

        this.reducedVariantSet = reducedVariantSet = sortObj(reducedVariantSet);
        this.reducedVariantSetLength = Object.keys(reducedVariantSet).length;
        this.transitiveVariantSet = mergeObj(mergeObj({}, parentTransitiveVariantSet), reducedVariantSet);

        const matchSet = this.matchSet = addVariantSetToMatchSet({}, null, reducedVariantSet, this);
        if (matchSet === false) {
            this.invalid = true;
            return;
        }

        const { variants } = moduleNode;
        this.merge = (!!variants && (variants.length > 0)) ? this.mergeVariants : this.mergeChildren;

        this.name = moduleNode.name;
        this.children = [];
        if (parent) {
            parent.children.push(this);
        }
    }

    mergeVariants(priorityHash) {
        const { children } = this;
        let closureMatchSet = this.closureMatchSet = {};
        const closureResolved = this.closureResolved = [];

        children.forEach(function(child) {
            child.merge(priorityHash);
        });

        children.sort(function(a, b) {
            return b.reducedVariantSetLength - a.reducedVariantSetLength;
        });

        // Build the power set of all variants
        children.forEach(function(child) {
            const childVariantSet = child.reducedVariantSet;

            if (!testMatchSet(closureMatchSet, childVariantSet)) {
                const closureResolvedLen = closureResolved.length;
                for (let i = 0; i < closureResolvedLen; ++i) {
                    const resolved = closureResolved[i];
                    const resolvedVariantSet = resolved.__variantSet__;
                    let combinedVariantSet = mergeVariantSet(mergeObj({}, resolvedVariantSet), childVariantSet);

                    if (combinedVariantSet === false) {
                        continue;
                    }

                    combinedVariantSet = sortObj(combinedVariantSet);
                    if (testMatchSet(closureMatchSet, combinedVariantSet)) {
                        continue;
                    }

                    const prioritizeResolved = prioritizeVariantSet(resolvedVariantSet, childVariantSet, priorityHash);
                    const sourceModule = (prioritizeResolved) ? resolved.__sourceModule__ : child;
                    closureMatchSet = addVariantSetToMatchSet(closureMatchSet, closureResolved, combinedVariantSet, sourceModule);
                }
            }

            closureMatchSet = addVariantSetToMatchSet(closureMatchSet, closureResolved, childVariantSet, child);
        });

        // Inherit all closures of the variants
        const closureResolvedLen = closureResolved.length;
        for (let i = 0; i < closureResolvedLen; ++i) {
            const resolved = closureResolved[i];
            const sourceModule = resolved.__sourceModule__;
            const resolvedVariantSet = resolved.__variantSet__;
            const sourceClosureResolved = sourceModule.closureResolved;

            sourceClosureResolved.forEach(function(sourceResolved) {
                const sourceVariantSet = sourceResolved.__variantSet__;
                let combinedVariantSet = mergeVariantSet(mergeObj({}, sourceVariantSet), resolvedVariantSet);

                if (combinedVariantSet === false) {
                    return;
                }

                combinedVariantSet = sortObj(combinedVariantSet);
                if (testMatchSet(closureMatchSet, combinedVariantSet)) {
                    return;
                }

                closureMatchSet = addVariantSetToMatchSet(closureMatchSet, closureResolved, combinedVariantSet, null);
            });
        }

        closureResolved.sort(function(a, b) {
            return b.__variantSetLength__ - a.__variantSetLength__;
        });
    }

    mergeChildren(priorityHash) {
        const { children } = this;
        let closureMatchSet = this.closureMatchSet = {};
        const closureResolved = this.closureResolved = [];

        children.forEach(function(child) {
            child.merge(priorityHash);
        });

        children.sort(function(a, b) {
            const aClosureResolved = a.closureResolved;
            const bClosureResolved = b.closureResolved;

            if (bClosureResolved.length <= 0) {
                return (aClosureResolved.length <= 0) ? 0 : -1;
            } else if (aClosureResolved.length <= 0) {
                return 1;
            }

            return bClosureResolved[0].__variantSetLength__ - aClosureResolved[0].__variantSetLength__;
        });

        children.forEach(function(child) {
            if (isEmptyObj(closureMatchSet)) {
                return mergeMatchSet(closureMatchSet, child.closureMatchSet, closureResolved);
            }

            const childResolved = child.closureResolved;
            const childResolvedLen = childResolved.length;
            for (let i = 0; i < childResolvedLen; ++i) {
                const childVariantSet = childResolved[i].__variantSet__;

                if (!testMatchSet(closureMatchSet, childVariantSet)) {
                    const closureResolvedLen = closureResolved.length;
                    for (let j = 0; j < closureResolvedLen; ++j) {
                        const resolvedVariantSet = closureResolved[j].__variantSet__;
                        let combinedVariantSet = mergeVariantSet(mergeObj({}, resolvedVariantSet), childVariantSet);

                        if (combinedVariantSet === false) {
                            continue;
                        }

                        combinedVariantSet = sortObj(combinedVariantSet);
                        if (testMatchSet(closureMatchSet, combinedVariantSet)) {
                            continue;
                        }
                        
                        closureMatchSet = addVariantSetToMatchSet(closureMatchSet, closureResolved, combinedVariantSet, null);
                    }
                }
            }

            mergeMatchSet(closureMatchSet, child.closureMatchSet, closureResolved);
        });

        closureResolved.sort(function(a, b) {
            return b.__variantSetLength__ - a.__variantSetLength__;
        });
    }
}
