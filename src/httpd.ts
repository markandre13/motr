import * as fs from "fs"
import * as http from "http"
import { start, oneDone, stop } from './motr.js'

export async function launchHTTPD(appdir: string) {

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

        if (path.startsWith("/motr/")) {
            path = `/${appdir}${path.substring(5)}`
        }

        if (path == "/") {
            let reporter = fs.readFileSync(`${appdir}/lib/src/reporter.js`).toString()
            reporter = reporter.substring(0, reporter.lastIndexOf("export"))
            const content = `<!DOCTYPE html>
<html>

<head>
    <title>@13/test-runner</title>
    <script src="/motr/node_modules/source-map-support/browser-source-map-support.js"></script>
    <script>sourceMapSupport.install();</script>
    <script src="/motr/node_modules/mocha/mocha-es2018.js"></script>
    <link rel="stylesheet" type="text/css" href="/motr/node_modules/mocha/mocha.css">
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
            console.log(`httpd: failed to serve '${path}'`)
            res.writeHead(404)
            res.end()
            return
        }

        let str = content.toString()
        if (fileSuffix === "js") {
            // console.log(`Rewrite JS file '${path}'`)
            if (path.endsWith(".spec.js")) {
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
    return port
}
