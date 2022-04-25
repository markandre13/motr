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
                    body: test.body
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
                })
                console.log(
                    `${this.indent()}fail: ${test.fullTitle()} - error: ${err.message}`
                )
            })
            .on(EVENT_TEST_PENDING, (test) => {
                // Test#fullTitle() returns the suite name(s)
                // prepended to the test title
                this.report(EVENT_TEST_PENDING, {
                    state: test.state,
                    retries: test.retries(),
                    type: test.type,
                    titlePath: test.titlePath(),
                })
                // console.log(x)
                console.log(`${this.indent()}pending: ${test.fullTitle()}`)
            })
            .once(EVENT_RUN_END, () => {
                this.report(EVENT_RUN_END, {})
                console.log(`end: ${stats!.passes}/${stats!.passes + stats!.failures} ok`)
            })
    }

    report(type: string, data: any) {
        // console.log(`MOTO REPORT ${type}`)
        try {
            let xhr = new XMLHttpRequest()
            xhr.open("POST", `/report/${type}`)
            xhr.timeout = 100 // FIXME: required to avoid blocking when async & await is used in tests
            xhr.setRequestHeader("Content-Type", "application/json")
            xhr.send(JSON.stringify(data))

            // fetch(`/report/${type}`, {
            //     method: "POST",
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(data)
            // })
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