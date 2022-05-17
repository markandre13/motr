import { expect } from '@esm-bundle/chai'

function annotate(ctx: Mocha.Context, msg: string) {
    const currentTest = ctx.currentTest
    const activeTest = ctx.test
    const isEachHook = currentTest && /^"(?:before|after)\seach"/.test(activeTest!.title);
    const t = isEachHook ? currentTest : activeTest;
    (t as any).xtra = { msg }
}

describe("Demonstration", function () {
    describe("Gang of Three", function () {
        it("The Good", function () {
            annotate(this, `Literate Programming with Tests
The essence of eXtreme Programming`)
            expect(true).to.be.true
        })
        it("The Bad", function () {
           
            expect(true).to.be.false
        })
        it("The Ugly")
    })
 
    describe("Once upon a time", function () {
        it("fast test", async function () {
            await sleep(20)
        })
        it("normal test", async function () {
            await sleep(40)  
        }) 
        it("slow test", async function () {
            await sleep(80)
        })
    })

    describe("Console", function() {
        it("log 'What's up Doc?'", function() {
            console.log("What's up Doc?")
        })
    })

    describe("Puppeteer", function() {
        it("click", async function() {
            const div = document.createElement("div")
            div.appendChild(document.createTextNode("ABC"))
            div.style.width = "100vw"
            div.style.height = "100vh"
            div.onclick = (ev: MouseEvent) => {
                console.log(`CLICK AT ${ev.clientX}, ${ev.clientY}`)
            }
            document.body.replaceChildren(div);
            (window as any).motr.report("console", ["I'LL BE ME OWN PUPPET :D"]);
            (window as any).motr.report("puppeteer", {});
            // await page.mouse.click(x, y[, options])
        })
    })
})

function sleep(milliseconds: number) {
    // console.log(`begin sleep ${milliseconds}`)
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // console.log(`end sleep ${milliseconds}`)
            resolve('success')
        }, milliseconds)
    })
}