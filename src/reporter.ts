const EVENT_HOOK_BEGIN = 'hook'
const EVENT_HOOK_END = 'hook end'
const EVENT_RUN_BEGIN = 'start'
const EVENT_DELAY_BEGIN = 'waiting'
const EVENT_DELAY_END = 'ready'
const EVENT_RUN_END = 'end'
const EVENT_SUITE_BEGIN = 'suite'
const EVENT_SUITE_END = 'suite end'
const EVENT_TEST_BEGIN = 'test'
const EVENT_TEST_END = 'test end'
const EVENT_TEST_FAIL = 'fail'
const EVENT_TEST_PASS = 'pass'
const EVENT_TEST_PENDING = 'pending'
const EVENT_TEST_RETRY = 'retry'
const STATE_IDLE = 'idle'
const STATE_RUNNING = 'running'
const STATE_STOPPED = 'stopped'

class Reporter {
    _indents = 0
    static socket: WebSocket

    static state() {
        switch (this.socket.readyState) {
            case WebSocket.CONNECTING:
                return "CONNECTING"
            case WebSocket.OPEN:
                return "OPEN"
            case WebSocket.CLOSING:
                return "CLOSING"
            case WebSocket.CLOSED:
                return "CLOSED"
            default:
                return `${this.socket.readyState}`
        }
    }

    static async connect() {
        Reporter.socket = new WebSocket(`ws://localhost:8080`)
        return new Promise<void>((resolve, reject) => {
            Reporter.socket.binaryType = "arraybuffer"
            Reporter.socket.onopen = () => {
                Reporter.socket.onmessage = async (msg: MessageEvent) => {
                    console.log("WEBSOCKET MESSAGE")
                    if (msg.data instanceof Blob) {
                        // orb.socketRcvd(connection, await msg.data.arrayBuffer())
                    } else {
                        // orb.socketRcvd(connection, msg.data)
                    }
                }
                Reporter.socket.onerror = (event: Event) => {
                    console.log("WEBSOCKET ERROR")
                    console.log(event)
                    // orb.socketError(connection, 
                    //     new Error(`WebSocket connection error with ${socket.url}`)
                    // )
                }
                Reporter.socket.onclose = (event: CloseEvent) => {
                    console.log("WEBSOCKET CLOSE")
                    console.log(event)
                }
                // resolve(connection)
                resolve()
            }
            Reporter.socket.onerror = (event: Event) => {
                console.log("WEBSOCKET ERROR DURING OPEN")
                reject(new Error(`Failed to connect to ${Reporter.socket.url}`))
                // throw Error(`Failed to connect to ${this.socket.url}`)
            }
        })
    }

    constructor(runner: Mocha.Runner) {
        const stats = runner.stats
        runner
            .once(EVENT_RUN_BEGIN, () => {
                // this.report(EVENT_RUN_BEGIN, {})
                console.log('MOTO REPORTER START')
            })
            .on(EVENT_SUITE_BEGIN, () => {
                // this.report(EVENT_RUN_BEGIN, {})
                this.increaseIndent()
            })
            .on(EVENT_SUITE_END, () => {
                // this.report(EVENT_SUITE_END, {})
                this.decreaseIndent()
            })
            .on(EVENT_TEST_PASS, (test) => {
                // Test#fullTitle() returns the suite name(s)
                // prepended to the test title
                this.report(EVENT_TEST_PASS, {
                    state: test.state,
                    duration: test.duration,
                    retries: test.retries(),
                    type: test.type,
                    titlePath: test.titlePath(),
                    body: test.body,
                    xtra: (test as any).xtra
                })
                // console.log(x)
                console.log(`${this.indent()}pass: ${test.fullTitle()}`)
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                this.report(EVENT_TEST_FAIL, {
                    state: test.state,
                    duration: test.duration,
                    error: err,
                    retries: test.retries(),
                    type: test.type,
                    titlePath: test.titlePath(),
                    body: test.body,
                    xtra: (test as any).xtra
                })
                console.log(
                    `${this.indent()}fail: ${test.fullTitle()} - error: ${err.message}`
                )
            })
            .on(EVENT_TEST_PENDING, (test) => {
                this.report(EVENT_TEST_PENDING, {
                    state: test.state,
                    retries: test.retries(),
                    type: test.type,
                    titlePath: test.titlePath(),
                })
                console.log(`${this.indent()}pending: ${test.fullTitle()}`)
            })
            .once(EVENT_RUN_END, () => {
                this.report(EVENT_RUN_END, {})
                console.log(`end: ${stats!.passes}/${stats!.passes + stats!.failures} ok`)
            })
    }

    report(type: string, data: any) {
        try {
            Reporter.socket.send(JSON.stringify({ type, data }))
        }
        catch (error) {
            console.log(`failed to report ${type}: ${(error as Error).message}`)
        }
    }

    indent() {
        return Array(this._indents).join('  ')
    }

    increaseIndent() {
        this._indents++
    }

    decreaseIndent() {
        this._indents--
    }
}

export default Reporter