import puppeteer from 'puppeteer-core'
import * as fs from "fs"
import * as http from "http"

const types = {
    "html": "text/html",
    "css": "text/css",
    "js": "text/javascript",
    "map": "text/json"
} as any

const httpd = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    // console.log(`${req.method} ${req.url}`)
    const url = new URL(`http://dummy${req.url}`)
    const file = url.searchParams.get("file")
    let path = url.pathname

    if (path.startsWith("/report/")) {
        const event = path.substring(8)
        const chunks: Buffer[] = []
        req.on("data", chunk => chunks.push(chunk))

        // Send the buffer or you can put it into a var
        req.on("end", () => {
            const data = Buffer.concat(chunks).toString()
            // console.log(`EVENT: ${event} ${data}`)
            switch (event) {
                case 'start':
                    start()
                    break
                case "pass":
                case "fail":
                case "pending":
                    oneDone(JSON.parse(data))
                    break
                case 'end':
                    stop()
                    break
            }
        })
        return
    }

    if (path == "/") {
        let reporter = fs.readFileSync("dist/src/reporter.js").toString()
        reporter = reporter.substring(0, reporter.lastIndexOf("export"))
        const content = `<!DOCTYPE html>
<html>

<head>
    <title>@13/test-runner</title>
    <script src="node_modules/source-map-support/browser-source-map-support.js"></script>
    <script>sourceMapSupport.install();</script>
    <script src="/node_modules/mocha/mocha-es2018.js"></script>
    <link rel="stylesheet" type="text/css" href="/node_modules/mocha/mocha.css">
</head>

<body>
    <div id="mocha"></div>
    <script>
    mocha.setup('bdd')

    ${reporter}

    mocha.reporter(Reporter)
    </script>
    <script onload="mocha.run()" type="module" src="/${file}"></script>
</body>

</html>`
        res.setHeader("Content-Type", "text/html")
        res.writeHead(200)
        res.end(content)
        return
    }
    path = path.substring(1)

    const fileSuffix = path.substring(path.lastIndexOf(".") + 1)
    const contentType = types[fileSuffix]

    let content
    try {
        content = fs.readFileSync(path)
    }
    catch (error) {
        res.writeHead(404)
        res.end()
        return
    }

    let str = content.toString()
    if (fileSuffix === "js") {
        if (path.startsWith("dist/")) {
            str = str.replace(/@esm-bundle\/chai/g, "./../../node_modules/@esm-bundle/chai/esm/chai.js")
            content = Buffer.from(str)
        }
    }

    if (contentType) {
        res.setHeader("Content-Type", contentType)
    }
    res.writeHead(200)
    res.end(content.toString())
})
const port = await new Promise((resolve, reject) => {
    httpd.listen(() => {
        resolve((httpd.address() as any).port)
    })
})

const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
    devtools: true
})

// find all *.spec.js files
const pages = new Map<string, puppeteer.Page>()

async function scan(path: string) {
    const dir = fs.readdirSync(path)
    for (let file of dir) {
        const filename = `${path}/${file}`
        const stat = fs.statSync(filename)
        if (stat.isDirectory()) {
            await scan(filename)
        } else
            if (stat.isFile()) {
                if (filename.endsWith(".spec.js")) {
                    console.log(filename)
                    const page = await browser.newPage()
                    await page.setDefaultNavigationTimeout(0)
                    await page.goto(`http://localhost:${port}/?file=${encodeURIComponent(filename)}`)
                    pages.set(filename, page)
                }
            }
    }
}
scan("dist")

// okay, this needs to be alot smarter:
// when the test loads, we track all files the browser is requesting and watch for changes in those

// TODO: recursive watch does not work on all systems (e.g. Linux)
fs.watch("dist", { recursive: true }, (type: string, filename: string) => {
    console.log(`watch ${type} ${filename}`)
    switch (type) {
        case "change": {
            const page = pages.get(`dist/${filename}`)
            if (page !== undefined) {
                console.log(`reload ${page}`)
                page!.reload()
            }
        } break
    }
})

//
// REPORT
//

const slow = 75

