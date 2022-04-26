import puppeteer from 'puppeteer-core'
import * as fs from "fs"
import color from "./color.js"
import { getLocaleTimeString, launchTypeScript } from './typescript.js'
import { launchHTTPD } from './httpd.js'

import * as http from "http"
import {
    server as WebSocketServer,
    client as WebSocketClient,
    request as WebSocketRequest,
    connection as WebSocketConnection,
    Message
} from "websocket"

let totalDuration = 0
let startTime = 0
let endTime = 0

let numTotalTests = 0
let numTotalTestSuites = 0

let numPassedTests = 0
let numFailedTests = 0
let numSkippedTests = 0

const slow = 75

const config = {
    headless: false
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

type SuiteAndTestMap = Map<string, SuiteAndTestMap | Test>
const allSuiteAndTests: SuiteAndTestMap = new Map<string, SuiteAndTestMap | Test>()

let appdir = process.argv[1]
for (let i = 0; i < 3; ++i) {
    appdir = appdir.substring(0, appdir.lastIndexOf("/"))
}
console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] MOTR`)

console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Starting Typescript daemon`)
launchTypeScript()

console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Starting HTTP daemon...`)
const port = await launchHTTPD(appdir)

function launchWebSocket() {
    return new Promise<void>((resolve, reject) => {
        const serverSocket = http.createServer()
        const wss = new WebSocketServer({
            httpServer: serverSocket,
            autoAcceptConnections: true // FIXME: this is a security issue?
        })
        wss.on("request", (request: WebSocketRequest) => {
            request.accept()
            console.log(`accepted connection from ${request.host}`)
        })
        wss.on("connect", (wsConnection: WebSocketConnection) => {
            // wsConnection.on("error", (error: Error) => { orb.socketError(connection, error) })
            wsConnection.on("close", (code: number, desc: string) => {
                console.log(`WebSocket Close ${code} ${desc}`)
            })
            wsConnection.on("message", (message: Message) => {
                switch (message.type) {
                    case "binary":
                        const b = message.binaryData
                        break
                    case "utf8":
                        const msg = JSON.parse(message.utf8Data)
                        switch (msg.type) {
                            case 'start':
                                start()
                                break
                            case "pass":
                            case "fail":
                            case "pending":
                                oneDone(msg.data)
                                break
                            case 'end':
                                stop()
                                break
                        }
                        break
                }
            })
        })
        serverSocket.listen(8080, () => resolve())
    })
}
console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Starting WebSocket...`)
await launchWebSocket()

// throw Error()

console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Starting web browser...`)
const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: config.headless,
    devtools: true
})

const watchDirectory = "lib/test"

console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Scanning directory ${watchDirectory} for *.spec.js ...`)

// find all *.spec.js files
const pages = new Map<string, puppeteer.Page>()
async function scanDirectory(path: string) {
    const dir = fs.readdirSync(path)
    for (let file of dir) {
        const filename = `${path}/${file}`
        const stat = fs.statSync(filename)
        if (stat.isDirectory()) {
            await scanDirectory(filename)
            continue
        }
        if (stat.isFile()) {
            if (filename.endsWith(".spec.js")) {
                // if (filename != "lib/test/view/TextArea.spec.js") {
                //     continue
                // }
                console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Loading ${filename}`)
                const page = await browser.newPage()
                page.setDefaultNavigationTimeout(0)
                const uri = `http://localhost:${port}/?file=${encodeURIComponent(filename)}`
                try {
                    await page.goto(uri)
                    pages.set(filename, page)
                }
                catch (error) {
                    const e = error as Error
                    console.log(`[${color.red}${getLocaleTimeString()}${color.reset}] Failed to open ${uri}: ${e.message}`)
                }
            }
        }
    }
}
await scanDirectory(watchDirectory)

