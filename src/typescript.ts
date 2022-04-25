import ts from "typescript"
import color from "./color.js"

const typescriptFormatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
}
export function launchTypeScript() {
    const configPath = ts.findConfigFile(
        "./",
        ts.sys.fileExists,
        "tsconfig.json"
    )
    if (!configPath) {
        throw new Error("Could not find a valid 'tsconfig.json'.")
    }

    const createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram

    // Note that there is another overload for `createWatchCompilerHost` that takes a set of root files.
    const host = ts.createWatchCompilerHost(
        configPath,
        {},
        ts.sys,
        createProgram,
        reportDiagnostic,
        reportWatchStatusChanged
    )

    // You can technically override any given hook on the host, though you probably don't need to.
    // Note that we're assuming `origCreateProgram` and `origPostProgramCreate` doesn't use `this` at all.
    const origCreateProgram = host.createProgram
    host.createProgram = (rootNames?: readonly string[], options?: ts.CompilerOptions, host?: ts.CompilerHost, oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram) => {
        //console.log("** We're about to create the program! **")
        // console.log(color.clearScreen)
        // console.log()
        // console.log("-----------------------------------------------------------------------------------------")
        // console.log()
        // console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Compiling...`)
        return origCreateProgram(rootNames, options, host, oldProgram)
    }
    const origPostProgramCreate = host.afterProgramCreate

    host.afterProgramCreate = program => {
        //console.log("** We finished making the program! **")
        origPostProgramCreate!(program)
    }

    // `createWatchProgram` creates an initial program, watches files, and updates the program over time.
    ts.createWatchProgram(host)
}
function reportDiagnostic(diagnostic: ts.Diagnostic) {
    console.info(`${ts.formatDiagnosticsWithColorAndContext([diagnostic], typescriptFormatHost)}`)
}
export function getLocaleTimeString() {
    return new Date().toLocaleTimeString()
}
/**
 * Prints a diagnostic every time the watch status changes.
 * This is mainly for messages like "Starting compilation" or "Compilation completed".
 */
function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
    let output = `[${color.grey}${getLocaleTimeString()}${color.reset}] `
    output += "" + ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    console.log(output)
}
