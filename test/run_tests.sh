#!/bin/bash

if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_EXTENDED_CMD='sed -E'
else
    SED_EXTENDED_CMD='sed -r'
fi

if [[ ! -z "$DEBUG" ]]; then
    WEBPACK_CMD="node --inspect-brk ../node_modules/.bin/webpack"
else
    WEBPACK_CMD="webpack"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
FORMAT_RESET='\033[0m'

function evaluateExpectations() {
    local ACTUAL_PATH="$1"
    local EXPECTATIONS_PATH="$2"
    local FIND_NAME="$3"

    local EXPECTATION_FILE_PATHS=$(find $EXPECTATIONS_PATH -type f -name "$FIND_NAME")

    local EXIT_CODE=0

    while IFS= read -r EXPECTATION_FILE_PATH; do
        local ACTUAL_FILE_PATH=$(echo "$EXPECTATION_FILE_PATH" | $SED_EXTENDED_CMD "s/^${EXPECTATIONS_PATH}/${ACTUAL_PATH}/")
        echo -e "${BLUE}Diffing '${ACTUAL_FILE_PATH}' against '${EXPECTATION_FILE_PATH}'${FORMAT_RESET}"

        local EXPECTATIONS_DIFF=$(diff $ACTUAL_FILE_PATH $EXPECTATION_FILE_PATH)
        local DIFF_EXIT_CODE=$?

        if [[ -z "$EXPECTATIONS_DIFF" && "$DIFF_EXIT_CODE" == 0 ]]; then
            echo -e "${GREEN}${BOLD}Expectations for '${ACTUAL_FILE_PATH}' matches '${EXPECTATION_FILE_PATH}'${FORMAT_RESET}"
        else
            echo -e "${RED}${BOLD}Difference between '${ACTUAL_FILE_PATH}' and '${EXPECTATION_FILE_PATH}' found:${FORMAT_RESET}"

            echo -e "$EXPECTATIONS_DIFF"

            EXIT_CODE=1
        fi
    done <<< "$EXPECTATION_FILE_PATHS"

    if [[ "$EXIT_CODE" > 0 ]]; then
        exit $EXIT_CODE
    fi
}

function executeAndAssetWebpackBundles() {
    local ACTUAL_PATH="$1"
    local RESULTS_PATH="$2"
    local EXPECTATIONS_PATH="$3"
    local FIND_NAME="$4"

    rm -Rf "${RESULTS_PATH}"
    mkdir -p "${RESULTS_PATH}"

    local RESULTS_PATH_ESCAPED=$(echo $RESULTS_PATH | $SED_EXTENDED_CMD 's/\//\\\//')

    local WEBPACK_BUNDLE_FILE_PATHS=$(find $ACTUAL_PATH -type f -name "$FIND_NAME")

    local EXIT_CODE=0

    while IFS= read -r WEBPACK_BUNDLE_FILE_PATH; do
        echo -e "${BLUE}Executing '${WEBPACK_BUNDLE_FILE_PATH}'${FORMAT_RESET}"

        WEBPACK_BUNDLE_FILE_EVALUATION_OUTPUT_PATH=$(
            echo "$WEBPACK_BUNDLE_FILE_PATH" \
                | $SED_EXTENDED_CMD "s/^${ACTUAL_PATH}(.*)$/${RESULTS_PATH_ESCAPED}\1/" \
                | $SED_EXTENDED_CMD 's/^(.*)(\.js)$/\1.output/'
        )

        node $WEBPACK_BUNDLE_FILE_PATH > $WEBPACK_BUNDLE_FILE_EVALUATION_OUTPUT_PATH

        local WEBPACK_BUNDLE_FILE_EVALUATION_OUTPUT_FILENAME=$(basename "$WEBPACK_BUNDLE_FILE_EVALUATION_OUTPUT_PATH")
        local WEBPACK_BUNDLE_FILE_EXPECTED_OUTPUT_PATH="${EXPECTATIONS_PATH}/${WEBPACK_BUNDLE_FILE_EVALUATION_OUTPUT_FILENAME}"

        local EXPECTATIONS_DIFF=$(diff $WEBPACK_BUNDLE_FILE_EVALUATION_OUTPUT_PATH $WEBPACK_BUNDLE_FILE_EXPECTED_OUTPUT_PATH)
        local DIFF_EXIT_CODE=$?

        if [[ -z "$EXPECTATIONS_DIFF" && "$DIFF_EXIT_CODE" == 0 ]]; then
            echo -e "${GREEN}${BOLD}Execution of '${WEBPACK_BUNDLE_FILE_PATH}' matches expected output in '${WEBPACK_BUNDLE_FILE_EXPECTED_OUTPUT_PATH}'${FORMAT_RESET}"
        else
            echo -e "${RED}${BOLD}Execution of '${WEBPACK_BUNDLE_FILE_PATH}' does not match expected output in '${WEBPACK_BUNDLE_FILE_EXPECTED_OUTPUT_PATH}':${FORMAT_RESET}"

            echo -e "$EXPECTATIONS_DIFF"

            EXIT_CODE=1
        fi
    done <<< "$WEBPACK_BUNDLE_FILE_PATHS"

    if [[ "$EXIT_CODE" > 0 ]]; then
        exit $EXIT_CODE
    fi
}

ACTUAL_PATH="dist"
RESULTS_PATH="${ACTUAL_PATH}/evaluations"
EXPECTATIONS_PATH="expectations"

echo -e "${RED}${BOLD}webpack-variants Test Suite${FORMAT_RESET}"

rm -Rf dist/*
$WEBPACK_CMD build --config ./webpack.config.discover.mjs

echo -e "${BLUE}${BOLD}Running assertions on webpack outputs for VariantBuilderPlugin${FORMAT_RESET}"

evaluateExpectations $ACTUAL_PATH $EXPECTATIONS_PATH webpack.variants.json

echo -e "${BLUE}${BOLD}Ran assertions for VariantBuilderPlugin${FORMAT_RESET}"

$WEBPACK_CMD build --config ./webpack.config.build.mjs

echo -e "${BLUE}${BOLD}Running assertions on webpack outputs for VariantResolverPlugin${FORMAT_RESET}"

executeAndAssetWebpackBundles $ACTUAL_PATH $RESULTS_PATH $EXPECTATIONS_PATH "main.*.js"
executeAndAssetWebpackBundles $ACTUAL_PATH $RESULTS_PATH $EXPECTATIONS_PATH "dynamic.*.js"

echo -e "${BLUE}${BOLD}Ran assertions for VariantResolverPlugin${FORMAT_RESET}"
