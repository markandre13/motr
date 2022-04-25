// ANSI Escape Sequences
const colour = {
    reset: '\x1b[0m',
    clearScreen: '\x1b[2J',
    clearLine: '\x1b[K',

    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    boldBlack: '\x1b[30;1m',
    boldRed: '\x1b[31;1m',
    boldGreen: '\x1b[32;1m',
    boldYellow: '\x1b[33;1m',
    boldBlue: '\x1b[34;1m',
    boldMagenta: '\x1b[35;1m',
    boldCyan: '\x1b[36;1m',
    boldWhite: '\x1b[37;1m',

    bold: '\x1b[1m',
    underline: '\x1b[4m',
    noUnderline: '\x1b[24m',
    reversed: '\x1b[7m',

    grey: '\x1b[90m',
    BrightBlue: '\x1b[94m',
}
export default colour