// ANSI Escape Sequences
const colour = {
    reset: '\x1b[0m',

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

function getStatus(status: string, title = "") {
    switch (status) {
        case 'passed':
            return `${colour.green}✔ ${title}${colour.reset}`
        case 'failed':
            return `${colour.red}✖ ${title}${colour.reset}`
        case 'pending':
            return `${colour.grey}✖ ${title}${colour.reset}`
        default:
            return `unknown status '${status}'`
    }
}

function getDuration(duration: number) {
    if (duration >= slow)
        return ` ${colour.red}(${duration}ms)${colour.reset}`
    if (duration >= slow / 2)
        return ` ${colour.yellow}(${duration}ms)${colour.reset}`
    return ""
}

let totalDuration = 0
let startTime = 0
let endTime = 0

let numTotalTests = 0
let numTotalTestSuites = 0

let numPassedTests = 0
let numFailedTests = 0
let numSkippedTests = 0

function duration() {
    const duration = Math.round(endTime - startTime)
    const seconds = Math.floor(duration / 1000)
    const millis = duration % 1000
    return `${seconds}.${millis} secs`
}

function start() {
    startTime = performance.now()
    console.log()
    console.log(`${colour.boldWhite}${colour.underline}START:${colour.reset}`)
    console.log()
}

function stop() {
    endTime = performance.now()
    reportAllSuitesAndTests(allSuites)

    // console.log(`\n${colour.green}Finished ${numTotalTests} tests in ${numTotalTestSuites} test suites in ${duration()}`)

    const numTotalTests = numPassedTests + numSkippedTests + numFailedTests
    if (numPassedTests !== 0 || numSkippedTests !== 0 || numFailedTests !== 0) {
        console.log()
    }
    console.log(`${colour.green}Finished ${numTotalTests} tests in ${numTotalTestSuites} test suites in ${duration()}`)
    console.log()
    if (numPassedTests !== 0 || numSkippedTests !== 0 || numFailedTests !== 0) {
        console.log(`${colour.boldWhite}${colour.underline}SUMMARY:${colour.reset}`)
        console.log()
    }
    if (numPassedTests !== 0) {
        console.log(getStatus("passed", `${numPassedTests} tests completed`))
    }
    if (numSkippedTests !== 0) {
        console.log(getStatus("pending", `${numSkippedTests} tests skipped`))
    }
    if (numFailedTests !== 0) {
        console.log(getStatus("failed", `${numFailedTests} tests failed`))
    }
    if (numPassedTests !== 0 || numSkippedTests !== 0 || numFailedTests !== 0) {
        console.log()
    }

    if (numFailedTests !== 0) {
        console.log(`${colour.boldWhite}${colour.underline}FAILED TESTS:${colour.reset}`)
        console.log()
        reportFailedTests(allSuites)
        console.log()
    }
}

interface Error {
    name: string
    message: string
    showDiff: boolean
    actual: any
    expected: any
    stack: any
}

interface Test {
    state: "failed" | "passed" | "pending"
    duration: number
    type: "test"
    titlePath: string[]
    body: string
    err: any
    error: Error
}

type X = Map<string, X | Test>
const allSuites: X = new Map<string, X | Test>()

function oneDone(data: Test) {
    let x = allSuites
    data.titlePath.forEach((name, index) => {
        if (index === data.titlePath.length - 1) {
            x.set(name, data)
        } else {
            if (x.has(name)) {
                x = x.get(name) as X
            } else {
                const y = new Map<string, X | Test>()
                x.set(name, y)
                x = y
            }
        }
    })
}

function reportAllSuitesAndTests(suiteInfo: X, indent = "") {
    suiteInfo.forEach((test, name) => {
        if (test instanceof Map) {
            console.log(`${indent}${colour.boldWhite}${name}${colour.reset}`)
            reportAllSuitesAndTests(test, `${indent}    `)
            ++numTotalTestSuites
        } else {
            switch (test.state) {
                case "passed":
                    ++numPassedTests
                    break
                case "failed":
                    ++numFailedTests
                    break
                case "pending":
                    ++numSkippedTests
                    break
            }
            ++numTotalTests
            totalDuration += test.duration
            console.log(`${indent}${getStatus(test.state, name)}${getDuration(test.duration)}`)
        }
    })
}

function reportFailedTests(suiteInfo: X, path = "") {
    suiteInfo.forEach((test, name) => {
        if (test instanceof Map) {
            reportFailedTests(test, path.length === 0 ? name : `${path} > ${name}`)
            return
        }
        if (test.state !== "failed") {
            return
        }
        console.log(`  ${colour.red}∙ ${path} > ${name}${colour.reset}`)
        // console.log(test.err)
        // console.log(test.error)
        console.log(`    ${test.error.name}: ${test.error.message}`)
        if (test.error.expected !== undefined && test.error.actual !== undefined) {
            console.log(`    ${colour.boldWhite}Expected:${colour.green} ${test.error.expected}${colour.reset}`)
            console.log(`    ${colour.boldWhite}Actual  :${colour.red} ${test.error.actual}${colour.reset}`)
        }
        const stack = test.error.stack.replace(/\n/g, "\n  ")
        console.log(`  ${stack}`)
        console.log()
    })
}
