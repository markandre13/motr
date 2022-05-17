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
            console.log("What's up Doc?")
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