console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Watching for changes in directory ${watchDirectory} ...`)

// okay, this needs to be alot smarter:
// when the test loads, we track all files the browser is requesting and watch for changes in those

// TODO: recursive watch does not work on all systems (e.g. Linux)
fs.watch(watchDirectory, { recursive: true }, (type: string, filename: string) => {
    // console.log(`watch ${type} ${filename}`)
    switch (type) {
        case "change": {
            const page = pages.get(`${watchDirectory}/${filename}`)
            if (page !== undefined) {
                console.log(`[${color.grey}${getLocaleTimeString()}${color.reset}] Reload ${watchDirectory}/${filename} ...`)

                allSuiteAndTests.clear()

                totalDuration = 0
                startTime = 0
                endTime = 0

                numTotalTests = 0
                numTotalTestSuites = 0

                numPassedTests = 0
                numFailedTests = 0
                numSkippedTests = 0

                page!.reload()
                start()
            }
        } break
    }
})

//
// REPORT
//

function getStatus(status: string, title = "") {
    switch (status) {
        case 'passed':
            return `${color.green}✔ ${title}${color.reset}`
        case 'failed':
            return `${color.red}✖ ${title}${color.reset}`
        case 'pending':
            return `${color.grey}✖ ${title}${color.reset}`
        default:
            return `unknown status '${status}'`
    }
}

function getDuration(duration: number) {
    if (duration >= slow)
        return ` ${color.red}(${duration}ms)${color.reset}`
    if (duration >= slow / 2)
        return ` ${color.yellow}(${duration}ms)${color.reset}`
    return ""
}

function duration() {
    const duration = Math.round(endTime - startTime)
    const seconds = Math.floor(duration / 1000)
    const millis = duration % 1000
    return `${seconds}.${millis} secs`
}

export function start() {
    startTime = performance.now()
    console.log()
    console.log(`${color.boldWhite}${color.underline}START:${color.reset}`)
    console.log()
}

export function stop() {
    endTime = performance.now()
    reportAllSuitesAndTests(allSuiteAndTests)

    // console.log(`\n${colour.green}Finished ${numTotalTests} tests in ${numTotalTestSuites} test suites in ${duration()}`)

    const numTotalTests = numPassedTests + numSkippedTests + numFailedTests
    if (numPassedTests !== 0 || numSkippedTests !== 0 || numFailedTests !== 0) {
        console.log()
    }
    console.log(`${color.green}Finished ${numTotalTests} tests in ${numTotalTestSuites} test suites in ${duration()}${color.reset}`)
    console.log()
    if (numPassedTests !== 0 || numSkippedTests !== 0 || numFailedTests !== 0) {
        console.log(`${color.boldWhite}${color.underline}SUMMARY:${color.reset}`)
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
        console.log(`${color.boldWhite}${color.underline}FAILED TESTS:${color.reset}`)
        console.log()
        reportFailedTests(allSuiteAndTests)
        console.log()
    }
}

export function oneDone(data: Test) {
    let x = allSuiteAndTests
    data.titlePath.forEach((name, index) => {
        if (index === data.titlePath.length - 1) {
            x.set(name, data)
        } else {
            if (x.has(name)) {
                x = x.get(name) as SuiteAndTestMap
            } else {
                const y = new Map<string, SuiteAndTestMap | Test>()
                x.set(name, y)
                x = y
            }
        }
    })
}

function reportAllSuitesAndTests(suiteInfo: SuiteAndTestMap, indent = "") {
    suiteInfo.forEach((test, name) => {
        if (test instanceof Map) {
            console.log(`${indent}${color.boldWhite}${name}${color.reset}`)
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

function reportFailedTests(suiteInfo: SuiteAndTestMap, path = "") {
    suiteInfo.forEach((test, name) => {
        if (test instanceof Map) {
            reportFailedTests(test, path.length === 0 ? name : `${path} > ${name}`)
            return
        }
        if (test.state !== "failed") {
            return
        }
        console.log(`  ${color.red}∙ ${path} > ${name}${color.reset}`)
        // console.log(test.err)
        // console.log(test.error)
        console.log(`    ${test.error.name}: ${test.error.message}`)
        if (test.error.expected !== undefined && test.error.actual !== undefined) {
            console.log(`    ${color.boldWhite}Expected:${color.green} ${test.error.expected}${color.reset}`)
            console.log(`    ${color.boldWhite}Actual  :${color.red} ${test.error.actual}${color.reset}`)
        }
        const stack = test.error.stack.replace(/\n/g, "\n  ")
        console.log(`  ${stack}`)
        console.log()
    })
}
