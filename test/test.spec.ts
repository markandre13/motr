import { expect } from '@esm-bundle/chai'

describe("Demonstration", function () {
    describe("Gang of Three", function () {
        it("The Good", function () {
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
})

function sleep(milliseconds: number) {
    console.log(`begin sleep ${milliseconds}`)
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log(`end sleep ${milliseconds}`)
            resolve('success')
        }, milliseconds)
    })
}